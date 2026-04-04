
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import Scene from './components/3d/Scene';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { ExportContainer } from './components/ExportContainer';
import { DatabaseModal } from './components/DatabaseModal';
import { auth, onAuthStateChanged } from './firebase';
import { saveProjectToDB, getAllProjects, deleteProjectFromDB, ProjectData } from './utils/db';
import { INITIAL_PIPES, STATUS_LABELS, STATUS_COLORS, INSULATION_LABELS, PIPE_DIAMETERS, AVAILABLE_DIAMETERS, ALL_STATUSES, ALL_INSULATION_STATUSES, INSULATION_COLORS, BASE_PRODUCTIVITY, DIFFICULTY_WEIGHTS, PIPING_REMAINING_FACTOR, INSULATION_REMAINING_FACTOR, HOURS_PER_DAY, DEFAULT_PROD_SETTINGS } from './constants';
import { PipeSegment, PipeStatus, Annotation, AnnotationType, Accessory, AccessoryType, AccessoryStatus, ProductivitySettings, DailyProduction, ProjectCalendar } from './types';
import { LayoutDashboard, Cuboid, PenTool, XCircle, FileDown, Save, FolderOpen, FilePlus, Loader2, MapPin, Database, Undo, Redo, Wrench, Grid as GridIcon, CircleDot, MousePointer2, Ruler, Calendar, Lock, LogOut, ChevronRight, Copy, ClipboardPaste, Activity, Package, AlertCircle, Image as ImageIcon, Shield, Building2, Timer, FileCode, X, HelpCircle, FileSpreadsheet, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { getWorkingEndDate, getWorkingDaysBetween, calculateTotalHH, getSnapPoint } from './utils/planning';
import DailyProductionModal from './components/DailyProductionModal';

// Auxiliar global para cálculo de término em dias úteis (REMOVIDO - USANDO UTILS)

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
    const resetHistory = (initialPipes: PipeSegment[]) => {
        setHistory([{ pipes: initialPipes }]);
        setCurrentIndex(0);
    };
    return { pipes: currentState.pipes, setPipes, undo, redo, canUndo: currentIndex > 0, canRedo: currentIndex < history.length - 1, resetHistory };
}

