
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Scene from './components/3d/Scene';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import { DatabaseModal } from './components/DatabaseModal';
import { saveProjectToDB, getAllProjects, deleteProjectFromDB } from './utils/db';
import { INITIAL_PIPES, STATUS_LABELS, STATUS_COLORS, INSULATION_LABELS, PIPE_DIAMETERS, AVAILABLE_DIAMETERS, ALL_STATUSES, ALL_INSULATION_STATUSES, INSULATION_COLORS, BASE_PRODUCTIVITY, DIFFICULTY_WEIGHTS } from './constants';
import { PipeSegment, PipeStatus, Annotation, Accessory, AccessoryType, ProductivitySettings } from './types';
import { LayoutDashboard, Cuboid, PenTool, XCircle, FileDown, Save, FolderOpen, FilePlus, Loader2, MapPin, Database, Undo, Redo, Wrench, Grid as GridIcon, CircleDot, MousePointer2, Ruler, Calendar, Lock, User, LogOut, ChevronRight, UserPlus, ShieldAlert, Check, X, Users, CircleDashed, Copy, ClipboardPaste, Activity, Package, AlertCircle, Image as ImageIcon, Shield, Building2, Timer, FileCode } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// --- TYPES FOR AUTH SYSTEM ---
type UserRole = 'ADMIN' | 'USER';
type UserStatus = 'APPROVED' | 'PENDING' | 'REJECTED';

interface UserAccount {
    username: string;
    password: string;
    role: UserRole;
    status: UserStatus;
    createdAt: string;
}

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

