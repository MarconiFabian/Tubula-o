import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Scene from './components/3d/Scene';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import { DatabaseModal } from './components/DatabaseModal';
import { saveProjectToDB, getAllProjects, deleteProjectFromDB } from './utils/db';
import { INITIAL_PIPES, STATUS_LABELS, STATUS_COLORS, INSULATION_LABELS } from './constants';
import { PipeSegment, PipeStatus, Annotation, Accessory, AccessoryType } from './types';
import { LayoutDashboard, Cuboid, PenTool, XCircle, FileDown, Save, FolderOpen, FilePlus, Loader2, MapPin, Database, Undo, Redo, Wrench, Grid as GridIcon, CircleDot } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// --- COMPLEX HISTORY HOOK (PIPES ONLY) ---
interface ProjectState {
    pipes: PipeSegment[];
}

function useProjectHistory(initialPipes: PipeSegment[]) {
    const [history, setHistory] = useState<ProjectState[]>([{ pipes: initialPipes }]);
    const [currentIndex, setCurrentIndex] = useState(0);

    const currentState = history[currentIndex];

    const pushState = (newState: ProjectState) => {
        const newHistory = history.slice(0, currentIndex + 1);
        newHistory.push(newState);
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setCurrentIndex(newHistory.length - 1);
    };

    const undo = () => { if (currentIndex > 0) setCurrentIndex(prev => prev - 1); };
    const redo = () => { if (currentIndex < history.length - 1) setCurrentIndex(prev => prev + 1); };

    // Helpers to update specific parts while keeping history sync
    const setPipes = (newPipes: PipeSegment[] | ((prev: PipeSegment[]) => PipeSegment[])) => {
        const resolvedPipes = typeof newPipes === 'function' ? newPipes(currentState.pipes) : newPipes;
        pushState({ ...currentState, pipes: resolvedPipes });
    };

    return {
        pipes: currentState.pipes,
        setPipes,
        undo,
        redo,
        canUndo: currentIndex > 0,
        canRedo: currentIndex < history.length - 1
    };
}

