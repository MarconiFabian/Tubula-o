
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Scene from './components/3d/Scene';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { ExportContainer } from './components/ExportContainer';
import { Login } from './components/Login';
import { DatabaseModal } from './components/DatabaseModal';
import { saveProjectToDB, getAllProjects, deleteProjectFromDB } from './utils/db';
import { INITIAL_PIPES, STATUS_LABELS, STATUS_COLORS, INSULATION_LABELS, PIPE_DIAMETERS, AVAILABLE_DIAMETERS, ALL_STATUSES, ALL_INSULATION_STATUSES, INSULATION_COLORS, BASE_PRODUCTIVITY, DIFFICULTY_WEIGHTS } from './constants';
import { PipeSegment, PipeStatus, Annotation, Accessory, AccessoryType, ProductivitySettings } from './types';
import { LayoutDashboard, Cuboid, PenTool, XCircle, FileDown, Save, FolderOpen, FilePlus, Loader2, MapPin, Database, Undo, Redo, Wrench, Grid as GridIcon, CircleDot, MousePointer2, Ruler, Calendar, Lock, LogOut, ChevronRight, Copy, ClipboardPaste, Activity, Package, AlertCircle, Image as ImageIcon, Shield, Building2, Timer, FileCode, X, HelpCircle, FileSpreadsheet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

// Multiplicadores de Saldo (O quanto falta fazer por status)
const PIPING_REMAINING_FACTOR: Record<string, number> = {
    'PENDING': 1.0, 'MOUNTED': 0.7, 'WELDED': 0.15, 'HYDROTEST': 0.0
};
const INSULATION_REMAINING_FACTOR: Record<string, number> = {
    'NONE': 0.0, 'PENDING': 1.0, 'INSTALLING': 0.5, 'FINISHED': 0.0
};

// Auxiliar global para cálculo de término em dias úteis
const getWorkingEndDate = (startDate: Date, daysNeeded: number): Date => {
    let result = new Date(startDate);
    let addedDays = 0;
    let daysToTarget = daysNeeded > 0 ? daysNeeded - 1 : 0;
    
    while (addedDays < daysToTarget) {
        result.setDate(result.getDate() + 1);
        const dow = result.getDay();
        if (dow !== 0 && dow !== 6) addedDays++;
    }
    while (result.getDay() === 0 || result.getDay() === 6) {
        result.setDate(result.getDate() + 1);
    }
    return result;
};

// --- COMPLEX HISTORY HOOK ---
interface ProjectState { pipes: PipeSegment[]; }
function useProjectHistory(initialPipes: PipeSegment[]) {
    const [history, setHistory] = useState<ProjectState[]>([{ pipes: initialPipes }]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const currentState = history[currentIndex];
    const pushState = (newState: ProjectState) => {
        const newHistory = history.slice(0, currentIndex + 1);
        newHistory.push(newState);
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory); setCurrentIndex(newHistory.length - 1);
    };
    const undo = () => { if (currentIndex > 0) setCurrentIndex(prev => prev - 1); };
    const redo = () => { if (currentIndex < history.length - 1) setCurrentIndex(prev => prev + 1); };
    const setPipes = (newPipes: PipeSegment[] | ((prev: PipeSegment[]) => PipeSegment[])) => {
        const resolvedPipes = typeof newPipes === 'function' ? newPipes(currentState.pipes) : newPipes;
        pushState({ ...currentState, pipes: resolvedPipes });
    };
    return { pipes: currentState.pipes, setPipes, undo, redo, canUndo: currentIndex > 0, canRedo: currentIndex < history.length - 1 };
}

export default function App() {
  const [showDimensions, setShowDimensions] = useState(true);

  const initialPipes = useMemo(() => {
    try {
        const saved = localStorage.getItem('iso-manager-pipes');
        return saved ? JSON.parse(saved) : INITIAL_PIPES;
    } catch { return INITIAL_PIPES; }
  }, []);
  const { pipes, setPipes, undo, redo, canUndo, canRedo } = useProjectHistory(initialPipes);
  const [annotations, setAnnotations] = useState<Annotation[]>(() => {
    try {
        const saved = localStorage.getItem('iso-manager-annotations');
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [projectLocation, setProjectLocation] = useState('ÁREA / SETOR 01');
  const [projectClient, setProjectClient] = useState('VALE'); 
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);

  const [prodSettings, setProdSettings] = useState<ProductivitySettings>({
      pipingBase: BASE_PRODUCTIVITY.PIPING,
      insulationBase: BASE_PRODUCTIVITY.INSULATION,
      weights: {
          crane: DIFFICULTY_WEIGHTS.CRANE,
          blockage: DIFFICULTY_WEIGHTS.BLOCKAGE,
          nightShift: DIFFICULTY_WEIGHTS.NIGHT_SHIFT,
          criticalArea: DIFFICULTY_WEIGHTS.CRITICAL_AREA,
          scaffoldFloor: DIFFICULTY_WEIGHTS.SCAFFOLD_FLOOR,
          scaffoldHanging: DIFFICULTY_WEIGHTS.SCAFFOLD_HANGING,
          pta: DIFFICULTY_WEIGHTS.PTA
      }
  });
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'3d' | 'dashboard' | 'planning'>('3d'); 
  const [isDrawing, setIsDrawing] = useState(false);
  const [fixedLengthValue, setFixedLengthValue] = useState<number>(0);
  const [fixedLengthText, setFixedLengthText] = useState<string>('');
  const [selectedDiameter, setSelectedDiameter] = useState<number>(PIPE_DIAMETERS['8"']);
  const [selectedDiameterLabel, setSelectedDiameterLabel] = useState<string>('8"');
  const [snapAngle, setSnapAngle] = useState<number>(45);
  const [clipboard, setClipboard] = useState<PipeSegment[] | null>(null);
  const [pastePreview, setPastePreview] = useState<PipeSegment[] | null>(null);
  const [pasteCentroid, setPasteCentroid] = useState<{x:number, y:number, z:number} | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [sceneScreenshot, setSceneScreenshot] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<'STATUS' | 'SPOOL'>('STATUS');
  const [secondaryImage, setSecondaryImage] = useState<string | null>(null);
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [isDBModalOpen, setIsDBModalOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('iso-manager-auth') === 'true';
  });
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem('iso-manager-user');
  });

  const handleLogin = (user: string) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('iso-manager-auth', 'true');
    localStorage.setItem('iso-manager-user', user);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('iso-manager-auth');
    localStorage.removeItem('iso-manager-user');
  };

  const selectedPipes = useMemo(() => pipes.filter(p => selectedIds.includes(p.id)), [pipes, selectedIds]);

  const handleSwitchToDashboard = () => { setViewMode('dashboard'); setIsDrawing(false); };

  const reportStats = useMemo(() => {
      let totalLength = 0;
      let totalPipingHH = 0;
      let totalInsulationHH = 0;
      const bom: Record<string, number> = {};
      const pipeCounts: Record<string, number> = {};
      const insulationCounts: Record<string, number> = {};

      // Initialize counts
      ALL_STATUSES.forEach(s => pipeCounts[s] = 0);
      ALL_INSULATION_STATUSES.forEach(s => insulationCounts[s] = 0);

      pipes.forEach(p => {
          totalLength += p.length;
          
          // BOM
          const diam = AVAILABLE_DIAMETERS.find(d => PIPE_DIAMETERS[d] === p.diameter) || 'Unknown';
          bom[diam] = (bom[diam] || 0) + p.length;

          // Counts
          pipeCounts[p.status] = (pipeCounts[p.status] || 0) + 1;
          insulationCounts[p.insulationStatus || 'NONE'] = (insulationCounts[p.insulationStatus || 'NONE'] || 0) + 1;

          // HH Calculation (Remaining)
          const pipingF = PIPING_REMAINING_FACTOR[p.status] || 0;
          const insF = INSULATION_REMAINING_FACTOR[p.insulationStatus || 'NONE'] || 0;
          
          let pEffort = p.length * prodSettings.pipingBase * pipingF;
          let iEffort = p.length * prodSettings.insulationBase * insF;

          if (p.planningFactors) {
              let mult = 1.0;
              if (p.planningFactors.hasCrane) mult += prodSettings.weights.crane;
              if (p.planningFactors.hasBlockage) mult += prodSettings.weights.blockage;
              if (p.planningFactors.isNightShift) mult += prodSettings.weights.nightShift;
              if (p.planningFactors.isCriticalArea) mult += prodSettings.weights.criticalArea;
              if (p.planningFactors.accessType === 'SCAFFOLD_FLOOR') mult += prodSettings.weights.scaffoldFloor;
              if (p.planningFactors.accessType === 'SCAFFOLD_HANGING') mult += prodSettings.weights.scaffoldHanging;
              if (p.planningFactors.accessType === 'PTA') mult += prodSettings.weights.pta;
              
              pEffort *= mult;
              iEffort *= mult;
              
              if (pipingF > 0) pEffort += (p.planningFactors.delayHours || 0);
          }

          totalPipingHH += pEffort;
          totalInsulationHH += iEffort;
      });

      const totalHH = totalPipingHH + totalInsulationHH;
      const dailyCapacity = 50; // Assumed daily capacity
      const daysNeeded = Math.ceil(totalHH / dailyCapacity);
      const projectedEnd = getWorkingEndDate(new Date(activityDate), daysNeeded).toLocaleDateString();

      return {
          totalLength,
          totalPipingHH,
          totalInsulationHH,
          totalHH,
          projectedEnd,
          bom,
          pipeCounts,
          insulationCounts,
          total: pipes.length
      };
  }, [pipes, prodSettings, activityDate]);

  const handleSelectPipe = useCallback((id: string | null, multi: boolean = false) => { if (pastePreview) return; if (id === null) { if (!multi) setSelectedIds([]); return; } setSelectedIds(prev => multi ? (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) : [id]); }, [pastePreview]);
  const handleSetSelection = useCallback((ids: string[]) => { if (!pastePreview) setSelectedIds(ids); }, [pastePreview]);
  const handleAddAnnotation = (pos: {x:number, y:number, z:number}) => setAnnotations(prev => [...prev, { id: `A-${Date.now()}`, position: pos, text: '' }]);
  const handleUpdateAnnotation = (id: string, text: string) => setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text } : a));
  const handleDeleteAnnotation = (id: string) => setAnnotations(prev => prev.filter(a => a.id !== id));
  const handleUpdateSinglePipe = (p: PipeSegment) => { const length = Math.sqrt(Math.pow(p.end.x - p.start.x, 2) + Math.pow(p.end.y - p.start.y, 2) + Math.pow(p.end.z - p.start.z, 2)); setPipes(prev => prev.map(old => old.id === p.id ? { ...p, length } : old)); };
  const handleMovePipes = (delta: {x:number, y:number, z:number}) => { setPipes(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, start: {x:p.start.x+delta.x, y:p.start.y+delta.y, z:p.start.z+delta.z}, end: {x:p.end.x+delta.x, y:p.end.y+delta.y, z:p.end.z+delta.z} } : p)); setAnnotations(prev => prev.map(a => selectedIds.includes(a.id) ? { ...a, position: {x:a.position.x+delta.x, y:a.position.y+delta.y, z:a.position.z+delta.z} } : a)); };
  const handleBatchUpdate = (u: Partial<PipeSegment>) => setPipes(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, ...u } : p));
  const handleAddPipe = (start: any, end: any) => { const length = Math.sqrt(Math.pow(end.x-start.x, 2)+Math.pow(end.y-start.y, 2)+Math.pow(end.z-start.z, 2)); const newP: PipeSegment = { id: `P-${Math.floor(Math.random()*10000)}`, name: `Nova Linha ${pipes.length+1}`, start, end, diameter: selectedDiameter, status: 'PENDING' as PipeStatus, length }; setPipes(prev => [...prev, newP]); };
  const handleDeleteSelected = useCallback(() => { if (pastePreview) return setPastePreview(null); setPipes(prev => prev.filter(p => !selectedIds.includes(p.id))); setAnnotations(prev => prev.filter(a => !selectedIds.includes(a.id))); setSelectedIds([]); }, [selectedIds, pastePreview]);
  const handleCopy = useCallback(() => { const toCopy = pipes.filter(p => selectedIds.includes(p.id)); if (toCopy.length === 0) return; let cx=0, cy=0, cz=0, count=0; toCopy.forEach(p => { cx+=p.start.x+p.end.x; cy+=p.start.y+p.end.y; cz+=p.start.z+p.end.z; count+=2; }); if (count>0) setPasteCentroid({ x:cx/count, y:cy/count, z:cz/count }); setClipboard(toCopy); }, [selectedIds, pipes]);
  const handlePasteStart = useCallback(() => { if (!clipboard || !pasteCentroid) return; setPastePreview(clipboard.map(p => ({ ...p, id: `PREVIEW-${p.id}`, status: 'PENDING' as PipeStatus }))); setSelectedIds([]); setIsDrawing(false); }, [clipboard, pasteCentroid]);
  const handlePasteMove = useCallback((target: any) => { if (!pastePreview || !pasteCentroid) return; const dx=target.x-pasteCentroid.x, dy=target.y-pasteCentroid.y, dz=target.z-pasteCentroid.z; setPastePreview(clipboard!.map(p => ({ ...p, id: `NEW-${p.id}-${Date.now()}`, start: {x:p.start.x+dx, y:p.start.y+dy, z:p.start.z+dz}, end: {x:p.end.x+dx, y:p.end.y+dy, z:p.end.z+dz} }))); }, [clipboard, pasteCentroid, pastePreview]);
  const handlePasteConfirm = useCallback(() => { if (!pastePreview) return; const final = pastePreview.map(p => ({ ...p, id: `P-${Math.floor(Math.random()*1000000)}`, name: `${p.name} (Cópia)` })); setPipes(prev => [...prev, ...final]); setPastePreview(null); setSelectedIds(final.map(p => p.id)); }, [pastePreview]);

  // --- DATABASE ACTIONS ---
  const refreshProjects = useCallback(async () => {
      try {
          const projs = await getAllProjects();
          setSavedProjects(projs);
      } catch (error) {
          console.error("Erro ao carregar projetos:", error);
      }
  }, []);

  useEffect(() => {
      if (isDBModalOpen) {
          refreshProjects();
      }
  }, [isDBModalOpen, refreshProjects]);

  const handleDBAction_Save = async (name: string) => {
      try {
          const projectData = {
              id: `PROJ-${Date.now()}`,
              name,
              updatedAt: new Date(),
              pipes,
              annotations,
              location: projectLocation,
              client: projectClient,
              secondaryImage,
              mapImage
          };
          await saveProjectToDB(projectData);
          await refreshProjects();
          alert('Projeto salvo com sucesso!');
      } catch (error) {
          console.error("Erro ao salvar projeto:", error);
          alert("Erro ao salvar projeto.");
      }
  };

  const handleDBAction_Load = (project: any) => {
      try {
          setPipes(project.pipes || []);
          setAnnotations(project.annotations || []);
          setProjectLocation(project.location || '');
          setProjectClient(project.client || '');
          setSecondaryImage(project.secondaryImage || null);
          setMapImage(project.mapImage || null);
          setIsDBModalOpen(false);
      } catch (error) {
          console.error("Erro ao carregar projeto:", error);
          alert("Erro ao carregar projeto.");
      }
  };

  const handleDBAction_Delete = async (id: string) => {
      try {
          await deleteProjectFromDB(id);
          await refreshProjects();
      } catch (error) {
          console.error("Erro ao excluir projeto:", error);
          alert("Erro ao excluir projeto.");
      }
  };

  // Global Key listeners for actions like Delete, Copy, Paste
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
        if (viewMode !== '3d') return;
        
        // Delete
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedIds.length > 0) handleDeleteSelected();
        }

        // Copy (Ctrl+C)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            if (selectedIds.length > 0) {
                e.preventDefault();
                handleCopy();
            }
        }

        // Paste (Ctrl+V)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            if (clipboard && clipboard.length > 0) {
                e.preventDefault();
                handlePasteStart();
            }
        }

        // Undo (Ctrl+Z)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }

        // Redo (Ctrl+Y or Ctrl+Shift+Z)
        if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
            e.preventDefault();
            redo();
        }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [selectedIds, viewMode, handleDeleteSelected, handleCopy, handlePasteStart, clipboard, undo, redo]);

  // FUNÇÃO PARA EXPORTAR PARA CAD (DXF) MELHORADA
  const handleExportDXF = () => {
    // Cabeçalho padrão DXF para garantir compatibilidade
    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n";
    
    // Definição de Tabelas e Camadas
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n1\n";
    dxf += "0\nLAYER\n2\nTubulacao\n70\n0\n62\n4\n6\nCONTINUOUS\n"; // Cor 4 (Ciano)
    dxf += "0\nENDTAB\n0\nENDSEC\n";
    
    // Seção de Entidades (Os tubos reais)
    dxf += "0\nSECTION\n2\nENTITIES\n";
    
    pipes.forEach(p => {
        // 1. Criar a LINHA (Eixo do tubo)
        dxf += "0\nLINE\n8\nTubulacao\n"; 
        dxf += `10\n${p.start.x.toFixed(4)}\n20\n${p.start.y.toFixed(4)}\n30\n${p.start.z.toFixed(4)}\n`;
        dxf += `11\n${p.end.x.toFixed(4)}\n21\n${p.end.y.toFixed(4)}\n31\n${p.end.z.toFixed(4)}\n`;

        // 2. Adicionar o COMPRIMENTO como texto no ponto médio do tubo
        const midX = (p.start.x + p.end.x) / 2;
        const midY = (p.start.y + p.end.y) / 2;
        const midZ = (p.start.z + p.end.z) / 2;
        
        dxf += "0\nTEXT\n8\nInformacoes\n";
        dxf += `10\n${midX.toFixed(4)}\n20\n${(midY + 0.2).toFixed(4)}\n30\n${midZ.toFixed(4)}\n`; // Offset leve em Y
        dxf += `40\n0.15\n`; // Altura do texto
        dxf += `1\n${p.length.toFixed(2)}m\n`;
    });

    // 3. Adicionar as ANOTAÇÕES do projeto
    annotations.forEach(ann => {
        dxf += "0\nTEXT\n8\nAnotacoes\n";
        dxf += `10\n${ann.position.x.toFixed(4)}\n20\n${ann.position.y.toFixed(4)}\n30\n${ann.position.z.toFixed(4)}\n`;
        dxf += `40\n0.25\n`; // Texto de anotação um pouco maior
        dxf += `62\n2\n`; // Cor amarela (código 2)
        dxf += `1\n${ann.text || 'Nota'}\n`;
    });
    
    dxf += "0\nENDSEC\n0\nEOF";

    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `projeto-isometrico-${projectLocation.replace(/\s+/g, '-') || 'sem-nome'}.dxf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    console.log("Iniciando exportação de PDF...");
    try {
        // Tenta capturar o screenshot do 3D sempre, para garantir que o PDF tenha a imagem atualizada
        const canvas = document.querySelector('canvas');
        if (canvas) {
            try {
                const dataUrl = canvas.toDataURL('image/png');
                setSceneScreenshot(dataUrl);
                console.log("Screenshot 3D capturado com sucesso.");
            } catch (e) {
                console.warn("Falha ao capturar screenshot do 3D:", e);
            }
        }
        
        // Aguarda um tempo maior para o React atualizar o estado e o DOM oculto refletir as mudanças
        // Aumentado para 1.2s para garantir que imagens pesadas carreguem no DOM oculto
        await new Promise(r => setTimeout(r, 1200));

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        let currentY = 20;

        const dashboardEl = document.getElementById('composed-dashboard-export');
        if (dashboardEl) {
             console.log("Capturando dashboard com html2canvas...");
             // Opções otimizadas para html2canvas
             const canvasExport = await html2canvas(dashboardEl, { 
                backgroundColor: '#0f172a', 
                scale: 1.5, 
                width: 1920, 
                windowWidth: 1920,
                useCORS: true,
                allowTaint: false,
                logging: false,
                imageTimeout: 15000, // Timeout de 15s para imagens
                onclone: (clonedDoc) => {
                    // Fix para o erro "unsupported color function oklch"
                    // Removemos ou substituímos referências a oklch que o html2canvas não entende
                    
                    // 1. Limpar estilos inline que possam ter sido injetados
                    const elements = clonedDoc.getElementsByTagName('*');
                    for (let i = 0; i < elements.length; i++) {
                        const el = elements[i] as HTMLElement;
                        if (el.style && el.style.cssText.includes('oklch')) {
                            el.style.cssText = el.style.cssText.replace(/oklch\([^)]+\)/g, '#888888');
                        }
                    }
                    
                    // 2. Limpar todos os stylesheets clonados
                    try {
                        const styleSheets = Array.from(clonedDoc.styleSheets);
                        styleSheets.forEach(sheet => {
                            try {
                                const rules = Array.from(sheet.cssRules);
                                rules.forEach((rule: any) => {
                                    if (rule.style && rule.style.cssText.includes('oklch')) {
                                        // Substituição bruta por hex cinza para evitar crash no parser
                                        rule.style.cssText = rule.style.cssText.replace(/oklch\([^)]+\)/g, '#888888');
                                    }
                                });
                            } catch (e) {
                                // Ignorar erros de cross-origin ou regras inacessíveis
                            }
                        });
                    } catch (e) {
                        console.warn("Erro ao processar stylesheets no clone:", e);
                    }

                    // 3. Adicionar um style block extra para garantir overrides de cores críticas
                    const style = clonedDoc.createElement('style');
                    style.innerHTML = `
                        * { color-interpolation: sRGB !important; }
                        #composed-dashboard-export { background-color: #0f172a !important; color: #f1f5f9 !important; }
                        .text-white { color: #ffffff !important; }
                        .text-blue-400 { color: #60a5fa !important; }
                        .text-slate-400 { color: #94a3b8 !important; }
                        .bg-slate-800\\/40 { background-color: rgba(30, 41, 59, 0.4) !important; }
                        .border-slate-700 { border-color: #334155 !important; }
                    `;
                    clonedDoc.head.appendChild(style);
                }
             });
             
             const imgData = canvasExport.toDataURL('image/png', 1.0);
             const imgProps = pdf.getImageProperties(imgData);
             const pdfImgWidth = pageWidth;
             const pdfImgHeight = (imgProps.height * pdfImgWidth) / imgProps.width;
             
             pdf.addImage(imgData, 'PNG', 0, 0, pdfImgWidth, pdfImgHeight, undefined, 'FAST');
             
             if (pdfImgHeight > pageHeight - 30) { 
                 pdf.addPage(); 
                 currentY = 20; 
             } else { 
                 currentY = pdfImgHeight + 10; 
             }
             console.log("Dashboard adicionado ao PDF.");
        } else {
            console.error("Elemento 'composed-dashboard-export' não encontrado!");
        }

        if (currentY + 20 > pageHeight) { pdf.addPage(); currentY = 20; }
        pdf.setFontSize(9); pdf.setTextColor(100); pdf.text('Isometrico Manager - Software desenvolvido por Marconi Fabian', margin, currentY); currentY += 6;
        
        const isPlanning = viewMode === 'planning';
        pdf.setFontSize(16); pdf.setTextColor(isPlanning ? 120 : 0, isPlanning ? 50 : 0, isPlanning ? 240 : 0);
        pdf.text(isPlanning ? 'CRONOGRAMA DE CAMPO (SALDO REMANESCENTE)' : 'RELATÓRIO DE RASTREABILIDADE', margin, currentY); currentY += 8;
        pdf.setFontSize(11); pdf.setTextColor(0); pdf.text(`Local: ${projectLocation} | Cliente: ${projectClient} | Ref: ${activityDate.split('-').reverse().join('/')}`, margin, currentY); currentY += 10;
        
        if (reportStats.totalHH > 0) {
            pdf.setFontSize(10); pdf.setTextColor(50); pdf.setFont(undefined, 'bold');
            pdf.text(`SALDO PIPING: ${reportStats.totalPipingHH.toFixed(1)} h | SALDO ISOLAMENTO: ${reportStats.totalInsulationHH.toFixed(1)} h`, margin, currentY);
            currentY += 5;
            pdf.text(`TOTAL GERAL: ${reportStats.totalHH.toFixed(1)} Horas (Saldo) | Previsão de Término: ${reportStats.projectedEnd}`, margin, currentY);
            pdf.setFont(undefined, 'normal'); currentY += 10;
        }

        pdf.setFontSize(8); pdf.setFillColor(240, 240, 240); pdf.rect(margin, currentY, pageWidth - (margin * 2), 8, 'F');
        pdf.setTextColor(0); pdf.setFont(undefined, 'bold');
        const col1 = margin + 2, col2 = margin + 22, col3 = margin + 47, col4 = margin + 95, col5 = margin + 115, col6 = margin + 140, col7 = margin + 172;
        pdf.text("ID", col1, currentY + 5); pdf.text("Spool", col2, currentY + 5); pdf.text("Linha/Desc", col3, currentY + 5); pdf.text("Comp(m)", col4, currentY + 5); pdf.text("Status", col5, currentY + 5); pdf.text("Isolamento", col6, currentY + 5); 
        pdf.text(isPlanning ? "Saldo(H/H)" : "Nível Esf.", col7, currentY + 5);
        pdf.setFont(undefined, 'normal'); currentY += 10;

        pipes.forEach((pipe) => {
            if (currentY > pageHeight - 15) { 
                pdf.addPage(); 
                currentY = 20; 
                pdf.setFillColor(240, 240, 240); 
                pdf.rect(margin, currentY, pageWidth - (margin * 2), 8, 'F'); 
                pdf.setFont(undefined, 'bold'); 
                pdf.text("ID", col1, currentY+5); 
                pdf.text("Spool", col2, currentY+5);
                pdf.text("Linha/Desc", col3, currentY+5);
                pdf.text("Comp(m)", col4, currentY+5);
                pdf.text("Status", col5, currentY+5);
                pdf.text("Isolamento", col6, currentY+5);
                pdf.text(isPlanning ? "Saldo(H/H)" : "Nível Esf.", col7, currentY+5); 
                pdf.setFont(undefined, 'normal'); 
                currentY += 10; 
            }
            const statusLabel = STATUS_LABELS[pipe.status] || pipe.status;
            const colorHex = STATUS_COLORS[pipe.status] || '#94a3b8';
            const statusRgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colorHex);
            const r = statusRgb ? parseInt(statusRgb[1], 16) : 148;
            const g = statusRgb ? parseInt(statusRgb[2], 16) : 163;
            const b = statusRgb ? parseInt(statusRgb[3], 16) : 184;
            const insLabel = INSULATION_LABELS[pipe.insulationStatus || 'NONE'];
            
            let hh = 0;
            const pipingF = PIPING_REMAINING_FACTOR[pipe.status] || 0;
            const insF = INSULATION_REMAINING_FACTOR[pipe.insulationStatus || 'NONE'] || 0;
            const effort = (pipe.length * prodSettings.pipingBase * pipingF) + (pipe.length * prodSettings.insulationBase * insF);
            if (effort > 0 && pipe.planningFactors) {
                let mult = 1.0;
                if (pipe.planningFactors.hasCrane) mult += prodSettings.weights.crane;
                if (pipe.planningFactors.hasBlockage) mult += prodSettings.weights.blockage;
                if (pipe.planningFactors.isNightShift) mult += prodSettings.weights.nightShift;
                if (pipe.planningFactors.isCriticalArea) mult += prodSettings.weights.criticalArea;
                if (pipe.planningFactors.accessType === 'SCAFFOLD_FLOOR') mult += prodSettings.weights.scaffoldFloor;
                if (pipe.planningFactors.accessType === 'SCAFFOLD_HANGING') mult += prodSettings.weights.scaffoldHanging;
                if (pipe.planningFactors.accessType === 'PTA') mult += prodSettings.weights.pta;
                hh = (effort * mult) + (pipe.planningFactors.delayHours || 0);
            } else if (effort > 0) { hh = effort; }

            pdf.setTextColor(0); 
            pdf.setFontSize(7); 
            pdf.text(pipe.id, col1, currentY); 
            pdf.text(pipe.spoolId || '-', col2, currentY); 
            pdf.text(pipe.name.substring(0, 22), col3, currentY); 
            pdf.text(pipe.length.toFixed(2), col4, currentY);
            
            // Badge de Status
            pdf.setFillColor(r, g, b); 
            pdf.roundedRect(col5-1, currentY-3, pdf.getTextWidth(statusLabel)+4, 5, 1, 1, 'F'); 
            pdf.setTextColor(255); 
            pdf.setFont(undefined, 'bold'); 
            pdf.text(statusLabel, col5+1, currentY);
            
            pdf.setTextColor(0); 
            pdf.setFont(undefined, 'normal'); 
            pdf.text(insLabel, col6, currentY); 
            
            if (isPlanning) { 
                pdf.text(hh.toFixed(2) + " h", col7, currentY); 
            } else { 
                const esf = pipe.planningFactors?.accessType === 'NONE' ? 'NÍVEL 0' : (pipe.planningFactors?.accessType || 'NÍVEL 0'); 
                pdf.text(esf, col7, currentY); 
            }
            
            pdf.setDrawColor(230); 
            pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2); 
            currentY += 7;
        });
        
        // Adicionar BOM no final do PDF se houver espaço ou em nova página
        if (currentY > pageHeight - 40) { pdf.addPage(); currentY = 20; }
        currentY += 5;
        pdf.setFontSize(12); pdf.setFont(undefined, 'bold'); pdf.setTextColor(0, 50, 100);
        pdf.text("LISTA DE MATERIAIS (BOM)", margin, currentY); currentY += 6;
        pdf.setFontSize(8); pdf.setTextColor(0); pdf.setFont(undefined, 'normal');
        
        const bom: Record<string, number> = {};
        pipes.forEach(p => {
            const entry = Object.entries(PIPE_DIAMETERS).find(([_, v]) => Math.abs(v - p.diameter) < 0.001);
            const label = entry ? entry[0] : `${(p.diameter * 39.37).toFixed(1)}"`;
            bom[label] = (bom[label] || 0) + p.length;
        });
        
        Object.entries(bom).forEach(([label, length]) => {
            pdf.text(`• Tubo Aço Carbono ${label}: ${length.toFixed(2)} metros`, margin + 5, currentY);
            currentY += 5;
        });

        pdf.save(`relatorio-${isPlanning ? 'cronograma' : 'rastreabilidade'}.pdf`);
    } catch (err) { 
        console.error("Erro ao gerar PDF:", err);
        alert("Erro ao gerar PDF: " + (err instanceof Error ? err.message : String(err))); 
    } finally { setIsExporting(false); }
  };

  // FUNÇÃO PARA EXPORTAR PARA EXCEL (XLSX)
  const handleExportExcel = () => {
    try {
        const getDiameterLabel = (val: number) => {
            const entry = Object.entries(PIPE_DIAMETERS).find(([_, v]) => Math.abs(v - val) < 0.001);
            return entry ? entry[0] : `${(val * 39.37).toFixed(1)}"`;
        };

        const data = pipes.map(p => {
            const pipingF = PIPING_REMAINING_FACTOR[p.status] || 0;
            const insF = INSULATION_REMAINING_FACTOR[p.insulationStatus || 'NONE'] || 0;
            
            let hh = 0;
            const effort = (p.length * prodSettings.pipingBase * pipingF) + (p.length * prodSettings.insulationBase * insF);
            if (effort > 0 && p.planningFactors) {
                let mult = 1.0;
                if (p.planningFactors.hasCrane) mult += prodSettings.weights.crane;
                if (p.planningFactors.hasBlockage) mult += prodSettings.weights.blockage;
                if (p.planningFactors.isNightShift) mult += prodSettings.weights.nightShift;
                if (p.planningFactors.isCriticalArea) mult += prodSettings.weights.criticalArea;
                if (p.planningFactors.accessType === 'SCAFFOLD_FLOOR') mult += prodSettings.weights.scaffoldFloor;
                if (p.planningFactors.accessType === 'SCAFFOLD_HANGING') mult += prodSettings.weights.scaffoldHanging;
                if (p.planningFactors.accessType === 'PTA') mult += prodSettings.weights.pta;
                hh = (effort * mult) + (p.planningFactors.delayHours || 0);
            } else if (effort > 0) { hh = effort; }

            return {
                'ID': p.id,
                'Spool': p.spoolId || '-',
                'Nome': p.name,
                'Diâmetro': getDiameterLabel(p.diameter),
                'Comprimento (m)': p.length.toFixed(2),
                'Status Montagem': STATUS_LABELS[p.status],
                'Isolamento': INSULATION_LABELS[p.insulationStatus || 'NONE'],
                'Saldo HH': hh.toFixed(2),
                'Acesso': p.planningFactors?.accessType || 'NÍVEL 0',
                'Equipes': p.planningFactors?.teamCount || 1
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Rastreabilidade");
        
        // Adicionar BOM (Bill of Materials)
        const bomData: any[] = [];
        const bom: Record<string, number> = {};
        pipes.forEach(p => { 
            const label = getDiameterLabel(p.diameter);
            bom[label] = (bom[label] || 0) + p.length; 
        });
        Object.entries(bom).forEach(([label, length]) => {
            bomData.push({ 'Material': `Tubo Aço Carbono ${label}`, 'Quantidade': length.toFixed(2), 'Unidade': 'Metros' });
        });
        const bomSheet = XLSX.utils.json_to_sheet(bomData);
        XLSX.utils.book_append_sheet(workbook, bomSheet, "Lista de Materiais");

        XLSX.writeFile(workbook, `projeto-isometrico-${projectLocation.replace(/\s+/g, '-') || 'sem-nome'}.xlsx`);
    } catch (err) {
        alert("Erro ao exportar Excel.");
        console.error(err);
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
        <DatabaseModal isOpen={isDBModalOpen} onClose={() => setIsDBModalOpen(false)} projects={savedProjects} onSave={handleDBAction_Save} onLoad={handleDBAction_Load} onDelete={handleDBAction_Delete} />
        
        <TopNav 
            projectClient={projectClient}
            setProjectClient={setProjectClient}
            projectLocation={projectLocation}
            setProjectLocation={setProjectLocation}
            activityDate={activityDate}
            setActivityDate={setActivityDate}
            currentUser={currentUser}
            handleLogout={handleLogout}
            setIsDBModalOpen={setIsDBModalOpen}
            viewMode={viewMode}
            setViewMode={setViewMode}
            setIsDrawing={setIsDrawing}
            showDimensions={showDimensions}
            setShowDimensions={setShowDimensions}
            handleExportDXF={handleExportDXF}
            handleExportExcel={handleExportExcel}
            handleExportPDF={handleExportPDF}
            isExporting={isExporting}
        />

        <main className="flex-1 relative overflow-hidden flex">
            {/* EXPORT CONTAINER HIDDEN */}
            <ExportContainer 
                viewMode={viewMode}
                reportStats={reportStats}
                sceneScreenshot={sceneScreenshot}
                secondaryImage={secondaryImage}
                mapImage={mapImage}
                projectClient={projectClient}
                projectLocation={projectLocation}
                activityDate={activityDate}
            />

            <div className="flex-1 w-full h-full relative">
                <div id="scene-canvas-wrapper" className="absolute inset-0 bg-slate-900 z-0">
                    <div className="w-full h-full flex flex-col p-4">
                        <div className={`flex justify-between items-center mb-4 min-h-[48px] ${viewMode === 'dashboard' ? 'opacity-0 pointer-events-none' : ''}`}>
                            <div className="flex gap-4">
                                <button onClick={() => { setIsDrawing(!isDrawing); if(isDrawing) { setSelectedIds([]); setViewMode('3d'); }}} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-lg ${isDrawing ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>{isDrawing ? <><XCircle size={18} /> PARAR</> : <><PenTool size={18} /> DESENHAR</>}</button>
                                {!isDrawing && (<><div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700"><button onClick={() => setColorMode('STATUS')} className={`px-3 py-1.5 text-xs font-bold rounded ${colorMode === 'STATUS' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Status</button><button onClick={() => setColorMode('SPOOL')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${colorMode === 'SPOOL' ? 'bg-green-600 text-white' : 'text-slate-400'}`}><GridIcon size={14}/> Spools</button></div>{clipboard && clipboard.length > 0 && (<div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 items-center px-3 gap-2"><div className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1"><ClipboardPaste size={12}/> Copiado ({clipboard.length})</div><button onClick={handlePasteStart} className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-bold hover:bg-blue-500">Colar</button></div>)}</>)}
                                {isDrawing && (<div className="flex bg-slate-800 rounded-lg p-1.5 border border-slate-700 items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300"><div className="flex items-center gap-2 bg-slate-700 px-3 py-1.5 rounded-md border border-slate-600"><span className="text-[9px] font-bold text-slate-400 uppercase">Bitola:</span><select value={selectedDiameterLabel} onChange={(e) => { setSelectedDiameterLabel(e.target.value); setSelectedDiameter(PIPE_DIAMETERS[e.target.value]); }} className="bg-transparent text-white text-xs font-bold border-none focus:ring-0 p-0">{AVAILABLE_DIAMETERS.map(d => (<option key={d} value={d} className="bg-slate-800">{d}</option>))}</select></div><div className="h-6 w-px bg-slate-700"></div><div className="flex gap-1 mr-1">
                                    <button onClick={() => { setFixedLengthValue(6); setFixedLengthText('6'); }} className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors ${fixedLengthValue === 6 ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}>6m</button>
                                    <button onClick={() => { setFixedLengthValue(12); setFixedLengthText('12'); }} className={`px-2 py-1 text-[10px] font-bold rounded border transition-colors ${fixedLengthValue === 12 ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}`}>12m</button>
                                </div><div className={`flex items-center px-4 py-2 rounded-xl border transition-all ${fixedLengthValue > 0 ? 'bg-blue-900/40 border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-slate-900 border-slate-700 focus-within:border-slate-500'}`}><div className="flex items-center gap-2 border-r border-slate-800 pr-4 mr-3 min-w-[140px]">{fixedLengthValue > 0 ? <Lock size={15} className="text-blue-400 animate-pulse" /> : <Ruler size={15} className="text-slate-500" />}<span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">TRAVAR COMP. (m):</span></div><div className="relative flex items-center"><input type="text" value={fixedLengthText} onChange={(e) => { const rawValue = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(rawValue)) { setFixedLengthText(e.target.value); const num = parseFloat(rawValue); setFixedLengthValue(isNaN(num) ? 0 : num); } }} onBlur={() => { if (fixedLengthValue > 0) { setFixedLengthText(fixedLengthValue.toString().replace('.', ',')); } else { setFixedLengthText(''); } }} className="bg-transparent text-white text-base font-black w-24 outline-none placeholder:text-slate-800 font-mono tracking-wider p-0 m-0 border-none ring-0 focus:ring-0" placeholder="Livre" />{fixedLengthValue > 0 && (<button onClick={() => { setFixedLengthValue(0); setFixedLengthText(''); }} className="text-slate-500 hover:text-red-400 transition-colors ml-2" title="Desbloquear"><X size={18} /></button>)}</div></div></div>)}
                            </div>
                        </div>
                        <div className="flex-1 rounded-xl overflow-hidden border border-slate-700 shadow-2xl relative">
                            {viewMode === 'planning' && selectedIds.length === 0 && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 animate-in slide-in-from-top-4 fade-in"><div className="bg-purple-900/90 text-white border border-purple-500 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md"><Timer className="animate-pulse text-purple-300" size={24} /><div><p className="font-bold text-sm">Modo Planejamento Ativo (Saldo)</p><p className="text-[10px] text-purple-200">Cronograma baseado no trabalho remanescente.</p></div></div></div>
                            )}
                            <Scene pipes={pipes} annotations={annotations} selectedIds={selectedIds} onSelectPipe={handleSelectPipe} onSetSelection={handleSetSelection} isDrawing={isDrawing} onAddPipe={handleAddPipe} onUpdatePipe={handleUpdateSinglePipe} onMovePipes={handleMovePipes} onCancelDraw={() => setIsDrawing(false)} fixedLength={fixedLengthValue} onAddAnnotation={handleAddAnnotation} onUpdateAnnotation={handleUpdateAnnotation} onDeleteAnnotation={handleDeleteAnnotation} onUndo={undo} onRedo={redo} colorMode={colorMode} pastePreview={pastePreview} onPasteMove={handlePasteMove} onPasteConfirm={handlePasteConfirm} snapAngle={snapAngle} onSetSnapAngle={setSnapAngle} currentDiameter={selectedDiameter} showDimensions={showDimensions} />
                        </div>
                    </div>
                </div>
                {viewMode === 'dashboard' && (<div className="absolute inset-0 z-10 bg-slate-950/95 backdrop-blur-sm overflow-y-auto p-4 animate-in fade-in"><div className="max-w-[1600px] mx-auto h-full"><Dashboard pipes={pipes} onExportPDF={handleExportPDF} isExporting={isExporting} secondaryImage={secondaryImage} onUploadSecondary={setSecondaryImage} mapImage={mapImage} onUploadMap={setMapImage} sceneScreenshot={sceneScreenshot} onSelectPipe={handleSelectPipe} selectedIds={selectedIds} onSetSelection={handleSetSelection} /></div></div>)}
            </div>
            {selectedPipes.length > 0 && !isDrawing && !pastePreview && (
                <div className="w-96 relative z-20 shadow-2xl border-l border-slate-700">
                    <Sidebar selectedPipes={selectedPipes} onUpdateSingle={handleUpdateSinglePipe} onUpdateBatch={handleBatchUpdate} onDelete={handleDeleteSelected} onClose={() => setSelectedIds([])} mode={viewMode === 'planning' ? 'PLANNING' : 'TRACKING'} startDate={activityDate} prodSettings={prodSettings} onUpdateProdSettings={setProdSettings} onCopy={handleCopy} />
                </div>
            )}
        </main>
    </div>
  );
}
