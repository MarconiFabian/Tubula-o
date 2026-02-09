import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Scene from './components/3d/Scene';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import { INITIAL_PIPES, STATUS_LABELS, STATUS_COLORS, INSULATION_LABELS } from './constants';
import { PipeSegment, PipeStatus } from './types';
import { LayoutDashboard, Cuboid, PenTool, XCircle, FileDown, Save, FolderOpen, FilePlus, Loader2, MapPin } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function App() {
  // --- STATE MANAGEMENT ---
  const [pipes, setPipes] = useState<PipeSegment[]>(() => {
    try {
        const saved = localStorage.getItem('iso-manager-pipes');
        if (!saved) return INITIAL_PIPES;
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : INITIAL_PIPES;
    } catch (e) {
        return INITIAL_PIPES;
    }
  });
  
  // Project Info - Default to empty or a placeholder if needed
  const [projectLocation, setProjectLocation] = useState('ÁREA / SETOR 01');

  // Selection State (Multi-select array)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Images for Report (HUD)
  const [secondaryImage, setSecondaryImage] = useState<string | null>(null);
  const [mapImage, setMapImage] = useState<string | null>(null);
  
  // UI State
  const [viewMode, setViewMode] = useState<'3d' | 'dashboard'>('3d');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFixedLength, setIsFixedLength] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save
  useEffect(() => {
      localStorage.setItem('iso-manager-pipes', JSON.stringify(pipes));
  }, [pipes]);

  // Derived state for Sidebar
  const selectedPipes = useMemo(() => {
      return pipes.filter(p => selectedIds.includes(p.id));
  }, [pipes, selectedIds]);

  // Handle Selection
  const handleSelectPipe = useCallback((id: string | null, multiSelect: boolean = false) => {
      if (id === null) {
          if (!multiSelect) setSelectedIds([]);
          return;
      }
      setSelectedIds(prev => {
          if (multiSelect) {
              return prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
          }
          return [id]; 
      });
  }, []);

  // --- TOPOLOGY ---
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

  // --- ACTIONS ---
  const handleUpdateSinglePipe = (updatedPipe: PipeSegment) => {
    const length = Math.sqrt(Math.pow(updatedPipe.end.x - updatedPipe.start.x, 2) + Math.pow(updatedPipe.end.y - updatedPipe.start.y, 2) + Math.pow(updatedPipe.end.z - updatedPipe.start.z, 2));
    const finalPipe = { ...updatedPipe, length };
    setPipes(prev => prev.map(p => p.id === finalPipe.id ? finalPipe : p));
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
  }, [selectedIds]);

  const handleNewProject = () => {
      if (confirm("Criar novo projeto? O desenho atual será perdido.")) {
          setPipes([]); setSelectedIds([]); setSecondaryImage(null); setMapImage(null); setProjectLocation('ÁREA / SETOR 01');
      }
  };

  const handleSaveProject = () => {
      const dataStr = JSON.stringify(pipes, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `projeto_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const loaded = JSON.parse(ev.target?.result as string);
              if (Array.isArray(loaded)) setPipes(loaded);
          } catch(err) { alert("Erro ao ler arquivo"); }
      };
      reader.readAsText(file);
  };

  // --- EXPORT PDF LOGIC (HUD FIXED RESOLUTION) ---
  const handleExportPDF = async () => {
    setIsExporting(true);

    // 1. Capture 3D Canvas
    const sceneWrapper = document.getElementById('scene-canvas-wrapper');
    const canvas = sceneWrapper?.querySelector('canvas');
    let main3DImage = '';
    if (canvas) main3DImage = canvas.toDataURL('image/png', 1.0);

    // 2. Prepare Template
    const exportEl = document.getElementById('composed-dashboard-export');
    const mainImgEl = document.getElementById('export-main-img') as HTMLImageElement;
    
    if (exportEl && mainImgEl) {
        mainImgEl.src = main3DImage;
        // Wait for image to render
        await new Promise(r => setTimeout(r, 500));

        try {
            const canvas = await html2canvas(exportEl, {
                backgroundColor: '#0f172a',
                scale: 1.5,
                width: 1920,
                height: 1080,
                windowWidth: 1920,
                windowHeight: 1080,
                logging: false,
                useCORS: true
            });

            const pdf = new jsPDF('l', 'mm', 'a4');
            const w = pdf.internal.pageSize.getWidth();
            const h = pdf.internal.pageSize.getHeight();

            // Page 1: HUD
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);

            // Page 2: Table
            pdf.addPage();
            pdf.setFontSize(16);
            pdf.text("Detalhamento de Linhas (Tabela Completa)", 10, 20);
            pdf.setFontSize(12);
            pdf.text(`Local: ${projectLocation}`, 10, 28); // Add location to table page too
            
            let y = 35;
            pdf.setFontSize(9);
            pdf.setFillColor(230,230,230);
            pdf.rect(10, y, w-20, 8, 'F');
            pdf.font="helvetica"; pdf.setFont(undefined, 'bold');
            pdf.text("ID", 12, y+5);
            pdf.text("Local", 35, y+5);
            pdf.text("Nome", 65, y+5);
            pdf.text("Comp (m)", 115, y+5);
            pdf.text("Status Tub.", 135, y+5);
            pdf.text("Isolamento", 165, y+5);
            pdf.text("Obs", 195, y+5);
            y += 10;
            pdf.setFont(undefined, 'normal');

            pipesWithTopology.forEach(p => {
                if (y > h - 20) { pdf.addPage(); y = 20; }
                
                // Tradução correta usando os CONSTANTS
                const status = STATUS_LABELS[p.status] || p.status;
                const ins = (!p.insulationStatus || p.insulationStatus === 'NONE') 
                    ? '-' 
                    : (INSULATION_LABELS[p.insulationStatus] || p.insulationStatus);
                
                pdf.text(p.id, 12, y);
                pdf.text(p.location?.substring(0,15) || '-', 35, y);
                pdf.text(p.name.substring(0, 20), 65, y);
                pdf.text(p.length.toFixed(2), 115, y);
                pdf.text(status, 135, y);
                pdf.text(ins, 165, y);
                pdf.text(p.generalInfo?.substring(0,25) || '-', 195, y);
                pdf.line(10, y+2, w-10, y+2);
                y += 8;
            });

            pdf.save("relatorio_isometrico.pdf");

        } catch (e) {
            console.error(e);
            alert("Erro na exportação.");
        } finally {
            setIsExporting(false);
        }
    }
  };

  const getStatusColor = (s:string) => STATUS_COLORS[s] || '#ccc';

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
        
        {/* HEADER */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-50">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg"><Cuboid className="text-white" size={24} /></div>
                    <div>
                        <h1 className="font-bold text-xl leading-none">Isometrico Manager</h1>
                        <p className="text-[10px] text-slate-400">Marconi Fabian</p>
                    </div>
                </div>

                {/* ACTIVITY LOCATION INPUT - FIXED SIZE ISSUE */}
                <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 px-3 rounded-lg border border-slate-700/50 hover:border-blue-500/50 transition-colors group">
                     <div className="flex flex-col justify-center">
                        <label className="text-[9px] font-bold text-slate-500 uppercase leading-none mb-0.5 flex items-center gap-1 group-hover:text-blue-400 transition-colors">
                            <MapPin size={10} /> Local da Atividade (Conjunto)
                        </label>
                        <input 
                            type="text" 
                            value={projectLocation}
                            onChange={(e) => setProjectLocation(e.target.value)}
                            className="text-sm font-bold bg-transparent border-none text-white placeholder-slate-600 focus:ring-0 w-64 p-0 leading-none uppercase tracking-wide"
                            placeholder="DEFINIR LOCAL (EX: EP02)..."
                        />
                     </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-1 rounded-lg flex gap-1 border border-slate-700">
                    <button onClick={() => { setViewMode('3d'); setIsDrawing(false); }} className={`px-3 py-1.5 text-sm font-bold rounded flex gap-2 items-center ${viewMode === '3d' && !isDrawing ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:text-white'}`}><Cuboid size={16}/> 3D</button>
                    <button onClick={() => { setViewMode('dashboard'); setIsDrawing(false); }} className={`px-3 py-1.5 text-sm font-bold rounded flex gap-2 items-center ${viewMode === 'dashboard' ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:text-white'}`}><LayoutDashboard size={16}/> Painel</button>
                </div>
                <div className="h-6 w-px bg-slate-700 mx-2"></div>
                <button onClick={handleNewProject} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400"><FilePlus size={20}/></button>
                <button onClick={handleSaveProject} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400"><Save size={20}/></button>
                <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400"><FolderOpen size={20}/></button>
                <input type="file" hidden ref={fileInputRef} onChange={handleLoadProject} accept=".json" />
                <div className="h-6 w-px bg-slate-700 mx-2"></div>
                <button onClick={handleExportPDF} disabled={isExporting} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm transition-all shadow-lg shadow-red-900/20">
                    {isExporting ? <Loader2 className="animate-spin" size={18}/> : <FileDown size={18}/>} Relatório PDF
                </button>
            </div>
        </header>

        <main className="flex-1 relative overflow-hidden flex">
            
            {/* HIDDEN EXPORT TEMPLATE (FIXED 1920x1080) */}
            <div id="composed-dashboard-export" style={{ position: 'fixed', top: 0, left: '-5000px', width: '1920px', height: '1080px', zIndex: -50, backgroundColor: '#0f172a', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                 {/* Header Report */}
                 <div className="flex justify-between items-center border-b border-blue-500/30 pb-4 shrink-0">
                    <div>
                        <h1 className="text-5xl font-bold tracking-widest uppercase text-blue-400">RELATÓRIO DE STATUS</h1>
                        <p className="text-slate-400 text-xl mt-2">RASTREAMENTO DE TUBULAÇÃO E ISOLAMENTO</p>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-3 mb-2">
                             <span className="text-slate-500 text-lg font-bold uppercase tracking-wider mr-2">LOCAL DA ATIVIDADE:</span>
                             <span className="px-4 py-1 rounded bg-blue-900/30 border border-blue-500/30 text-blue-300 font-bold tracking-widest uppercase text-3xl">
                                {projectLocation || 'NÃO DEFINIDO'}
                             </span>
                        </div>
                        <p className="text-xl font-mono text-blue-300/80">{new Date().toLocaleDateString()}</p>
                        <p className="text-lg text-slate-500 font-mono">ID: {pipes.length > 0 ? pipes[0].id.split('-')[0] : 'UNK'}-REP-001</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-12 grid-rows-12 gap-6 flex-1 min-h-0 text-white">
                      
                      {/* 1. Main 3D View (Span 8 cols, 7 rows) */}
                      <div className="col-span-8 row-span-7 relative rounded-xl overflow-hidden border-2 border-slate-700 bg-black">
                           <div className="absolute top-4 left-4 z-10 bg-black/60 px-4 py-2 rounded text-blue-400 font-bold border border-blue-500/30 text-lg">VISTA PRINCIPAL 3D</div>
                           <img id="export-main-img" className="w-full h-full object-cover" alt="3D View" crossOrigin="anonymous" />
                      </div>

                      {/* 2. Photo (Span 4 cols, 3 rows) */}
                      <div className="col-span-4 row-span-3 relative rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-800 flex items-center justify-center">
                           <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-1 rounded text-yellow-400 font-bold border border-yellow-500/30">FOTO DA OBRA</div>
                           {secondaryImage ? <img src={secondaryImage} className="w-full h-full object-cover" /> : <div className="text-slate-600 font-mono text-xl">SEM FOTO</div>}
                      </div>

                      {/* 3. Map (Span 4 cols, 4 rows) */}
                      <div className="col-span-4 row-span-4 relative rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-800 flex items-center justify-center">
                            <div className="absolute top-4 left-4 z-10 bg-black/60 px-3 py-1 rounded text-green-400 font-bold border border-green-500/30">MAPA DE LOCALIZAÇÃO</div>
                            {mapImage ? <img src={mapImage} className="w-full h-full object-cover" /> : <div className="text-slate-600 font-mono text-xl">SEM MAPA</div>}
                      </div>

                      {/* 4. Detailed Stats (Span 12 cols, 5 rows) - THIS IS THE NEW SPLIT SECTION */}
                      <div className="col-span-12 row-span-5 relative rounded-xl border-2 border-slate-700 bg-slate-800/50 p-6">
                           <Dashboard pipes={pipes} exportMode={true} />
                      </div>
                 </div>
            </div>

            {/* --- MAIN UI --- */}
            <div className="flex-1 w-full h-full relative">
                
                {/* LAYER 1: 3D SCENE */}
                <div id="scene-canvas-wrapper" className="absolute inset-0 bg-slate-900 z-0">
                    <div className="w-full h-full flex flex-col p-4">
                        {/* Toolbar */}
                        <div className={`flex justify-between items-center mb-4 min-h-[48px] ${viewMode === 'dashboard' ? 'opacity-0 pointer-events-none' : ''}`}>
                            <div className="flex gap-4">
                                <button onClick={() => { setIsDrawing(!isDrawing); if(isDrawing) { setSelectedIds([]); setViewMode('3d'); }}} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-lg ${isDrawing ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>
                                    {isDrawing ? <><XCircle size={18} /> PARAR</> : <><PenTool size={18} /> DESENHAR</>}
                                </button>
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
                                selectedIds={selectedIds}
                                onSelectPipe={handleSelectPipe}
                                isDrawing={isDrawing}
                                onAddPipe={handleAddPipe}
                                onUpdatePipe={handleUpdateSinglePipe}
                                onCancelDraw={() => setIsDrawing(false)}
                                fixedLength={isFixedLength}
                            />
                        </div>
                    </div>
                </div>

                {/* LAYER 2: DASHBOARD UI */}
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
                                            <th className="p-3">Nome</th>
                                            <th className="p-3">Comp.</th>
                                            <th className="p-3">Status Tub.</th>
                                            <th className="p-3">Isolamento</th>
                                            <th className="p-3">Info</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pipesWithTopology.map(p => (
                                            <tr key={p.id} className={`border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer ${selectedIds.includes(p.id) ? 'bg-blue-900/20' : ''}`} onClick={() => handleSelectPipe(p.id, true)}>
                                                <td className="p-3"><input type="checkbox" checked={selectedIds.includes(p.id)} readOnly /></td>
                                                <td className="p-3 font-mono text-xs">{p.id}</td>
                                                <td className="p-3 text-white">{p.name}</td>
                                                <td className="p-3">{p.length.toFixed(2)}m</td>
                                                <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-900 uppercase" style={{backgroundColor: getStatusColor(p.status)}}>{STATUS_LABELS[p.status]}</span></td>
                                                <td className="p-3 text-xs">{p.insulationStatus !== 'NONE' ? (INSULATION_LABELS[p.insulationStatus!] || p.insulationStatus) : '-'}</td>
                                                <td className="p-3 text-xs italic">{p.generalInfo || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* SIDEBAR */}
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