export default function App() {
  const initialPipes = useMemo(() => {
    try {
        const saved = localStorage.getItem('iso-manager-pipes');
        return saved ? JSON.parse(saved) : INITIAL_PIPES;
    } catch { return INITIAL_PIPES; }
  }, []);

  // --- HISTORY STATE ---
  const { pipes, setPipes, undo, redo, canUndo, canRedo } = useProjectHistory(initialPipes);

  const [annotations, setAnnotations] = useState<Annotation[]>(() => {
    try {
        const saved = localStorage.getItem('iso-manager-annotations');
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  // Project Info
  const [projectLocation, setProjectLocation] = useState('ÁREA / SETOR 01');

  // Selection & UI State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'3d' | 'dashboard'>('3d');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFixedLength, setIsFixedLength] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // New UI States for Improvements
  const [colorMode, setColorMode] = useState<'STATUS' | 'SPOOL'>('STATUS');
  
  // Images
  const [secondaryImage, setSecondaryImage] = useState<string | null>(null);
  const [mapImage, setMapImage] = useState<string | null>(null);
  
  // Database UI
  const [isDBModalOpen, setIsDBModalOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save (Draft)
  useEffect(() => { localStorage.setItem('iso-manager-pipes', JSON.stringify(pipes)); }, [pipes]);
  useEffect(() => { localStorage.setItem('iso-manager-annotations', JSON.stringify(annotations)); }, [annotations]);

  // DB Load
  useEffect(() => { if (isDBModalOpen) { getAllProjects().then(setSavedProjects); } }, [isDBModalOpen]);

  // --- HANDLERS ---
  const handleDBAction_Save = async (name: string) => {
      await saveProjectToDB({
          id: crypto.randomUUID(), name, updatedAt: new Date(), pipes, annotations, location: projectLocation, secondaryImage, mapImage
      });
      alert('Salvo!');
      getAllProjects().then(setSavedProjects);
  };

  const handleDBAction_Load = (project: any) => {
      setPipes(project.pipes || []);
      setAnnotations(project.annotations || []);
      setProjectLocation(project.location || '');
      setSecondaryImage(project.secondaryImage || null);
      setMapImage(project.mapImage || null);
      setSelectedIds([]);
      setIsDBModalOpen(false);
  };

  const handleDBAction_Delete = async (id: string) => {
      await deleteProjectFromDB(id);
      getAllProjects().then(setSavedProjects);
  };

  const selectedPipes = useMemo(() => pipes.filter(p => selectedIds.includes(p.id)), [pipes, selectedIds]);

  const handleSelectPipe = useCallback((id: string | null, multiSelect: boolean = false) => {
      if (id === null) {
          if (!multiSelect) setSelectedIds([]);
          return;
      }
      setSelectedIds(prev => multiSelect ? (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) : [id]);
  }, []);

  // Annotations
  const handleAddAnnotation = (pos: {x:number, y:number, z:number}) => setAnnotations(prev => [...prev, { id: `A-${Date.now()}`, position: pos, text: '' }]);
  const handleUpdateAnnotation = (id: string, text: string) => setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text } : a));
  const handleDeleteAnnotation = (id: string) => setAnnotations(prev => prev.filter(a => a.id !== id));

  // Pipes Logic
  const handleUpdateSinglePipe = (updatedPipe: PipeSegment) => {
    const length = Math.sqrt(Math.pow(updatedPipe.end.x - updatedPipe.start.x, 2) + Math.pow(updatedPipe.end.y - updatedPipe.start.y, 2) + Math.pow(updatedPipe.end.z - updatedPipe.start.z, 2));
    setPipes(prev => prev.map(p => p.id === updatedPipe.id ? { ...updatedPipe, length } : p));
  };

  const handleBatchUpdate = (updates: Partial<PipeSegment>) => {
      setPipes(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, ...updates } : p));
  };

  const handleAddPipe = (start: {x:number, y:number, z:number}, end: {x:number, y:number, z:number}) => {
    const length = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2) + Math.pow(end.z - start.z, 2));
    const newPipe: PipeSegment = {
        id: `P-${Math.floor(Math.random() * 10000)}`,
        name: `Nova Linha ${pipes.length + 1}`,
        start, end, diameter: 0.3, status: 'PENDING' as PipeStatus, length
    };
    setPipes(prev => [...prev, newPipe]);
  };

  const handleDeleteSelected = useCallback(() => {
      setPipes(prev => prev.filter(p => !selectedIds.includes(p.id)));
      setSelectedIds([]);
  }, [selectedIds, pipes]);

  // Topology for table
  const pipesWithTopology = useMemo(() => {
    return pipes.map(pipe => {
        let elbows = 0;
        pipes.forEach(other => {
            if (pipe.id === other.id) return;
            const distStart = Math.hypot(pipe.start.x - other.end.x, pipe.start.y - other.end.y, pipe.start.z - other.end.z);
            const distEnd = Math.hypot(pipe.end.x - other.start.x, pipe.end.y - other.start.y, pipe.end.z - other.start.z);
            if (distStart < 0.1 || distEnd < 0.1) elbows++;
        });
        return { ...pipe, elbows };
    });
  }, [pipes]);

  // Keyboard Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (viewMode !== '3d' || isDrawing || selectedIds.length === 0) return;
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        if (e.key === 'Delete' || e.key === 'Backspace') handleDeleteSelected();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, isDrawing, selectedIds, handleDeleteSelected]);

  const handleNewProject = () => {
      if (confirm("Criar novo projeto?")) {
          setPipes([]); setAnnotations([]); setSelectedIds([]); setSecondaryImage(null); setMapImage(null); setProjectLocation('ÁREA / SETOR 01');
      }
  };

  // PDF Export
  const handleExportPDF = async () => {
    setIsExporting(true);
    const sceneWrapper = document.getElementById('scene-canvas-wrapper');
    const canvas = sceneWrapper?.querySelector('canvas');
    let main3DImage = '';
    if (canvas) main3DImage = canvas.toDataURL('image/png', 1.0);

    const exportEl = document.getElementById('composed-dashboard-export');
    const mainImgEl = document.getElementById('export-main-img') as HTMLImageElement;
    
    if (exportEl && mainImgEl) {
        mainImgEl.src = main3DImage;
        await new Promise(r => setTimeout(r, 500));
        try {
            const canvas = await html2canvas(exportEl, { backgroundColor: '#0f172a', scale: 1.5, width: 1920, height: 1080, windowWidth: 1920, windowHeight: 1080, useCORS: true });
            const pdf = new jsPDF('l', 'mm', 'a4');
            const w = pdf.internal.pageSize.getWidth();
            const h = pdf.internal.pageSize.getHeight();
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
            pdf.save("relatorio_isometrico.pdf");
        } catch (e) { alert("Erro na exportação."); } finally { setIsExporting(false); }
    }
  };

  const getStatusColor = (s:string) => STATUS_COLORS[s] || '#ccc';

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
        <DatabaseModal isOpen={isDBModalOpen} onClose={() => setIsDBModalOpen(false)} projects={savedProjects} onSave={handleDBAction_Save} onLoad={handleDBAction_Load} onDelete={handleDBAction_Delete} />

        <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-50">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg"><Cuboid className="text-white" size={24} /></div>
                    <div>
                        <h1 className="font-bold text-xl leading-none">Isometrico Manager</h1>
                        <p className="text-[10px] text-slate-400">Marconi Fabian</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 px-3 rounded-lg border border-slate-700/50">
                     <div className="flex flex-col justify-center">
                        <label className="text-[9px] font-bold text-slate-500 uppercase leading-none mb-0.5 flex items-center gap-1"><MapPin size={10} /> Local</label>
                        <input type="text" value={projectLocation} onChange={(e) => setProjectLocation(e.target.value)} className="text-sm font-bold bg-transparent border-none text-white focus:ring-0 w-64 p-0 leading-none uppercase" />
                     </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="flex gap-1 mr-2">
                    <button onClick={undo} disabled={!canUndo} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30"><Undo size={18}/></button>
                    <button onClick={redo} disabled={!canRedo} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30"><Redo size={18}/></button>
                </div>
                <button onClick={() => setIsDBModalOpen(true)} className="flex items-center gap-2 bg-blue-900/40 hover:bg-blue-800 text-blue-300 border border-blue-500/30 px-4 py-2 rounded-lg font-bold"><Database size={18} /> Projetos</button>
                <div className="h-6 w-px bg-slate-700 mx-1"></div>
                <div className="bg-slate-800 p-1 rounded-lg flex gap-1 border border-slate-700">
                    <button onClick={() => { setViewMode('3d'); setIsDrawing(false); }} className={`px-3 py-1.5 text-sm font-bold rounded flex gap-2 items-center ${viewMode === '3d' && !isDrawing ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:text-white'}`}><Cuboid size={16}/> 3D</button>
                    <button onClick={() => { setViewMode('dashboard'); setIsDrawing(false); }} className={`px-3 py-1.5 text-sm font-bold rounded flex gap-2 items-center ${viewMode === 'dashboard' ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:text-white'}`}><LayoutDashboard size={16}/> Painel</button>
                </div>
                <div className="h-6 w-px bg-slate-700 mx-2"></div>
                <button onClick={handleNewProject} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400"><FilePlus size={20}/></button>
                <button onClick={handleExportPDF} disabled={isExporting} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm">{isExporting ? <Loader2 className="animate-spin" size={18}/> : <FileDown size={18}/>} PDF</button>
            </div>
        </header>

        <main className="flex-1 relative overflow-hidden flex">
            {/* HIDDEN EXPORT TEMPLATE */}
            <div id="composed-dashboard-export" style={{ position: 'fixed', top: 0, left: '-5000px', width: '1920px', height: '1080px', zIndex: -50, backgroundColor: '#0f172a', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                 <div className="flex justify-between items-center border-b border-blue-500/30 pb-4 shrink-0">
                    <div><h1 className="text-5xl font-bold tracking-widest uppercase text-blue-400">RELATÓRIO DE STATUS</h1><p className="text-slate-400 text-xl mt-2">RASTREAMENTO DE TUBULAÇÃO</p></div>
                    <div className="text-right"><div className="flex items-center justify-end gap-3 mb-2"><span className="text-slate-500 text-lg font-bold uppercase tracking-wider mr-2">LOCAL:</span><span className="px-4 py-1 rounded bg-blue-900/30 border border-blue-500/30 text-blue-300 font-bold uppercase text-3xl">{projectLocation}</span></div><p className="text-xl font-mono text-blue-300/80">{new Date().toLocaleDateString()}</p></div>
                 </div>
                 <div className="grid grid-cols-12 grid-rows-12 gap-6 flex-1 min-h-0 text-white">
                      <div className="col-span-8 row-span-7 relative rounded-xl overflow-hidden border-2 border-slate-700 bg-black"><img id="export-main-img" className="w-full h-full object-cover" crossOrigin="anonymous" /></div>
                      <div className="col-span-4 row-span-3 relative rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-800 flex items-center justify-center">{secondaryImage ? <img src={secondaryImage} className="w-full h-full object-cover" /> : <div className="text-slate-600 font-mono text-xl">SEM FOTO</div>}</div>
                      <div className="col-span-4 row-span-4 relative rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-800 flex items-center justify-center">{mapImage ? <img src={mapImage} className="w-full h-full object-cover" /> : <div className="text-slate-600 font-mono text-xl">SEM MAPA</div>}</div>
                      <div className="col-span-12 row-span-5 relative rounded-xl border-2 border-slate-700 bg-slate-800/50 p-6"><Dashboard pipes={pipes} exportMode={true} /></div>
                 </div>
            </div>

            <div className="flex-1 w-full h-full relative">
                <div id="scene-canvas-wrapper" className="absolute inset-0 bg-slate-900 z-0">
                    <div className="w-full h-full flex flex-col p-4">
                        <div className={`flex justify-between items-center mb-4 min-h-[48px] ${viewMode === 'dashboard' ? 'opacity-0 pointer-events-none' : ''}`}>
                            <div className="flex gap-4">
                                <button onClick={() => { setIsDrawing(!isDrawing); if(isDrawing) { setSelectedIds([]); setViewMode('3d'); }}} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-lg ${isDrawing ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
                                    {isDrawing ? <><XCircle size={18} /> PARAR</> : <><PenTool size={18} /> DESENHAR</>}
                                </button>
                                {/* Tool Buttons */}
                                {!isDrawing && (
                                    <>
                                        <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700" title="Modo de Cores">
                                             <button onClick={() => setColorMode('STATUS')} className={`px-3 py-1.5 text-xs font-bold rounded ${colorMode === 'STATUS' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Status</button>
                                             <button onClick={() => setColorMode('SPOOL')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${colorMode === 'SPOOL' ? 'bg-green-600 text-white' : 'text-slate-400'}`}><GridIcon size={14}/> Spools</button>
                                        </div>
                                    </>
                                )}
                                {isDrawing && (
                                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                                        <button onClick={() => setIsFixedLength(false)} className={`px-3 py-1.5 text-xs font-bold rounded ${!isFixedLength ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Livre</button>
                                        <button onClick={() => setIsFixedLength(true)} className={`px-3 py-1.5 text-xs font-bold rounded ${isFixedLength ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>Fixo 6m</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 rounded-xl overflow-hidden border border-slate-700 shadow-2xl relative">
                            <Scene 
                                pipes={pipes}
                                annotations={annotations}
                                selectedIds={selectedIds}
                                onSelectPipe={handleSelectPipe}
                                isDrawing={isDrawing}
                                onAddPipe={handleAddPipe}
                                onUpdatePipe={handleUpdateSinglePipe}
                                onCancelDraw={() => setIsDrawing(false)}
                                fixedLength={isFixedLength}
                                onAddAnnotation={handleAddAnnotation}
                                onUpdateAnnotation={handleUpdateAnnotation}
                                onDeleteAnnotation={handleDeleteAnnotation}
                                onUndo={undo}
                                onRedo={redo}
                                colorMode={colorMode}
                            />
                        </div>
                    </div>
                </div>

                {viewMode === 'dashboard' && (
                    <div className="absolute inset-0 z-10 bg-slate-950/95 backdrop-blur-sm overflow-y-auto p-4 animate-in fade-in">
                        <div className="max-w-[1600px] mx-auto">
                            <Dashboard 
                                pipes={pipes}
                                onExportPDF={handleExportPDF} 
                                isExporting={isExporting}
                                secondaryImage={secondaryImage} onUploadSecondary={setSecondaryImage}
                                mapImage={mapImage} onUploadMap={setMapImage}
                            />
                            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mt-6">
                                <table className="w-full text-sm text-left text-slate-400">
                                    <thead className="bg-slate-800 text-slate-200 uppercase text-xs">
                                        <tr>
                                            <th className="p-3 w-10"><input type="checkbox" onChange={(e) => setSelectedIds(e.target.checked ? pipes.map(p=>p.id) : [])} checked={pipes.length > 0 && selectedIds.length === pipes.length} /></th>
                                            <th className="p-3">ID</th>
                                            <th className="p-3">Spool</th>
                                            <th className="p-3">Nome</th>
                                            <th className="p-3">Comp.</th>
                                            <th className="p-3">Status Tub.</th>
                                            <th className="p-3">Isolamento</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pipesWithTopology.map(p => (
                                            <tr key={p.id} className={`border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer ${selectedIds.includes(p.id) ? 'bg-blue-900/20' : ''}`} onClick={() => handleSelectPipe(p.id, true)}>
                                                <td className="p-3"><input type="checkbox" checked={selectedIds.includes(p.id)} readOnly /></td>
                                                <td className="p-3 font-mono text-xs">{p.id}</td>
                                                <td className="p-3 font-mono text-xs text-green-400">{p.spoolId || '-'}</td>
                                                <td className="p-3 text-white">{p.name}</td>
                                                <td className="p-3">{p.length.toFixed(2)}m</td>
                                                <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-900 uppercase" style={{backgroundColor: getStatusColor(p.status)}}>{STATUS_LABELS[p.status]}</span></td>
                                                <td className="p-3 text-xs">{p.insulationStatus !== 'NONE' ? (INSULATION_LABELS[p.insulationStatus!] || p.insulationStatus) : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {selectedPipes.length > 0 && !isDrawing && (
                <div className="w-96 relative z-20 shadow-2xl border-l border-slate-700">
                    <Sidebar 
                        selectedPipes={selectedPipes}
                        onUpdateSingle={handleUpdateSinglePipe}
                        onUpdateBatch={handleBatchUpdate}
                        onDelete={handleDeleteSelected}
                        onClose={() => setSelectedIds([])} 
                    />
                </div>
            )}
        </main>
    </div>
  );
}