// --- SAFE LOCAL STORAGE WRAPPER ---
const safeStorage = {
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('LocalStorage is blocked or unavailable:', e);
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('LocalStorage is blocked or unavailable:', e);
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('LocalStorage is blocked or unavailable:', e);
    }
  },
  clear: () => {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn('LocalStorage is blocked or unavailable:', e);
    }
  }
};

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="bg-slate-900 border border-red-500/50 p-8 rounded-2xl max-w-lg shadow-2xl">
            <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
            <h1 className="text-2xl font-bold text-white mb-2">Ops! Algo deu errado.</h1>
            <p className="text-slate-400 mb-6">Ocorreu um erro inesperado ao carregar o aplicativo.</p>
            <div className="bg-slate-950 p-4 rounded-xl text-left overflow-auto max-h-40 mb-6">
              <code className="text-red-400 text-[10px] font-mono whitespace-pre-wrap leading-tight">
                {this.state.error?.stack || this.state.error?.toString()}
              </code>
            </div>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={() => window.location.reload()} 
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
              >
                Recarregar
              </button>
              <button 
                onClick={() => { if(confirm("Isso apagará o projeto atual não salvo. Deseja continuar?")) { safeStorage.clear(); window.location.reload(); } }} 
                className="bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white px-6 py-2 rounded-xl font-bold transition-all border border-slate-700"
              >
                Limpar Cache
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  console.log('Isometrico Manager: AppContent rendering...');
  const [showDimensions, setShowDimensions] = useState(true);

  const initialPipes = useMemo(() => {
    try {
        const saved = safeStorage.getItem('iso-manager-pipes');
        return saved ? JSON.parse(saved) : INITIAL_PIPES;
    } catch { return INITIAL_PIPES; }
  }, []);
  const { pipes, setPipes, undo, redo, canUndo, canRedo, resetHistory } = useProjectHistory(initialPipes);
  const [annotations, setAnnotations] = useState<Annotation[]>(() => {
    try {
        const saved = safeStorage.getItem('iso-manager-annotations');
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [projectLocation, setProjectLocation] = useState('ÁREA / SETOR 01');
  const [projectClient, setProjectClient] = useState('VALE'); 
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [deadlineDate, setDeadlineDate] = useState<string | null>(null);

  const [prodSettings, setProdSettings] = useState<ProductivitySettings>(DEFAULT_PROD_SETTINGS);
  
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
  const [pdfExportStats, setPdfExportStats] = useState<any>(null);
  const [sceneScreenshot, setSceneScreenshot] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<'STATUS' | 'SPOOL'>('STATUS');
  const [secondaryImage, setSecondaryImage] = useState<string | null>(null);
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState<AccessoryType | null>(null);

  const handleAddAccessory = useCallback((pipeId: string, type: AccessoryType, offset: number) => {
    setPipes(prev => prev.map(p => {
      if (p.id === pipeId) {
        const newAcc: Accessory = {
          id: Math.random().toString(36).substr(2, 9),
          type,
          offset,
          status: AccessoryStatus.PENDING
        };
        return {
          ...p,
          accessories: [...(p.accessories || []), newAcc]
        };
      }
      return p;
    }));
    setPlacementMode(null);
  }, [setPipes]);

  const handleBatchAddSupports = useCallback((spacing: number, status: AccessoryStatus = AccessoryStatus.PENDING) => {
    if (spacing <= 0) return;
    setPipes(prev => prev.map(p => {
      if (!selectedIds.includes(p.id)) return p;
      const length = p.length;
      if (length <= 0) return p;
      
      const count = Math.floor(length / spacing);
      const newAccessories: Accessory[] = [];
      for (let i = 1; i <= count; i++) {
        const offset = (i * spacing) / length;
        if (offset > 1) break;
        newAccessories.push({
          id: `ACC-${Math.random().toString(36).substr(2, 9)}`,
          type: 'SUPPORT',
          offset,
          status: status
        });
      }
      
      const existingOtherAccessories = (p.accessories || []).filter(a => a.type !== 'SUPPORT');

      return {
        ...p,
        supports: { total: 0, installed: 0 }, // Clear legacy supports
        accessories: [...existingOtherAccessories, ...newAccessories]
      };
    }));
  }, [selectedIds, setPipes]);

  const handleBatchUpdateSupportStatus = useCallback((status: AccessoryStatus) => {
    setPipes(prev => prev.map(p => {
      if (!selectedIds.includes(p.id)) return p;
      if (!p.accessories && !p.supports) return p;
      
      const newAccessories = (p.accessories || []).map(a => 
        a.type === 'SUPPORT' ? { ...a, status } : a
      );
      
      const newSupports = p.supports ? {
          ...p.supports,
          installed: status === AccessoryStatus.MOUNTED ? p.supports.total : 0
      } : undefined;

      return {
        ...p,
        accessories: newAccessories,
        ...(newSupports ? { supports: newSupports } : {})
      };
    }));
  }, [selectedIds, setPipes]);

  const handleClearAccessories = useCallback(() => {
    setPipes(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, accessories: [], supports: { total: 0, installed: 0 } } : p));
  }, [selectedIds, setPipes]);

  const handleClearAllAccessories = useCallback(() => {
    if (window.confirm('Tem certeza que deseja apagar TODOS os suportes e acessórios de todos os tubos do projeto?')) {
      setPipes(prev => prev.map(p => ({ ...p, accessories: [], supports: { total: 0, installed: 0 } })));
    }
  }, [setPipes]);
  const [isDBModalOpen, setIsDBModalOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    return safeStorage.getItem('iso-manager-current-project-id');
  });
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(() => {
    return safeStorage.getItem('iso-manager-current-project-name');
  });
  const [dailyProduction, setDailyProduction] = useState<DailyProduction[]>([]);
    const [projectCalendar, setProjectCalendar] = useState<ProjectCalendar>({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    startTime: '07:30',
    endTime: '17:30',
    workDays: ['1', '2', '3', '4', '5'],
    teamCount: 1,
    exceptions: []
  });
  const [isDailyProductionModalOpen, setIsDailyProductionModalOpen] = useState(false);

  useEffect(() => {
    if (currentProjectId) safeStorage.setItem('iso-manager-current-project-id', currentProjectId);
    else safeStorage.removeItem('iso-manager-current-project-id');
  }, [currentProjectId]);

  useEffect(() => {
    if (currentProjectName) safeStorage.setItem('iso-manager-current-project-name', currentProjectName);
    else safeStorage.removeItem('iso-manager-current-project-name');
  }, [currentProjectName]);
  const [isAuthenticated] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<string | null>('marconi-default');
  const [isAuthReady] = useState(true);
  const [dynamicZoom, setDynamicZoom] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user.uid);
      } else {
        setCurrentUser('marconi-default');
      }
    });
    return () => unsubscribe();
  }, []);

  const selectedPipes = useMemo(() => pipes.filter(p => selectedIds.includes(p.id)), [pipes, selectedIds]);

  const handleSwitchToDashboard = () => { setViewMode('dashboard'); setIsDrawing(false); };

  const reportStats = useMemo(() => {
      let totalLength = 0;
      let totalPipingHH = 0;
      let totalInsulationHH = 0;
      let pipingTotalLength = 0;
      let pipingRemainingLength = 0;
      let insulationTotalLength = 0;
      let insulationRemainingLength = 0;
      const bom: Record<string, number> = {};
      const pipeCounts: Record<string, number> = {};
      const insulationCounts: Record<string, number> = {};
      const pipeLengths: Record<string, number> = {};
      const insulationLengths: Record<string, number> = {};

      // Initialize counts
      ALL_STATUSES.forEach(s => { pipeCounts[s] = 0; pipeLengths[s] = 0; });
      ALL_INSULATION_STATUSES.forEach(s => { insulationCounts[s] = 0; insulationLengths[s] = 0; });

      const { totalPipingHH: pPipeHH, totalInsulationHH: pInsulHH, annotationHH, totalHH } = calculateTotalHH(pipes, annotations, prodSettings);
      
      const annotationBreakdown = annotations.reduce((acc, ann) => {
          const type = ann.type || AnnotationType.COMMENT;
          acc[type] = (acc[type] || 0) + 1;
          return acc;
      }, {} as Record<string, number>);
      
      // Cálculo de capacidade total baseada em todas as equipes alocadas
      const globalTeams = pipes.length > 0 ? Math.max(1, Math.round(pipes.reduce((acc, p) => acc + (p.planningFactors?.teamCount || 1), 0) / pipes.length)) : 1;
      const dailyCapacity = globalTeams * prodSettings.globalConfig.shiftHours; 

      const daysNeeded = Math.ceil(totalHH / dailyCapacity);

      const projectedEnd = getWorkingEndDate(new Date(activityDate + 'T12:00:00'), daysNeeded, prodSettings.globalConfig.workOnWeekends).toLocaleDateString('pt-BR');

      const componentStats = {
          supports: { total: 0, installed: 0 }
      };

      pipes.forEach(p => {
          const length = p.length || 0;
          totalLength += length;
          
          const pipingF = PIPING_REMAINING_FACTOR[p.status] || 0;
          const insulationF = INSULATION_REMAINING_FACTOR[p.insulationStatus || 'NONE'] || 0;
          
          pipingTotalLength += length;
          pipingRemainingLength += length * pipingF;
          
          if (p.insulationStatus && p.insulationStatus !== 'NONE') {
              insulationTotalLength += length;
              insulationRemainingLength += length * insulationF;
          }

          if (p.status) {
              pipeCounts[p.status] = (pipeCounts[p.status] || 0) + 1;
              pipeLengths[p.status] = (pipeLengths[p.status] || 0) + length;
          }
          
          if (p.insulationStatus && p.insulationStatus !== 'NONE') {
              insulationCounts[p.insulationStatus] = (insulationCounts[p.insulationStatus] || 0) + 1;
              insulationLengths[p.insulationStatus] = (insulationLengths[p.insulationStatus] || 0) + length;
          }

          // Count accessories (modern way)
          let hasModernSupports = false;
          if (p.accessories) {
              p.accessories.forEach(a => {
                  const isPipeInstalled = p.status === 'MOUNTED' || p.status === 'WELDED' || p.status === 'HYDROTEST';
                  const isInstalled = a.status === AccessoryStatus.MOUNTED || isPipeInstalled;
                  if (a.type === 'SUPPORT') {
                      hasModernSupports = true;
                      componentStats.supports.total += 1;
                      if (isInstalled) componentStats.supports.installed += 1;
                  }
              });
          }

          // Count supports from the 'supports' field (legacy or direct) ONLY if no modern supports
          if (p.supports && !hasModernSupports) {
              componentStats.supports.total += (p.supports.total || 0);
              const isPipeInstalled = p.status === 'MOUNTED' || p.status === 'WELDED' || p.status === 'HYDROTEST';
              componentStats.supports.installed += isPipeInstalled ? (p.supports.total || 0) : (p.supports.installed || 0);
          }
      });

      return {
          totalLength,
          totalPipingHH: pPipeHH,
          totalInsulationHH: pInsulHH,
          annotationHH,
          totalHH,
          daysNeeded,
          projectedEnd,
          bom,
          pipeCounts,
          insulationCounts,
          pipeLengths,
          insulationLengths,
          annotationBreakdown,
          total: pipes.length,
          deadlineStats: null,
          pipingTotalLength,
          pipingRemainingLength,
          pipingExecutedLength: pipingTotalLength - pipingRemainingLength,
          insulationTotalLength,
          insulationRemainingLength,
          insulationExecutedLength: insulationTotalLength - insulationRemainingLength,
          componentStats
      };
  }, [pipes, annotations, prodSettings, activityDate]);

  const handleSelectPipe = useCallback((id: string | null, multi: boolean = false) => { if (pastePreview) return; if (id === null) { if (!multi) setSelectedIds([]); return; } setSelectedIds(prev => multi ? (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) : [id]); }, [pastePreview]);
  const handleSetSelection = useCallback((ids: string[]) => { if (!pastePreview) setSelectedIds(ids); }, [pastePreview]);
  const handleAddAnnotation = (pos: {x:number, y:number, z:number}) => setAnnotations(prev => [...prev, { id: `A-${Date.now()}`, position: pos, text: '' }]);
  const handleUpdateAnnotation = (id: string, text: string, type?: AnnotationType, estimatedHours?: number) => setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text, type: type || a.type, estimatedHours: estimatedHours !== undefined ? estimatedHours : a.estimatedHours } : a));
  const handleDeleteAnnotation = (id: string) => setAnnotations(prev => prev.filter(a => a.id !== id));
  const handleUpdateSinglePipe = (p: PipeSegment) => { const length = Math.sqrt(Math.pow(p.end.x - p.start.x, 2) + Math.pow(p.end.y - p.start.y, 2) + Math.pow(p.end.z - p.start.z, 2)); setPipes(prev => prev.map(old => old.id === p.id ? { ...p, length } : old)); };
  const handleMovePipes = (delta: {x:number, y:number, z:number}) => {
    // 1. Apply delta to selected pipes
    let movedPipes = pipes.map(p => selectedIds.includes(p.id) ? { 
        ...p, 
        start: {x:p.start.x+delta.x, y:p.start.y+delta.y, z:p.start.z+delta.z}, 
        end: {x:p.end.x+delta.x, y:p.end.y+delta.y, z:p.end.z+delta.z} 
    } : p);

    // 2. Check for snap (only for the first selected pipe)
    const firstSelectedId = selectedIds[0];
    const firstSelectedPipe = movedPipes.find(p => p.id === firstSelectedId);
    
    if (firstSelectedPipe) {
        const snap = getSnapPoint(firstSelectedPipe.start, pipes.filter(p => !selectedIds.includes(p.id)));
        if (snap) {
            const snapDx = snap.x - firstSelectedPipe.start.x;
            const snapDy = snap.y - firstSelectedPipe.start.y;
            const snapDz = snap.z - firstSelectedPipe.start.z;
            
            movedPipes = movedPipes.map(p => selectedIds.includes(p.id) ? {
                ...p,
                start: {x: p.start.x + snapDx, y: p.start.y + snapDy, z: p.start.z + snapDz},
                end: {x: p.end.x + snapDx, y: p.end.y + snapDy, z: p.end.z + snapDz}
            } : p);
        }
    }

    setPipes(movedPipes);
    setAnnotations(prev => prev.map(a => selectedIds.includes(a.id) ? { ...a, position: {x:a.position.x+delta.x, y:a.position.y+delta.y, z:a.position.z+delta.z} } : a));
  };
  const handleBatchUpdate = (u: Partial<PipeSegment>) => setPipes(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, ...u } : p));
  const handleJoinPipes = (id1: string, id2: string, staticId: string) => {
    const pipe1 = pipes.find(p => p.id === id1);
    const pipe2 = pipes.find(p => p.id === id2);
    if (!pipe1 || !pipe2) return;

    const movingId = staticId === id1 ? id2 : id1;
    const movingPipe = staticId === id1 ? pipe2 : pipe1;
    const staticPipe = staticId === id1 ? pipe1 : pipe2;

    // Find closest endpoints
    const p1Start = new THREE.Vector3(pipe1.start.x, pipe1.start.y, pipe1.start.z);
    const p1End = new THREE.Vector3(pipe1.end.x, pipe1.end.y, pipe1.end.z);
    const p2Start = new THREE.Vector3(pipe2.start.x, pipe2.start.y, pipe2.start.z);
    const p2End = new THREE.Vector3(pipe2.end.x, pipe2.end.y, pipe2.end.z);

    const points = [
        { p: p1Start, pipe: pipe1, isStart: true },
        { p: p1End, pipe: pipe1, isStart: false },
        { p: p2Start, pipe: pipe2, isStart: true },
        { p: p2End, pipe: pipe2, isStart: false }
    ];

    // Find closest pair of points (one from pipe1, one from pipe2)
    let minD = 1000;
    let bestPair = { p1: points[0], p2: points[2] };

    for (let i = 0; i < 2; i++) {
        for (let j = 2; j < 4; j++) {
            const d = points[i].p.distanceTo(points[j].p);
            if (d < minD) {
                minD = d;
                bestPair = { p1: points[i], p2: points[j] };
            }
        }
    }

    // Move movingPipe so bestPair.p2 matches bestPair.p1
    const delta = bestPair.p1.p.clone().sub(bestPair.p2.p);
    
    setPipes(prev => prev.map(p => {
        if (p.id === movingId) {
            return {
                ...p,
                start: { x: p.start.x + delta.x, y: p.start.y + delta.y, z: p.start.z + delta.z },
                end: { x: p.end.x + delta.x, y: p.end.y + delta.y, z: p.end.z + delta.z },
                accessories: [
                    ...(p.accessories || []),
                    { id: `WELD-${Date.now()}`, type: 'WELD' as AccessoryType, offset: bestPair.p2.isStart ? 0 : 1, status: AccessoryStatus.MOUNTED }
                ]
            };
        }
        return p;
    }));
  };
  const handleAddPipe = (start: any, end: any) => { 
      const length = Math.sqrt(Math.pow(end.x-start.x, 2)+Math.pow(end.y-start.y, 2)+Math.pow(end.z-start.z, 2)); 
      let newPipe: PipeSegment = { 
          id: `P-${Math.floor(Math.random()*10000)}`, 
          name: `Nova Linha ${pipes.length+1}`, 
          start, 
          end, 
          diameter: selectedDiameter, 
          status: 'PENDING' as PipeStatus, 
          length,
          accessories: []
      }; 

      // Check for connections
      const startVec = new THREE.Vector3(start.x, start.y, start.z);
      const endVec = new THREE.Vector3(end.x, end.y, end.z);
      
      pipes.forEach(existingPipe => {
          const eStart = new THREE.Vector3(existingPipe.start.x, existingPipe.start.y, existingPipe.start.z);
          const eEnd = new THREE.Vector3(existingPipe.end.x, existingPipe.end.y, existingPipe.end.z);
          
          if (startVec.distanceTo(eStart) < 0.3 || startVec.distanceTo(eEnd) < 0.3) {
              newPipe.accessories = [...(newPipe.accessories || []), { id: `WELD-${Date.now()}-${Math.random()}`, type: 'WELD' as AccessoryType, offset: 0, status: AccessoryStatus.MOUNTED }];
          } else if (endVec.distanceTo(eStart) < 0.3 || endVec.distanceTo(eEnd) < 0.3) {
              newPipe.accessories = [...(newPipe.accessories || []), { id: `WELD-${Date.now()}-${Math.random()}`, type: 'WELD' as AccessoryType, offset: 1, status: AccessoryStatus.MOUNTED }];
          }
      });

      setPipes(prev => [...prev, newPipe]); 
  };
  const handleDeleteSelected = useCallback(() => { if (pastePreview) return setPastePreview(null); setPipes(prev => prev.filter(p => !selectedIds.includes(p.id))); setAnnotations(prev => prev.filter(a => !selectedIds.includes(a.id))); setSelectedIds([]); }, [selectedIds, pastePreview]);
  const handleCopy = useCallback(() => { const toCopy = pipes.filter(p => selectedIds.includes(p.id)); if (toCopy.length === 0) return; let cx=0, cy=0, cz=0, count=0; toCopy.forEach(p => { cx+=p.start.x+p.end.x; cy+=p.start.y+p.end.y; cz+=p.start.z+p.end.z; count+=2; }); if (count>0) setPasteCentroid({ x:cx/count, y:cy/count, z:cz/count }); setClipboard(toCopy); }, [selectedIds, pipes]);
  const handlePasteStart = useCallback(() => { if (!clipboard || !pasteCentroid) return; setPastePreview(clipboard.map(p => ({ ...p, id: `PREVIEW-${p.id}`, status: 'PENDING' as PipeStatus }))); setSelectedIds([]); setIsDrawing(false); }, [clipboard, pasteCentroid]);
  const handlePasteMove = useCallback((target: any) => {
    if (!pastePreview || !pasteCentroid) return;
    
    const dx = target.x - pasteCentroid.x;
    const dy = target.y - pasteCentroid.y;
    const dz = target.z - pasteCentroid.z;
    
    let preview = clipboard!.map(p => ({ 
        ...p, 
        id: `NEW-${p.id}-${Date.now()}`, 
        start: {x:p.start.x+dx, y:p.start.y+dy, z:p.start.z+dz}, 
        end: {x:p.end.x+dx, y:p.end.y+dy, z:p.end.z+dz} 
    }));

    // Check for snap
    const firstPipe = preview[0];
    const snap = getSnapPoint(firstPipe.start, pipes);
    if (snap) {
        const snapDx = snap.x - firstPipe.start.x;
        const snapDy = snap.y - firstPipe.start.y;
        const snapDz = snap.z - firstPipe.start.z;
        
        preview = preview.map(p => ({
            ...p,
            start: {x: p.start.x + snapDx, y: p.start.y + snapDy, z: p.start.z + snapDz},
            end: {x: p.end.x + snapDx, y: p.end.y + snapDy, z: p.end.z + snapDz}
        }));
    }

    setPastePreview(preview);
  }, [clipboard, pasteCentroid, pastePreview, pipes]);
  const handlePasteConfirm = useCallback(() => { 
    if (!pastePreview) return; 
    
    const final = pastePreview.map(p => {
        let newPipe = { ...p, id: `P-${Math.floor(Math.random()*1000000)}`, name: `${p.name} (Cópia)` };
        
        // Check for connections to existing pipes
        const startVec = new THREE.Vector3(newPipe.start.x, newPipe.start.y, newPipe.start.z);
        const endVec = new THREE.Vector3(newPipe.end.x, newPipe.end.y, newPipe.end.z);
        
        pipes.forEach(existingPipe => {
            const eStart = new THREE.Vector3(existingPipe.start.x, existingPipe.start.y, existingPipe.start.z);
            const eEnd = new THREE.Vector3(existingPipe.end.x, existingPipe.end.y, existingPipe.end.z);
            
            if (startVec.distanceTo(eStart) < 0.3 || startVec.distanceTo(eEnd) < 0.3) {
                newPipe.accessories = [...(newPipe.accessories || []), { id: `WELD-${Date.now()}-${Math.random()}`, type: 'WELD' as AccessoryType, offset: 0, status: AccessoryStatus.MOUNTED }];
            } else if (endVec.distanceTo(eStart) < 0.3 || endVec.distanceTo(eEnd) < 0.3) {
                newPipe.accessories = [...(newPipe.accessories || []), { id: `WELD-${Date.now()}-${Math.random()}`, type: 'WELD' as AccessoryType, offset: 1, status: AccessoryStatus.MOUNTED }];
            }
        });
        
        return newPipe;
    });
    
    setPipes(prev => [...prev, ...final]); 
    setPastePreview(null); 
    setSelectedIds(final.map(p => p.id)); 
  }, [pastePreview, pipes]);

  // --- DATABASE ACTIONS ---
  const refreshProjects = useCallback(async () => {
      try {
          const projs = await getAllProjects(currentUser || undefined);
          setSavedProjects(projs);
      } catch (error) {
          console.error("Erro ao carregar projetos:", error);
      }
  }, [currentUser]);

  useEffect(() => {
      if (isDBModalOpen) {
          refreshProjects();
      }
  }, [isDBModalOpen, refreshProjects]);

  const handleDBAction_Save = async (name: string, overwriteId?: string, overrides?: any) => {
      try {
          const isOverwrite = !!overwriteId;
          const projectId = overwriteId || `PROJ-${Date.now()}`;
          const projectData = {
              id: projectId,
              name,
              updatedAt: new Date(),
              pipes: overrides?.pipes || pipes,
              annotations: overrides?.annotations || annotations,
              location: overrides?.location || projectLocation,
              client: overrides?.client || projectClient,
              secondaryImage: overrides?.secondaryImage || secondaryImage,
              mapImage: overrides?.mapImage || mapImage,
              userId: currentUser || undefined,
              dailyProduction: overrides?.dailyProduction || dailyProduction,
              activityDate: overrides?.activityDate || activityDate,
              deadlineDate: overrides?.deadlineDate || deadlineDate,
              projectCalendar: overrides?.projectCalendar || projectCalendar
          };
          await saveProjectToDB(projectData);
          await refreshProjects();
          setCurrentProjectId(projectId);
          setCurrentProjectName(name);
          showToast(isOverwrite ? 'Projeto atualizado com sucesso!' : 'Projeto salvo com sucesso!', 'success');
      } catch (error) {
          console.error("Erro ao salvar projeto:", error);
          showToast("Erro ao salvar projeto.", 'error');
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
          setDailyProduction(project.dailyProduction || []);
          setActivityDate(project.activityDate || new Date().toISOString().split('T')[0]);
          setDeadlineDate(project.deadlineDate || new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
          setProjectCalendar(project.projectCalendar || null);
          setCurrentProjectId(project.id);
          setCurrentProjectName(project.name);
          setIsDBModalOpen(false);
          showToast("Projeto carregado com sucesso!", 'success');
      } catch (error) {
          console.error("Erro ao carregar projeto:", error);
          showToast("Erro ao carregar projeto.", 'error');
      }
  };

  const handleDBAction_Delete = async (id: string) => {
      try {
          await deleteProjectFromDB(id);
          await refreshProjects();
          showToast("Projeto excluído com sucesso!", 'success');
      } catch (error) {
          console.error("Erro ao excluir projeto:", error);
          showToast("Erro ao excluir projeto.", 'error');
      }
  };

  const [confirmNewProject, setConfirmNewProject] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const handleNewProject = () => {
      setConfirmNewProject(true);
  };

  const executeNewProject = () => {
      setPipes(INITIAL_PIPES);
      setAnnotations([]);
      setProjectLocation('ÁREA / SETOR 01');
      setProjectClient('VALE');
      setSecondaryImage(null);
      setMapImage(null);
      setCurrentProjectId(null);
      setCurrentProjectName(null);
      setDailyProduction([]);
      setSelectedIds([]);
      setClipboard(null);
      setPastePreview(null);
      resetHistory(INITIAL_PIPES);
      setConfirmNewProject(false);
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
    const pipesToExport = selectedIds.length > 0 ? pipes.filter(p => selectedIds.includes(p.id)) : pipes;
    const annotationsToExport = selectedIds.length > 0 ? annotations.filter(a => selectedIds.includes(a.id)) : annotations;

    // Cabeçalho padrão DXF para garantir compatibilidade
    let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n";
    
    // Definição de Tabelas e Camadas
    dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n1\n";
    dxf += "0\nLAYER\n2\nTubulacao\n70\n0\n62\n4\n6\nCONTINUOUS\n"; // Cor 4 (Ciano)
    dxf += "0\nENDTAB\n0\nENDSEC\n";
    
    // Seção de Entidades (Os tubos reais)
    dxf += "0\nSECTION\n2\nENTITIES\n";
    
    pipesToExport.forEach(p => {
        // 1. Criar a LINHA (Eixo do tubo)
        dxf += "0\nLINE\n8\nTubulacao\n"; 
        dxf += `10\n${(p.start.x || 0).toFixed(4)}\n20\n${(p.start.y || 0).toFixed(4)}\n30\n${(p.start.z || 0).toFixed(4)}\n`;
        dxf += `11\n${(p.end.x || 0).toFixed(4)}\n21\n${(p.end.y || 0).toFixed(4)}\n31\n${(p.end.z || 0).toFixed(4)}\n`;

        // 2. Adicionar o COMPRIMENTO como texto no ponto médio do tubo
        const midX = (p.start.x + p.end.x) / 2;
        const midY = (p.start.y + p.end.y) / 2;
        const midZ = (p.start.z + p.end.z) / 2;
        
        dxf += "0\nTEXT\n8\nInformacoes\n";
        dxf += `10\n${(midX || 0).toFixed(4)}\n20\n${((midY || 0) + 0.2).toFixed(4)}\n30\n${(midZ || 0).toFixed(4)}\n`; // Offset leve em Y
        dxf += `40\n0.15\n`; // Altura do texto
        dxf += `1\n${(p.length || 0).toFixed(2)}m\n`;
    });

    // 3. Adicionar as ANOTAÇÕES do projeto
    annotationsToExport.forEach(ann => {
        dxf += "0\nTEXT\n8\nAnotacoes\n";
        dxf += `10\n${(ann.position.x || 0).toFixed(4)}\n20\n${(ann.position.y || 0).toFixed(4)}\n30\n${(ann.position.z || 0).toFixed(4)}\n`;
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
        const pipesToExport = selectedIds.length > 0 ? pipes.filter(p => selectedIds.includes(p.id)) : pipes;
        const annotationsToExport = selectedIds.length > 0 ? annotations.filter(a => selectedIds.includes(a.id)) : annotations;

        // Recalcular estatísticas para a seleção (ou usar as globais se for tudo)
        let exportStats = reportStats;
        
        if (selectedIds.length > 0) {
            let totalPipingHH = 0;
            let totalInsulationHH = 0;
            let annotationHH = 0;
            let pipingTotalLength = 0;
            let pipingRemainingLength = 0;
            let insulationTotalLength = 0;
            let insulationRemainingLength = 0;
            const annotationBreakdown: Record<string, number> = {};
            const pipeLengths: Record<string, number> = {};
            const insulationLengths: Record<string, number> = {};
            ALL_STATUSES.forEach(s => pipeLengths[s] = 0);
            ALL_INSULATION_STATUSES.forEach(s => insulationLengths[s] = 0);

            const componentStats = {
                supports: { total: 0, installed: 0 }
            };

            pipesToExport.forEach(p => {
                const pipingF = PIPING_REMAINING_FACTOR[p.status] || 0;
                const insF = INSULATION_REMAINING_FACTOR[p.insulationStatus || 'NONE'] || 0;
                
                pipingTotalLength += p.length;
                pipingRemainingLength += p.length * (PIPING_REMAINING_FACTOR[p.status] ?? 1);
                
                if (p.status) {
                    pipeLengths[p.status] = (pipeLengths[p.status] || 0) + p.length;
                }
                
                if (p.insulationStatus && p.insulationStatus !== 'NONE') {
                    insulationTotalLength += p.length;
                    insulationRemainingLength += p.length * (INSULATION_REMAINING_FACTOR[p.insulationStatus] ?? 1);
                }
                const insStatus = p.insulationStatus || 'NONE';
                insulationLengths[insStatus] = (insulationLengths[insStatus] || 0) + p.length;
                
                // Count accessories (modern way)
                let hasModernSupports = false;
                if (p.accessories) {
                    p.accessories.forEach(a => {
                        const isPipeInstalled = p.status === 'MOUNTED' || p.status === 'WELDED' || p.status === 'HYDROTEST';
                        const isInstalled = a.status === AccessoryStatus.MOUNTED || isPipeInstalled;
                        if (a.type === 'SUPPORT') {
                            hasModernSupports = true;
                            componentStats.supports.total += 1;
                            if (isInstalled) componentStats.supports.installed += 1;
                        }
                    });
                }

                // Count supports from the 'supports' field (legacy or direct) ONLY if no modern supports
                if (p.supports && !hasModernSupports) {
                    componentStats.supports.total += (p.supports.total || 0);
                    const isPipeInstalled = p.status === 'MOUNTED' || p.status === 'WELDED' || p.status === 'HYDROTEST';
                    componentStats.supports.installed += isPipeInstalled ? (p.supports.total || 0) : (p.supports.installed || 0);
                }

                let pEffort = p.length * prodSettings.pipingBase * pipingF;
                let iEffort = p.length * prodSettings.insulationBase * insF;

                // Adicionar esforço de acessórios (apenas se for piping)
                const supportCount = hasModernSupports 
                    ? (p.accessories?.filter(a => a.type === 'SUPPORT').length || 0)
                    : (p.supports?.total || 0);

                pEffort += supportCount * prodSettings.supportBase * pipingF;

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

            annotationsToExport.forEach(a => {
                if (a.estimatedHours) {
                    annotationHH += a.estimatedHours;
                    const type = a.type || 'COMMENT';
                    annotationBreakdown[type] = (annotationBreakdown[type] || 0) + a.estimatedHours;
                }
            });

            const totalHH = totalPipingHH + totalInsulationHH + annotationHH;
            const globalTeams = pipesToExport.length > 0 ? Math.max(1, Math.round(pipesToExport.reduce((acc, p) => acc + (p.planningFactors?.teamCount || 1), 0) / pipesToExport.length)) : 1;
            const dailyCapacity = globalTeams * HOURS_PER_DAY; 
            const daysNeeded = Math.ceil(totalHH / dailyCapacity);
            const projectedEnd = getWorkingEndDate(new Date(activityDate + 'T12:00:00'), daysNeeded).toLocaleDateString('pt-BR');

            // Deadline Calculation for Export
            let deadlineStats = null;
            if (deadlineDate) {
                const start = new Date(activityDate + 'T12:00:00');
                const end = new Date(deadlineDate + 'T12:00:00');
                const daysUntilDeadline = getWorkingDaysBetween(start, end);
                const totalLength = pipesToExport.reduce((acc, p) => acc + p.length, 0);
                
                if (daysUntilDeadline > 0) {
                    const requiredDailyOutput = totalLength / daysUntilDeadline;
                    const requiredDailyHH = totalHH / daysUntilDeadline;
                    const currentDailyOutput = (dailyCapacity / totalHH) * totalLength;
                    
                    deadlineStats = {
                        daysUntilDeadline,
                        requiredDailyOutput,
                        requiredDailyHH,
                        currentDailyOutput,
                        isFeasible: requiredDailyHH <= dailyCapacity,
                        ratio: (requiredDailyHH / dailyCapacity) * 100
                    };
                }
            }

            exportStats = {
                ...reportStats,
                totalPipingHH,
                totalInsulationHH,
                annotationHH,
                annotationBreakdown,
                pipeLengths,
                insulationLengths,
                totalHH,
                projectedEnd,
                deadlineStats,
                pipingTotalLength,
                pipingRemainingLength,
                pipingExecutedLength: pipingTotalLength - pipingRemainingLength,
                insulationTotalLength,
                insulationRemainingLength,
                insulationExecutedLength: insulationTotalLength - insulationRemainingLength,
                componentStats
            };
        }

        const canvas = document.querySelector('canvas');
        if (canvas) {
            try {
                const dataUrl = canvas.toDataURL('image/png');
                setSceneScreenshot(dataUrl);
            } catch (e) {
                console.warn("Falha ao capturar screenshot do 3D:", e);
            }
        }
        
        setPdfExportStats(exportStats);
        await new Promise(r => setTimeout(r, 2000));

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        let currentY = 20;

        const capturePage = async (id: string) => {
            const el = document.getElementById(id);
            if (!el) {
                console.error(`Elemento ${id} não encontrado para PDF.`);
                return null;
            }
            try {
                return await html2canvas(el, { 
                    backgroundColor: '#0f172a', 
                    scale: 1.5, 
                    width: 1920, 
                    windowWidth: 1920,
                    useCORS: true,
                    allowTaint: false,
                    logging: true, // Enabled logging for debugging
                    imageTimeout: 15000,
                    onclone: (clonedDoc) => {
                        const elements = clonedDoc.getElementsByTagName('*');
                        for (let i = 0; i < elements.length; i++) {
                            const el = elements[i] as HTMLElement;
                            if (el.style && el.style.cssText.includes('oklch')) {
                                el.style.cssText = el.style.cssText.replace(/oklch\([^)]+\)/g, '#888888');
                            }
                        }
                        const style = clonedDoc.createElement('style');
                        style.innerHTML = `
                            * { color-interpolation: sRGB !important; }
                            #${id} { background-color: #0f172a !important; color: #f1f5f9 !important; }
                            .text-white { color: #ffffff !important; }
                            .text-blue-400 { color: #60a5fa !important; }
                            .text-slate-400 { color: #94a3b8 !important; }
                            .bg-slate-800\\/40 { background-color: rgba(30, 41, 59, 0.4) !important; }
                            .border-slate-700 { border-color: #334155 !important; }
                        `;
                        clonedDoc.head.appendChild(style);
                    }
                });
            } catch (err) {
                console.error(`Erro ao capturar ${id}:`, err);
                return null;
            }
        };

        const page1Canvas = await capturePage('export-page-1');
        if (page1Canvas) {
            const imgData = page1Canvas.toDataURL('image/png', 1.0);
            const imgProps = pdf.getImageProperties(imgData);
            let pdfImgHeight = (imgProps.height * pageWidth) / imgProps.width;
            let pdfImgWidth = pageWidth;
            if (pdfImgHeight > pageHeight) {
                pdfImgWidth = (imgProps.width * pageHeight) / imgProps.height;
                pdfImgHeight = pageHeight;
            }
            pdf.addImage(imgData, 'PNG', (pageWidth - pdfImgWidth) / 2, 0, pdfImgWidth, pdfImgHeight, undefined, 'FAST');
            console.log("Página 1 (Técnica) adicionada.");
        }

        pdf.addPage();
        const page2Canvas = await capturePage('export-page-2');
        if (page2Canvas) {
            const imgData = page2Canvas.toDataURL('image/png', 1.0);
            const imgProps = pdf.getImageProperties(imgData);
            let pdfImgHeight = (imgProps.height * pageWidth) / imgProps.width;
            let pdfImgWidth = pageWidth;
            if (pdfImgHeight > pageHeight) {
                pdfImgWidth = (imgProps.width * pageHeight) / imgProps.height;
                pdfImgHeight = pageHeight;
            }
            pdf.addImage(imgData, 'PNG', (pageWidth - pdfImgWidth) / 2, 0, pdfImgWidth, pdfImgHeight, undefined, 'FAST');
            console.log("Página 2 (Planejamento) adicionada.");
        }

        pdf.addPage();
        currentY = 20;

        if (currentY + 20 > pageHeight) { pdf.addPage(); currentY = 20; }
        pdf.setFontSize(9); pdf.setTextColor(100); pdf.text('Isometrico Manager - Software desenvolvido por Marconi Fabian', margin, currentY); currentY += 6;
        
        const isPlanning = viewMode === 'planning';
        pdf.setFontSize(16); pdf.setTextColor(isPlanning ? 120 : 0, isPlanning ? 50 : 0, isPlanning ? 240 : 0);
        pdf.text(isPlanning ? 'CRONOGRAMA DE CAMPO (SALDO REMANESCENTE)' : 'RELATÓRIO DE RASTREABILIDADE', margin, currentY); currentY += 8;
        pdf.setFontSize(11); pdf.setTextColor(0); pdf.text(`Local: ${projectLocation} | Cliente: ${projectClient} | Ref: ${activityDate.split('-').reverse().join('/')}`, margin, currentY); currentY += 10;
        
        if (exportStats.totalHH > 0) {
            pdf.setFontSize(10); pdf.setTextColor(50); pdf.setFont(undefined, 'bold');
            pdf.text(`SALDO PIPING: ${(exportStats.totalPipingHH || 0).toFixed(1)} h | SALDO ISOLAMENTO: ${(exportStats.totalInsulationHH || 0).toFixed(1)} h`, margin, currentY);
            currentY += 5;
            pdf.text(`TOTAL GERAL: ${(exportStats.totalHH || 0).toFixed(1)} Horas (Saldo) | Previsão de Término: ${exportStats.projectedEnd}`, margin, currentY);
            pdf.setFont(undefined, 'normal'); currentY += 10;
        }

        pdf.setFontSize(8); pdf.setFillColor(240, 240, 240); pdf.rect(margin, currentY, pageWidth - (margin * 2), 8, 'F');
        pdf.setTextColor(0); pdf.setFont(undefined, 'bold');
        const col1 = margin + 2, col2 = margin + 22, col3 = margin + 47, col4 = margin + 95, col5 = margin + 115, col6 = margin + 140, col7 = margin + 172;
        pdf.text("ID", col1, currentY + 5); pdf.text("Spool", col2, currentY + 5); pdf.text("Linha/Desc", col3, currentY + 5); pdf.text("Comp(m)", col4, currentY + 5); pdf.text("Status", col5, currentY + 5); pdf.text("Isolamento", col6, currentY + 5); 
        pdf.text(isPlanning ? "Saldo(H/H)" : "Nível Esf.", col7, currentY + 5);
        pdf.setFont(undefined, 'normal'); currentY += 10;

        pipesToExport.forEach((pipe) => {
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
            pdf.text((pipe.length || 0).toFixed(2), col4, currentY);
            
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
                pdf.text(((hh || 0).toFixed(2)) + " h", col7, currentY); 
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
        pipesToExport.forEach(p => {
            const entry = Object.entries(PIPE_DIAMETERS).find(([_, v]) => Math.abs(v - p.diameter) < 0.001);
            const label = entry ? entry[0] : `${(((p.diameter || 0) * 39.37).toFixed(1))}"`;
            bom[label] = (bom[label] || 0) + (p.length || 0);
        });
        
        Object.entries(bom).forEach(([label, length]) => {
            pdf.text(`• Tubo Aço Carbono ${label}: ${(length || 0).toFixed(2)} metros`, margin + 5, currentY);
            currentY += 5;
        });

        pdf.save(`relatorio-${isPlanning ? 'cronograma' : 'rastreabilidade'}.pdf`);
    } catch (err) { 
        console.error("Erro ao gerar PDF:", err);
        showToast("Erro ao gerar PDF: " + (err instanceof Error ? err.message : String(err)), 'error'); 
    } finally { 
        setIsExporting(false); 
        setPdfExportStats(null);
    }
  };

  // FUNÇÃO PARA EXPORTAR PARA EXCEL (XLSX)
  const handleExportExcel = () => {
    try {
        const pipesToExport = selectedIds.length > 0 ? pipes.filter(p => selectedIds.includes(p.id)) : pipes;

        const getDiameterLabel = (val: number) => {
            const entry = Object.entries(PIPE_DIAMETERS).find(([_, v]) => Math.abs(v - val) < 0.001);
            return entry ? entry[0] : `${(val * 39.37).toFixed(1)}"`;
        };

        const data = pipesToExport.map(p => {
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

            let supportsTotal = 0;
            let supportsInstalled = 0;
            
            let hasModernSupports = false;
            if (p.accessories) {
                p.accessories.forEach(a => {
                    const isPipeInstalled = p.status === 'MOUNTED' || p.status === 'WELDED' || p.status === 'HYDROTEST';
                    const isInstalled = a.status === AccessoryStatus.MOUNTED || isPipeInstalled;
                    if (a.type === 'SUPPORT') {
                        hasModernSupports = true;
                        supportsTotal += 1;
                        if (isInstalled) supportsInstalled += 1;
                    }
                });
            }

            if (p.supports && !hasModernSupports) {
                supportsTotal += (p.supports.total || 0);
                const isPipeInstalled = p.status === 'MOUNTED' || p.status === 'WELDED' || p.status === 'HYDROTEST';
                supportsInstalled += isPipeInstalled ? (p.supports.total || 0) : (p.supports.installed || 0);
            }

            return {
                'ID': p.id,
                'Spool': p.spoolId || '-',
                'Nome': p.name,
                'Diâmetro': getDiameterLabel(p.diameter),
                'Comprimento (m)': p.length.toFixed(2),
                'Status Montagem': STATUS_LABELS[p.status],
                'Isolamento': INSULATION_LABELS[p.insulationStatus || 'NONE'],
                'Suportes (Inst/Total)': `${supportsInstalled}/${supportsTotal}`,
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
        pipesToExport.forEach(p => { 
            const label = getDiameterLabel(p.diameter);
            bom[label] = (bom[label] || 0) + p.length; 
        });
        Object.entries(bom).forEach(([label, length]) => {
            bomData.push({ 'Material': `Tubo Aço Carbono ${label}`, 'Quantidade': length.toFixed(2), 'Unidade': 'Metros' });
        });
        const bomSheet = XLSX.utils.json_to_sheet(bomData);
        XLSX.utils.book_append_sheet(workbook, bomSheet, "Lista de Materiais");

        // Adicionar Resumo de Componentes
        const compSummary = {
            supports: { total: 0, installed: 0 }
        };
        pipesToExport.forEach(p => {
            let hasModernSupports = false;
            if (p.accessories) {
                p.accessories.forEach(a => {
                    const isPipeInstalled = p.status === 'MOUNTED' || p.status === 'WELDED' || p.status === 'HYDROTEST';
                    const isInstalled = a.status === AccessoryStatus.MOUNTED || isPipeInstalled;
                    if (a.type === 'SUPPORT') {
                        hasModernSupports = true;
                        compSummary.supports.total += 1;
                        if (isInstalled) compSummary.supports.installed += 1;
                    }
                });
            }

            if (p.supports && !hasModernSupports) { 
                compSummary.supports.total += (p.supports.total || 0); 
                const isPipeInstalled = p.status === 'MOUNTED' || p.status === 'WELDED' || p.status === 'HYDROTEST';
                compSummary.supports.installed += isPipeInstalled ? (p.supports.total || 0) : (p.supports.installed || 0); 
            }
        });

        const compData = [
            { 'Componente': 'Suportes', 'Total': compSummary.supports.total, 'Instalado': compSummary.supports.installed, 'Progresso': compSummary.supports.total > 0 ? `${((compSummary.supports.installed / compSummary.supports.total) * 100).toFixed(1)}%` : '0%' }
        ].filter(c => c.Total > 0);
        const compSheet = XLSX.utils.json_to_sheet(compData);
        XLSX.utils.book_append_sheet(workbook, compSheet, "Resumo de Componentes");

        XLSX.writeFile(workbook, `projeto-isometrico-${projectLocation.replace(/\s+/g, '-') || 'sem-nome'}.xlsx`);
        showToast("Excel exportado com sucesso!", 'success');
    } catch (err) {
        showToast("Erro ao exportar Excel.", 'error');
        console.error(err);
    }
  };

  const handleToggleProjectSelection = (id: string) => {
    setSelectedProjectIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  // Removido o bloqueio de login para acesso direto
  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
        {toast && (
            <div className={`fixed top-20 right-4 z-[120] px-6 py-3 rounded-xl shadow-2xl font-bold text-white animate-in fade-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                {toast.message}
            </div>
        )}
        {confirmNewProject && (
            <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4">
                <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-2xl max-w-md w-full">
                    <h3 className="text-xl font-bold text-white mb-2">Novo Projeto</h3>
                    <p className="text-slate-300 mb-6">
                        Deseja iniciar um novo projeto? Alterações não salvas serão perdidas.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setConfirmNewProject(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">Cancelar</button>
                        <button onClick={executeNewProject} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-colors">
                            Confirmar
                        </button>
                    </div>
                </div>
            </div>
        )}
        <DatabaseModal 
            isOpen={isDBModalOpen} 
            onClose={() => setIsDBModalOpen(false)} 
            projects={savedProjects} 
            onSave={handleDBAction_Save} 
            onLoad={handleDBAction_Load} 
            onDelete={handleDBAction_Delete}
            selectedProjectIds={selectedProjectIds}
            onToggleProjectSelection={handleToggleProjectSelection}
            currentProjectId={currentProjectId}
            currentProjectName={currentProjectName}
        />
        
        <TopNav 
            projectClient={projectClient}
            setProjectClient={setProjectClient}
            projectLocation={projectLocation}
            setProjectLocation={setProjectLocation}
            activityDate={activityDate}
            setActivityDate={setActivityDate}
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
            currentProjectName={currentProjectName}
            handleNewProject={handleNewProject}
            onOpenDailyProduction={() => setIsDailyProductionModalOpen(true)}
        />

        <DailyProductionModal 
            isOpen={isDailyProductionModalOpen}
            onClose={() => setIsDailyProductionModalOpen(false)}
            currentPipes={pipes}
            dailyProduction={dailyProduction}
            projectCalendar={projectCalendar}
            prodSettings={prodSettings}
            annotations={annotations}
            onSave={(data, calendar) => {
                setDailyProduction(data);
                setProjectCalendar(calendar);
                if (calendar.startDate) {
                    setActivityDate(calendar.startDate);
                }
                if (calendar.endDate) {
                    setDeadlineDate(calendar.endDate);
                }
                setIsDailyProductionModalOpen(false);
                setToast({ message: 'Produção diária calculada e salva!', type: 'success' });
                // Auto-save to DB if project exists
                if (currentProjectId && currentProjectName) {
                    handleDBAction_Save(currentProjectName, currentProjectId, { 
                        dailyProduction: data, 
                        projectCalendar: calendar, 
                        activityDate: calendar.startDate,
                        deadlineDate: calendar.endDate
                    });
                }
            }}
            projectStartDate={activityDate}
            projectEndDate={deadlineDate}
        />
        
        <main className="flex-1 relative overflow-hidden flex">
            {/* EXPORT CONTAINER HIDDEN */}
            <div className="absolute left-[-9999px] top-0">
                <ExportContainer 
                    viewMode={viewMode}
                    reportStats={pdfExportStats || reportStats}
                    sceneScreenshot={sceneScreenshot}
                    secondaryImage={secondaryImage}
                    mapImage={mapImage}
                    projectClient={projectClient}
                    projectLocation={projectLocation}
                    activityDate={activityDate}
                    pipes={pipes}
                    prodSettings={prodSettings}
                    startDate={activityDate}
                    dailyProduction={dailyProduction}
                    annotations={annotations}
                    deadlineDate={deadlineDate}
                />
            </div>

            <div className="flex-1 w-full h-full relative">
                <div id="scene-canvas-wrapper" className="absolute inset-0 bg-slate-900 z-0">
                    <div className="w-full h-full flex flex-col p-4">
                        <div className={`flex justify-between items-center mb-4 min-h-[48px] ${viewMode === 'dashboard' ? 'opacity-0 pointer-events-none' : ''}`}>
                            <div className="flex gap-4">
                                <button onClick={() => { setIsDrawing(!isDrawing); if(isDrawing) { setSelectedIds([]); setViewMode('3d'); }}} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-lg ${isDrawing ? 'bg-red-500 text-white' : 'bg-blue-600 text-white'}`}>{isDrawing ? <><XCircle size={18} /> PARAR</> : <><PenTool size={18} /> DESENHAR</>}</button>
                                {!isDrawing && (<><div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700"><button onClick={() => setColorMode('STATUS')} className={`px-3 py-1.5 text-xs font-bold rounded ${colorMode === 'STATUS' ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>Status</button><button onClick={() => setColorMode('SPOOL')} className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1 ${colorMode === 'SPOOL' ? 'bg-green-600 text-white' : 'text-slate-400'}`}><GridIcon size={14}/> Spools</button></div>
                                <button onClick={() => setDynamicZoom(!dynamicZoom)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${dynamicZoom ? 'bg-amber-600/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-900/20' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                    <Activity size={14} className={dynamicZoom ? 'animate-pulse' : ''} />
                                    ZOOM DINÂMICO {dynamicZoom ? 'ON' : 'OFF'}
                                </button>
                                {clipboard && clipboard.length > 0 && (<div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 items-center px-3 gap-2"><div className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1"><ClipboardPaste size={12}/> Copiado ({clipboard.length})</div><button onClick={handlePasteStart} className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-bold hover:bg-blue-500">Colar</button></div>)}</>)}
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
                            <Scene 
                                pipes={pipes} 
                                annotations={annotations} 
                                selectedIds={selectedIds} 
                                onSelectPipe={handleSelectPipe} 
                                onSetSelection={handleSetSelection} 
                                isDrawing={isDrawing} 
                                onAddPipe={handleAddPipe} 
                                onUpdatePipe={handleUpdateSinglePipe} 
                                onMovePipes={handleMovePipes} 
                                onCancelDraw={() => setIsDrawing(false)} 
                                fixedLength={fixedLengthValue} 
                                onAddAnnotation={handleAddAnnotation} 
                                onUpdateAnnotation={handleUpdateAnnotation} 
                                onDeleteAnnotation={handleDeleteAnnotation} 
                                onUndo={undo} 
                                onRedo={redo} 
                                colorMode={colorMode} 
                                pastePreview={pastePreview} 
                                onPasteMove={handlePasteMove} 
                                onPasteConfirm={handlePasteConfirm} 
                                snapAngle={snapAngle} 
                                onSetSnapAngle={setSnapAngle} 
                                currentDiameter={selectedDiameter} 
                                showDimensions={showDimensions} 
                                dynamicZoom={dynamicZoom} 
                                placementMode={placementMode}
                                onAddAccessory={handleAddAccessory}
                            />
                        </div>
                    </div>
                </div>
                {viewMode === 'dashboard' && (<div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-sm overflow-y-auto p-4 animate-in fade-in"><div className="max-w-[1600px] mx-auto h-full"><Dashboard pipes={pipes} annotations={annotations} onExportPDF={handleExportPDF} isExporting={isExporting} secondaryImage={secondaryImage} onUploadSecondary={setSecondaryImage} mapImage={mapImage} onUploadMap={setMapImage} sceneScreenshot={sceneScreenshot} onSelectPipe={handleSelectPipe} selectedIds={selectedIds} onSetSelection={handleSetSelection} prodSettings={prodSettings} startDate={activityDate} deadlineDate={deadlineDate} savedProjects={savedProjects} selectedProjectIds={selectedProjectIds} onSetSelectedProjectIds={setSelectedProjectIds} dailyProduction={dailyProduction} onUpdateDailyProduction={setDailyProduction} onOpenDailyProduction={() => setIsDailyProductionModalOpen(true)} /></div></div>)}
            </div>
            {selectedPipes.length > 0 && !isDrawing && !pastePreview && (
                <div className="w-96 relative z-20 shadow-2xl border-l border-slate-700">
                        <Sidebar 
                            selectedPipes={selectedPipes} 
                            onUpdateSingle={handleUpdateSinglePipe} 
                            onUpdateBatch={handleBatchUpdate} 
                            onDelete={handleDeleteSelected} 
                            onClose={() => setSelectedIds([])} 
                            mode={viewMode === 'planning' ? 'PLANNING' : 'TRACKING'} 
                            startDate={activityDate} 
                            prodSettings={prodSettings} 
                            onUpdateProdSettings={setProdSettings} 
                            onCopy={handleCopy} 
                            deadlineDate={deadlineDate} 
                            onUpdateDeadline={setDeadlineDate} 
                            placementMode={placementMode}
                            onSetPlacementMode={setPlacementMode}
                            onBatchAddSupports={handleBatchAddSupports}
                            onBatchUpdateSupportStatus={handleBatchUpdateSupportStatus}
                            onClearAccessories={handleClearAccessories}
                            onClearAllAccessories={handleClearAllAccessories}
                            onJoinPipes={handleJoinPipes}
                        />
                </div>
            )}
        </main>
    </div>
  );
}