// --- ADMIN USER MANAGEMENT MODAL ---
interface UserManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    users: UserAccount[];
    onApprove: (username: string) => void;
    onReject: (username: string) => void;
    onDelete: (username: string) => void;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose, users, onApprove, onReject, onDelete }) => {
    if (!isOpen) return null;
    const pendingUsers = users.filter(u => u.status === 'PENDING');
    const activeUsers = users.filter(u => u.status === 'APPROVED');
    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg"><Users className="text-white" size={24} /></div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Gestão de Acessos</h2>
                            <p className="text-slate-400 text-sm">Aprovar ou remover usuários</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={24} /></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    <div>
                        <h3 className="text-yellow-400 font-bold uppercase text-xs tracking-wider mb-3 flex items-center gap-2"><ShieldAlert size={14} /> Solicitações Pendentes ({pendingUsers.length})</h3>
                        {pendingUsers.length === 0 ? (<p className="text-slate-500 text-sm italic bg-slate-950/50 p-3 rounded">Nenhuma solicitação pendente.</p>) : (
                            <div className="space-y-2">{pendingUsers.map(user => (<div key={user.username} className="bg-slate-800 p-3 rounded-lg flex items-center justify-between border border-yellow-500/20"><div><p className="font-bold text-white">{user.username}</p><p className="text-xs text-slate-400">Solicitado em: {new Date(user.createdAt).toLocaleDateString()}</p></div><div className="flex gap-2"><button onClick={() => onApprove(user.username)} className="bg-green-600 hover:bg-green-500 text-white p-2 rounded-lg" title="Aprovar"><Check size={16}/></button><button onClick={() => onReject(user.username)} className="bg-red-600 hover:bg-red-500 text-white p-2 rounded-lg" title="Rejeitar"><X size={16}/></button></div></div>))}</div>
                        )}
                    </div>
                    <div className="border-t border-slate-700"></div>
                    <div>
                        <h3 className="text-blue-400 font-bold uppercase text-xs tracking-wider mb-3 flex items-center gap-2"><Check size={14} /> Usuários Ativos ({activeUsers.length})</h3>
                        <div className="space-y-2">{activeUsers.map(user => (<div key={user.username} className="bg-slate-950 p-3 rounded-lg flex items-center justify-between border border-slate-800"><div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full ${user.role === 'ADMIN' ? 'bg-purple-500' : 'bg-blue-500'}`}></div><div><p className="font-bold text-slate-200">{user.username} {user.role === 'ADMIN' && <span className="text-[10px] bg-purple-900/50 text-purple-300 px-1 rounded ml-1">ADMIN</span>}</p><p className="text-xs text-slate-500">Cadastrado em: {new Date(user.createdAt).toLocaleDateString()}</p></div></div>{user.role !== 'ADMIN' && (<button onClick={() => onDelete(user.username)} className="text-slate-600 hover:text-red-500 transition-colors p-2" title="Remover Acesso"><X size={16}/></button>)}</div>))}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- LOGIN COMPONENT ---
interface LoginProps {
    onLogin: (user: UserAccount) => void;
    users: UserAccount[];
    onRegister: (u: UserAccount) => void;
}

const LoginScreen: React.FC<LoginProps> = ({ onLogin, users, onRegister }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(''); setSuccessMsg('');
        if (isRegistering) {
            if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) { setError('Este nome de usuário já existe.'); return; }
            if (password.length < 4) { setError('A senha deve ter pelo menos 4 caracteres.'); return; }
            onRegister({ username, password, role: 'USER', status: 'PENDING', createdAt: new Date().toISOString() });
            setSuccessMsg('Solicitação enviada! Aguarde a aprovação do administrador.'); setIsRegistering(false); setUsername(''); setPassword('');
        } else {
            const user = users.find(u => u.username === username && u.password === password);
            if (user) {
                if (user.status === 'APPROVED') { onLogin(user); } 
                else if (user.status === 'PENDING') { setError('Sua conta ainda está aguardando aprovação do administrador.'); } 
                else { setError('Seu acesso foi negado pelo administrador.'); }
            } else { setError('Usuário ou senha incorretos.'); }
        }
    };
    return (
        <div className="h-screen w-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950"></div>
            <div className="z-10 w-full max-w-md p-8 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl animate-in fade-in zoom-in duration-500">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-blue-600 p-4 rounded-xl shadow-lg shadow-blue-500/20 mb-4"><Cuboid className="text-white" size={40} /></div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Isometrico Manager</h1>
                    <p className="text-slate-400 text-sm mt-1">Software por Marconi Fabian</p>
                </div>
                <h2 className="text-center text-white font-bold text-lg mb-4">{isRegistering ? 'Solicitar Acesso' : 'Login'}</h2>
                {successMsg && <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs p-3 rounded-lg text-center font-bold mb-4">{successMsg}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Usuário</label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Usuário" required /></div></div>
                    <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 ml-1">Senha</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Senha" required /></div></div>
                    {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg text-center font-bold">{error}</div>}
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 group mt-2">{isRegistering ? 'Enviar Solicitação' : 'Acessar Sistema'} <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" /></button>
                </form>
                <div className="mt-6 text-center"><button onClick={() => { setIsRegistering(!isRegistering); setError(''); setSuccessMsg(''); }} className="text-sm text-slate-400 hover:text-white underline underline-offset-4 transition-colors">{isRegistering ? 'Já tenho conta? Fazer Login' : 'Não tem conta? Solicitar Acesso'}</button></div>
            </div>
        </div>
    );
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
  const [userDB, setUserDB] = useState<UserAccount[]>(() => {
      try {
          const saved = localStorage.getItem('iso-manager-users');
          if (saved) return JSON.parse(saved);
          return [
              { username: 'Marconi Fabian', password: '2905', role: 'ADMIN', status: 'APPROVED', createdAt: new Date().toISOString() },
              { username: 'Inspetor', password: 'iso123', role: 'USER', status: 'APPROVED', createdAt: new Date().toISOString() }
          ];
      } catch { return [{ username: 'Marconi Fabian', password: '2905', role: 'ADMIN', status: 'APPROVED', createdAt: new Date().toISOString() }]; }
  });
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  useEffect(() => { localStorage.setItem('iso-manager-users', JSON.stringify(userDB)); }, [userDB]);

  const handleRegister = (newUser: UserAccount) => setUserDB(prev => [...prev, newUser]);
  const handleApproveUser = (username: string) => setUserDB(prev => prev.map(u => u.username === username ? { ...u, status: 'APPROVED' } : u));
  const handleRejectUser = (username: string) => setUserDB(prev => prev.map(u => u.username === username ? { ...u, status: 'REJECTED' } : u));
  const handleDeleteUser = (username: string) => { if (username === 'Marconi Fabian') return alert("O Administrador principal não pode ser removido."); setUserDB(prev => prev.filter(u => u.username !== username)); };

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

  useEffect(() => {
      if (fixedLengthValue === 0) setFixedLengthText('');
      else if (parseFloat(fixedLengthText.replace(',', '.')) !== fixedLengthValue) setFixedLengthText(fixedLengthValue.toString().replace('.', ','));
  }, [fixedLengthValue]);

  const selectedPipes = useMemo(() => pipes.filter(p => selectedIds.includes(p.id)), [pipes, selectedIds]);

  const reportStats = useMemo(() => {
      const totalLength = pipes.reduce((acc, p) => acc + (p?.length || 0), 0);
      const totalPipes = pipes.length;
      const pipeCounts: Record<string, number> = {};
      ALL_STATUSES.forEach(s => pipeCounts[s] = 0);
      pipes.forEach(p => { if (p.status) pipeCounts[p.status] = (pipeCounts[p.status] || 0) + 1; });
      const insulationCounts: Record<string, number> = {};
      ALL_INSULATION_STATUSES.forEach(s => insulationCounts[s] = 0);
      pipes.forEach(p => { const s = p.insulationStatus || 'NONE'; insulationCounts[s] = (insulationCounts[s] || 0) + 1; });
      const bom: Record<string, number> = {};
      pipes.forEach(p => { const inches = Math.round(p.diameter * 39.37); const label = `${inches}"`; bom[label] = (bom[label] || 0) + p.length; });
      const progress = totalPipes > 0 ? (((pipeCounts['WELDED'] * 0.8) + (pipeCounts['HYDROTEST'] * 1.0) + (pipeCounts['MOUNTED'] * 0.3)) / totalPipes) * 100 : 0;

      // ESTIMATION LOGIC - SALDO REMANESCENTE (HORAS A EXECUTAR)
      let totalPipingHH = 0;
      let totalInsulationHH = 0;
      let totalHH = 0;

      pipes.forEach(p => {
          const pipingFactor = PIPING_REMAINING_FACTOR[p.status] || 0;
          const insulationFactor = INSULATION_REMAINING_FACTOR[p.insulationStatus || 'NONE'] || 0;
          
          const pipeBase = (p.length * prodSettings.pipingBase) * pipingFactor;
          const insBase = (p.length * prodSettings.insulationBase) * insulationFactor;
          
          const factors = p.planningFactors;
          let multiplier = 1.0; 
          let delays = 0;

          if (factors) {
              if (factors.hasCrane) multiplier += prodSettings.weights.crane;
              if (factors.hasBlockage) multiplier += prodSettings.weights.blockage;
              if (factors.isNightShift) multiplier += prodSettings.weights.nightShift;
              if (factors.isCriticalArea) multiplier += prodSettings.weights.criticalArea;
              if (factors.accessType === 'SCAFFOLD_FLOOR') multiplier += prodSettings.weights.scaffoldFloor;
              if (factors.accessType === 'SCAFFOLD_HANGING') multiplier += prodSettings.weights.scaffoldHanging;
              if (factors.accessType === 'PTA') multiplier += prodSettings.weights.pta;
              delays = factors.delayHours || 0;
          }

          const pipeFinal = (pipeBase * multiplier);
          const insFinal = (insBase * multiplier);
          
          totalPipingHH += pipeFinal;
          totalInsulationHH += insFinal;
          totalHH += pipeFinal + insFinal + delays;
      });

      const daysNeeded = Math.ceil(totalHH / 8.8);
      const end = getWorkingEndDate(new Date(activityDate + 'T12:00:00'), daysNeeded);
      return { 
          pipeCounts, insulationCounts, total: totalPipes, totalLength, progress, bom, 
          totalHH, totalPipingHH, totalInsulationHH, projectedEnd: end.toLocaleDateString('pt-BR') 
      };
  }, [pipes, activityDate, prodSettings]);

  useEffect(() => { localStorage.setItem('iso-manager-pipes', JSON.stringify(pipes)); }, [pipes]);
  useEffect(() => { localStorage.setItem('iso-manager-annotations', JSON.stringify(annotations)); }, [annotations]);
  useEffect(() => { if (isDBModalOpen) { getAllProjects().then(setSavedProjects); } }, [isDBModalOpen]);

  const handleSwitchToDashboard = () => {
      const canvas = document.querySelector('canvas');
      if (canvas) { try { setSceneScreenshot(canvas.toDataURL('image/png')); } catch(e) { console.error(e); } }
      setViewMode('dashboard'); setIsDrawing(false);
  };
  const handleNewProject = () => { if (confirm('Novo projeto? Dados não salvos serão perdidos.')) { setPipes([]); setAnnotations([]); setSelectedIds([]); setSecondaryImage(null); setMapImage(null); } };
  const handleDBAction_Save = async (name: string) => { await saveProjectToDB({ id: crypto.randomUUID(), name, updatedAt: new Date(), pipes, annotations, location: projectLocation, client: projectClient, secondaryImage, mapImage }); getAllProjects().then(setSavedProjects); };
  const handleDBAction_Load = (project: any) => { setPipes(project.pipes || []); setAnnotations(project.annotations || []); setProjectLocation(project.location || ''); setProjectClient(project.client || 'VALE'); setSecondaryImage(project.secondaryImage || null); setMapImage(project.mapImage || null); setSelectedIds([]); setIsDBModalOpen(false); };
  const handleDBAction_Delete = async (id: string) => { await deleteProjectFromDB(id); getAllProjects().then(setSavedProjects); };
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

  // FUNÇÃO PARA EXPORTAR PARA CAD (DXF)
  const handleExportDXF = () => {
    let dxf = "0\nSECTION\n2\nENTITIES\n";
    pipes.forEach(p => {
        // Criar uma LINE no DXF
        dxf += "0\nLINE\n8\nTubulacao\n"; // Layer
        dxf += `10\n${p.start.x}\n20\n${p.start.y}\n30\n${p.start.z}\n`; // Start Point
        dxf += `11\n${p.end.x}\n21\n${p.end.y}\n31\n${p.end.z}\n`; // End Point
    });
    dxf += "0\nENDSEC\n0\nEOF";

    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `projeto-isometrico-${projectLocation.replace(/\s+/g, '-')}.dxf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
        if (viewMode !== 'dashboard') {
            const canvas = document.querySelector('canvas');
            if (canvas) setSceneScreenshot(canvas.toDataURL('image/png'));
            await new Promise(r => setTimeout(r, 200));
        }
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth(), pageHeight = pdf.internal.pageSize.getHeight(), margin = 10;
        let currentY = 20;

        const dashboardEl = document.getElementById('composed-dashboard-export');
        await new Promise(r => setTimeout(r, 600));
        if (dashboardEl) {
             const canvas = await html2canvas(dashboardEl, { backgroundColor: '#0f172a', scale: 1.5, width: 1920, windowWidth: 1920 });
             const imgData = canvas.toDataURL('image/png');
             const imgProps = pdf.getImageProperties(imgData);
             const pdfImgWidth = pageWidth;
             const pdfImgHeight = (imgProps.height * pdfImgWidth) / imgProps.width;
             pdf.addImage(imgData, 'PNG', 0, 0, pdfImgWidth, pdfImgHeight);
             if (pdfImgHeight > pageHeight - 30) { pdf.addPage(); currentY = 20; } else { currentY = pdfImgHeight + 10; }
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

        pdf.setFontSize(8); pdf.setFillColor(240); pdf.rect(margin, currentY, pageWidth - (margin * 2), 8, 'F');
        pdf.setTextColor(0); pdf.setFont(undefined, 'bold');
        const col1 = margin + 2, col2 = margin + 22, col3 = margin + 47, col4 = margin + 95, col5 = margin + 115, col6 = margin + 140, col7 = margin + 172;
        pdf.text("ID", col1, currentY + 5); pdf.text("Spool", col2, currentY + 5); pdf.text("Linha/Desc", col3, currentY + 5); pdf.text("Comp(m)", col4, currentY + 5); pdf.text("Status", col5, currentY + 5); pdf.text("Isolamento", col6, currentY + 5); 
        pdf.text(isPlanning ? "Saldo(H/H)" : "Nível Esf.", col7, currentY + 5);
        pdf.setFont(undefined, 'normal'); currentY += 10;

        pipes.forEach((pipe) => {
            if (currentY > pageHeight - 15) { pdf.addPage(); currentY = 20; pdf.setFillColor(240); pdf.rect(margin, currentY, pageWidth - (margin * 2), 8, 'F'); pdf.setFont(undefined, 'bold'); pdf.text("ID", col1, currentY+5); pdf.text(isPlanning ? "Saldo(H/H)" : "Nível Esf.", col7, currentY+5); pdf.setFont(undefined, 'normal'); currentY += 10; }
            const statusLabel = STATUS_LABELS[pipe.status] || pipe.status;
            const statusRgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(STATUS_COLORS[pipe.status] || '#999')!;
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

            pdf.setTextColor(0); pdf.setFontSize(7); pdf.text(pipe.id, col1, currentY); pdf.text(pipe.spoolId || '-', col2, currentY); pdf.text(pipe.name.substring(0, 22), col3, currentY); pdf.text(pipe.length.toFixed(2), col4, currentY);
            pdf.setFillColor(parseInt(statusRgb[1],16), parseInt(statusRgb[2],16), parseInt(statusRgb[3],16)); pdf.roundedRect(col5-1, currentY-3, pdf.getTextWidth(statusLabel)+4, 5, 1, 1, 'F'); pdf.setTextColor(255); pdf.setFont(undefined, 'bold'); pdf.text(statusLabel, col5+1, currentY);
            pdf.setTextColor(0); pdf.setFont(undefined, 'normal'); pdf.text(insLabel, col6, currentY); 
            if (isPlanning) { pdf.text(hh.toFixed(2) + " h", col7, currentY); } 
            else { const esf = pipe.planningFactors?.accessType === 'NONE' ? 'NÍVEL 0' : (pipe.planningFactors?.accessType || 'NÍVEL 0'); pdf.text(esf, col7, currentY); }
            pdf.setDrawColor(230); pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2); currentY += 7;
        });
        pdf.save(`relatorio-${isPlanning ? 'cronograma' : 'rastreabilidade'}.pdf`);
    } catch (err) { alert("Erro PDF."); } finally { setIsExporting(false); }
  };

  if (!currentUser) return <LoginScreen onLogin={setCurrentUser} users={userDB} onRegister={handleRegister} />;

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans">
        <DatabaseModal isOpen={isDBModalOpen} onClose={() => setIsDBModalOpen(false)} projects={savedProjects} onSave={handleDBAction_Save} onLoad={handleDBAction_Load} onDelete={handleDBAction_Delete} />
        <UserManagementModal isOpen={isAdminPanelOpen} onClose={() => setIsAdminPanelOpen(false)} users={userDB} onApprove={handleApproveUser} onReject={handleRejectUser} onDelete={handleDeleteUser} />
        <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-50">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3"><div className="bg-blue-600 p-2 rounded-lg"><Cuboid className="text-white" size={24} /></div><div><h1 className="font-bold text-xl leading-none">Isometrico Manager</h1><p className="text-[10px] text-slate-400">Software por Marconi Fabian</p></div></div>
                <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 px-3 rounded-lg border border-slate-700/50">
                     <div className="flex flex-col"><label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Building2 size={10} /> Cliente</label><input type="text" value={projectClient} onChange={(e) => setProjectClient(e.target.value)} className="text-sm font-bold bg-transparent border-none text-white focus:ring-0 w-32 uppercase p-0" /></div>
                     <div className="h-8 w-px bg-slate-700/50 mx-2"></div>
                     <div className="flex flex-col"><label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><MapPin size={10} /> Local</label><input type="text" value={projectLocation} onChange={(e) => setProjectLocation(e.target.value)} className="text-sm font-bold bg-transparent border-none text-white focus:ring-0 w-48 uppercase p-0" /></div>
                     <div className="h-8 w-px bg-slate-700/50 mx-2"></div>
                     <div className="flex flex-col"><label className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1"><Calendar size={10} /> Início (Saldo)</label><input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} className="text-sm font-bold bg-transparent border-none text-white focus:ring-0 p-0 [color-scheme:dark]" /></div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end mr-2"><span className="text-[10px] text-slate-500 font-bold uppercase">USUÁRIO</span><span className="text-sm font-bold text-blue-400 leading-none">{currentUser.username}</span></div>
                {currentUser.role === 'ADMIN' && <button onClick={() => setIsAdminPanelOpen(true)} className="p-2 bg-purple-900/40 border border-purple-500/30 rounded-lg text-purple-300 relative"><Users size={18} /></button>}
                <button onClick={() => setCurrentUser(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"><LogOut size={18} /></button>
                <div className="h-6 w-px bg-slate-700 mx-1"></div>
                <button onClick={() => setIsDBModalOpen(true)} className="bg-blue-900/40 hover:bg-blue-800 text-blue-300 border border-blue-500/30 px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Database size={16} /> Banco de Dados</button>
                <div className="bg-slate-800 p-1 rounded-lg flex gap-1 border border-slate-700">
                    <button onClick={() => { setViewMode('3d'); setIsDrawing(false); }} className={`px-3 py-1.5 text-xs font-bold rounded ${viewMode === '3d' && !isDrawing ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:text-white'}`} title="Vista 3D"><Cuboid size={16}/></button>
                    <button onClick={() => { setViewMode('planning'); setIsDrawing(false); }} className={`px-3 py-1.5 text-xs font-bold rounded ${viewMode === 'planning' ? 'bg-slate-700 text-purple-400' : 'text-slate-400 hover:text-white'}`} title="Planejamento 4D"><Timer size={16}/></button>
                    <button onClick={handleSwitchToDashboard} className={`px-3 py-1.5 text-xs font-bold rounded ${viewMode === 'dashboard' ? 'bg-slate-700 text-blue-400' : 'text-slate-400 hover:text-white'}`} title="Dashboard"><LayoutDashboard size={16}/></button>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExportDXF} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm uppercase tracking-tighter" title="Exportar para AutoCAD (3D DXF)"><FileCode size={16}/> Exportar CAD</button>
                    <button onClick={handleExportPDF} disabled={isExporting} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm uppercase tracking-tighter">{isExporting ? <Loader2 className="animate-spin" size={16}/> : <FileDown size={16}/>} Gerar PDF</button>
                </div>
            </div>
        </header>

        <main className="flex-1 relative overflow-hidden flex">
            {/* EXPORT CONTAINER HIDDEN */}
            <div id="composed-dashboard-export" style={{ position: 'fixed', top: 0, left: '-5000px', width: '1920px', minHeight: '1080px', zIndex: -50, backgroundColor: '#0f172a', padding: '60px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '40px' }}>
                 <div className="flex justify-between items-start border-b border-slate-700 pb-6"><div><h1 className="text-6xl font-bold text-white tracking-tight leading-none mb-2 uppercase">{viewMode === 'planning' ? 'CRONOGRAMA DE ATAQUE (SALDO)' : 'RASTREABILIDADE FÍSICA'}</h1><p className="text-slate-400 text-xl font-medium tracking-widest uppercase">Trabalho Pendente e Prazos de Execução</p></div><div className="text-right text-2xl font-light text-slate-400 tracking-[0.2em] uppercase">Marconi Fabian - Isometrico Manager</div></div>
                 <div className="grid grid-cols-5 gap-6">
                    <div className="bg-slate-800/40 border border-slate-700 p-6 rounded-2xl flex flex-col items-center"><Ruler className="text-blue-400 mb-2" size={32} /><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Metros</span><div className="text-4xl font-bold text-white">{reportStats.totalLength.toFixed(2)}m</div></div>
                    <div className="bg-slate-800/40 border border-slate-700 p-6 rounded-2xl flex flex-col items-center"><Wrench className="text-blue-300 mb-2" size={32} /><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Saldo Piping</span><div className="text-4xl font-bold text-white">{reportStats.totalPipingHH.toFixed(1)}h</div></div>
                    <div className="bg-slate-800/40 border border-slate-700 p-6 rounded-2xl flex flex-col items-center"><Shield className="text-purple-400 mb-2" size={32} /><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Saldo Isolamento</span><div className="text-4xl font-bold text-white">{reportStats.totalInsulationHH.toFixed(1)}h</div></div>
                    <div className="bg-slate-800/40 border border-slate-700 p-6 rounded-2xl flex flex-col items-center"><Timer className="text-purple-300 mb-2" size={32} /><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Saldo</span><div className="text-4xl font-bold text-white">{reportStats.totalHH.toFixed(1)}h</div></div>
                    <div className="bg-slate-800/40 border border-slate-700 p-6 rounded-2xl flex flex-col items-center"><Calendar className="text-green-400 mb-2" size={32} /><span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Término Projetado</span><div className="text-3xl font-bold text-green-400 mt-1">{reportStats.totalHH > 0 ? reportStats.projectedEnd : 'CONCLUÍDO'}</div></div>
                 </div>
                 <div className="grid grid-cols-2 gap-8 flex-1">
                    <div className="flex flex-col gap-2"><h3 className="text-xl font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><Cuboid size={20}/> Vista Principal 3D</h3><div className="flex-1 bg-slate-800/50 rounded-xl border border-slate-700 relative overflow-hidden flex items-center justify-center p-2 min-h-[450px]">{sceneScreenshot ? <img src={sceneScreenshot} className="w-full h-full object-cover rounded-lg" /> : <div className="text-slate-600 flex flex-col items-center"><Cuboid size={64} className="opacity-50"/><span>Sem Captura</span></div>}</div></div>
                    <div className="flex flex-col gap-2"><h3 className="text-xl font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><ImageIcon size={20}/> Registro Fotográfico</h3><div className="flex-1 bg-slate-800/50 rounded-xl border border-slate-700 relative overflow-hidden flex items-center justify-center p-2 min-h-[450px]">{secondaryImage ? <img src={secondaryImage} className="w-full h-full object-cover rounded-lg" /> : <div className="text-slate-600 flex flex-col items-center"><span>Sem Foto</span></div>}</div></div>
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2"><h3 className="text-xl font-bold text-slate-300 uppercase tracking-wider">Dados da Obra</h3><div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6"><table className="w-full text-xl text-left"><tbody className="divide-y divide-slate-700/50"><tr><td className="py-3 text-slate-400 font-bold uppercase w-1/3">Cliente</td><td className="py-3 text-white uppercase font-bold text-blue-400">{projectClient}</td></tr><tr><td className="py-3 text-slate-400 font-bold uppercase">Área/Setor</td><td className="py-3 text-white uppercase font-medium">{projectLocation}</td></tr><tr><td className="py-3 text-slate-400 font-bold uppercase">Data Ref.</td><td className="py-3 text-white font-medium">{activityDate.split('-').reverse().join('/')}</td></tr></tbody></table></div></div>
                        <div className="flex flex-col gap-2 flex-1"><h3 className="text-xl font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><Package size={20}/> Quantitativos (BOM)</h3><div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden"><table className="w-full text-xl text-left"><thead className="bg-slate-900/80 text-slate-400 uppercase text-sm font-bold"><tr><th className="p-4">Descrição Material</th><th className="p-4 text-right">Qtd.</th><th className="p-4 text-center">Unid.</th></tr></thead><tbody className="divide-y divide-slate-700/50">{Object.entries(reportStats.bom).map(([label, length]) => (<tr key={label}><td className="p-4 text-white font-medium">Tubo Aço Carbono <span className="text-blue-400 font-bold">{label}</span></td><td className="p-4 text-right font-mono text-white">{(length as number).toFixed(2)}</td><td className="p-4 text-center text-slate-500">Metros</td></tr>))}</tbody></table></div></div>
                    </div>
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2"><h3 className="text-xl font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><MapPin size={20}/> Localização em Planta</h3><div className="bg-slate-800/50 rounded-xl border border-slate-700 p-2 min-h-[250px] relative overflow-hidden flex items-center justify-center">{mapImage ? <img src={mapImage} className="w-full h-full object-cover rounded-lg opacity-80" /> : <div className="text-slate-600">Sem Mapa</div>}</div></div>
                        <div className="flex flex-col gap-2"><h3 className="text-xl font-bold text-slate-300 uppercase tracking-wider">Status Físico de Obra</h3><div className="grid grid-cols-2 gap-4"><div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 h-[250px] flex flex-col"><div className="text-xs font-bold text-blue-400 uppercase mb-2 text-center">Montagem/Solda</div><div className="flex-1 flex items-end justify-around gap-2">{ALL_STATUSES.map(status => { const h = (reportStats.pipeCounts[status] / Math.max(1, reportStats.total)) * 100; return (<div key={status} className="flex flex-col items-center flex-1 h-full justify-end"><span className="text-white font-bold text-[10px] mb-1">{reportStats.pipeCounts[status]}</span><div className="w-full rounded-t-sm opacity-80" style={{ height: `${Math.max(h, 5)}%`, backgroundColor: STATUS_COLORS[status] }}></div><span className="text-[8px] text-slate-500 font-bold uppercase text-center mt-1 truncate w-full">{STATUS_LABELS[status].split(' ')[0]}</span></div>)})}</div></div><div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 h-[250px] flex flex-col"><div className="text-xs font-bold text-purple-400 uppercase mb-2 text-center">Isolamento</div><div className="flex-1 flex items-end justify-around gap-2">{ALL_INSULATION_STATUSES.map(status => { const h = (reportStats.insulationCounts[status] / Math.max(1, reportStats.total)) * 100; const c = INSULATION_COLORS[status] === 'transparent' ? '#475569' : INSULATION_COLORS[status]; return (<div key={status} className="flex flex-col items-center flex-1 h-full justify-end"><span className="text-white font-bold text-[10px] mb-1">{reportStats.insulationCounts[status]}</span><div className="w-full rounded-t-sm opacity-80" style={{ height: `${Math.max(h, 5)}%`, backgroundColor: c }}></div><span className="text-[8px] text-slate-500 font-bold uppercase text-center mt-1 truncate w-full">{INSULATION_LABELS[status].split(' ')[0]}</span></div>)})}</div></div></div></div>
                    </div>
                 </div>
                 <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between text-slate-500 font-mono text-lg"><span>Relatório Automático Isometrico Manager - Marconi Fabian</span><span>Página 1 de 2</span></div>
            </div>

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
                            <Scene pipes={pipes} annotations={annotations} selectedIds={selectedIds} onSelectPipe={handleSelectPipe} onSetSelection={handleSetSelection} isDrawing={isDrawing} onAddPipe={handleAddPipe} onUpdatePipe={handleUpdateSinglePipe} onMovePipes={handleMovePipes} onCancelDraw={() => setIsDrawing(false)} fixedLength={fixedLengthValue} onAddAnnotation={handleAddAnnotation} onUpdateAnnotation={handleUpdateAnnotation} onDeleteAnnotation={handleDeleteAnnotation} onUndo={undo} onRedo={redo} colorMode={colorMode} pastePreview={pastePreview} onPasteMove={handlePasteMove} onPasteConfirm={handlePasteConfirm} />
                        </div>
                    </div>
                </div>
                {viewMode === 'dashboard' && (<div className="absolute inset-0 z-10 bg-slate-950/95 backdrop-blur-sm overflow-y-auto p-4 animate-in fade-in"><div className="max-w-[1600px] mx-auto h-full"><Dashboard pipes={pipes} onExportPDF={handleExportPDF} isExporting={isExporting} secondaryImage={secondaryImage} onUploadSecondary={setSecondaryImage} mapImage={mapImage} onUploadMap={setMapImage} sceneScreenshot={sceneScreenshot} onSelectPipe={handleSelectPipe} selectedIds={selectedIds} onSetSelection={handleSetSelection} /></div></div>)}
            </div>
            {selectedPipes.length > 0 && !isDrawing && !pastePreview && (
                <div className="w-96 relative z-20 shadow-2xl border-l border-slate-700">
                    <Sidebar selectedPipes={selectedPipes} onUpdateSingle={handleUpdateSinglePipe} onUpdateBatch={handleBatchUpdate} onDelete={handleDeleteSelected} onClose={() => setSelectedIds([])} mode={viewMode === 'planning' ? 'PLANNING' : 'TRACKING'} startDate={activityDate} prodSettings={prodSettings} onUpdateProdSettings={setProdSettings} />
                </div>
            )}
        </main>
    </div>
  );
}
