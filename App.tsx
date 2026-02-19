
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Scene from './components/3d/Scene';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import { DatabaseModal } from './components/DatabaseModal';
import { saveProjectToDB, getAllProjects, deleteProjectFromDB, getAllUsers, registerUserDB } from './utils/db';
import { INITIAL_PIPES, STATUS_LABELS, STATUS_COLORS, INSULATION_LABELS, BASE_PRODUCTIVITY, DIFFICULTY_WEIGHTS } from './constants';
import { PipeSegment, PipeStatus, Annotation, ProductivitySettings } from './types';
import { LayoutDashboard, Cuboid, PenTool, XCircle, FileDown, Database, Loader2, LogOut, ShieldAlert, AlertTriangle, CloudOff, Cloud } from 'lucide-react';
import { isSupabaseConfigured } from './utils/supabaseClient';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const PIPING_REMAINING_FACTOR: Record<string, number> = { 'PENDING': 1.0, 'MOUNTED': 0.7, 'WELDED': 0.15, 'HYDROTEST': 0.0 };
const INSULATION_REMAINING_FACTOR: Record<string, number> = { 'NONE': 0.0, 'PENDING': 1.0, 'INSTALLING': 0.5, 'FINISHED': 0.0 };

const getWorkingEndDate = (startDate: Date, daysNeeded: number): Date => {
    let result = new Date(startDate);
    let addedDays = 0;
    let daysToTarget = daysNeeded > 0 ? daysNeeded - 1 : 0;
    while (addedDays < daysToTarget) {
        result.setDate(result.getDate() + 1);
        const dow = result.getDay();
        if (dow !== 0 && dow !== 6) addedDays++;
    }
    while (result.getDay() === 0 || result.getDay() === 6) result.setDate(result.getDate() + 1);
    return result;
};

const LoginScreen = ({ onLogin, users, onRegister, isLoading }: any) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setError('');
        
        const user = users.find((u: any) => u.username === username && u.password === password);
        if (user) {
            if (user.status === 'APPROVED') onLogin(user);
            else setError('Aguardando aprovação.');
        } else if (username === 'Marconi Fabian' && password === '2905') {
            onLogin({ username: 'Marconi Fabian', password: '2905', role: 'ADMIN', status: 'APPROVED' });
        } else {
            setError('Usuário ou senha inválidos.');
        }
    };

    return (
        <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-4 overflow-hidden relative">
            <div className="absolute inset-0 bg-blue-600/5 blur-[120px] rounded-full"></div>
            <div className="z-10 w-full max-w-md p-8 bg-slate-900/90 border border-slate-700 rounded-3xl shadow-2xl backdrop-blur-xl">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-blue-600 p-4 rounded-2xl mb-4"><Cuboid className="text-white" size={40} /></div>
                    <h1 className="text-2xl font-black text-white">Isometrico Manager</h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Software por Marconi Fabian</p>
                    {isSupabaseConfigured ? (
                        <div className="flex items-center gap-1.5 mt-4 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
                            <Cloud size={12} className="text-green-400" />
                            <span className="text-[10px] font-bold text-green-400 uppercase">Cloud Ativo</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 mt-4 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
                            <CloudOff size={12} className="text-yellow-400" />
                            <span className="text-[10px] font-bold text-yellow-400 uppercase">Modo Local</span>
                        </div>
                    )}
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all" placeholder="Usuário" required />
                    <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-600 transition-all" placeholder="Senha" required />
                    {error && <div className="text-red-400 text-xs font-bold text-center bg-red-900/20 p-2 rounded border border-red-500/20">{error}</div>}
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all">Entrar no Sistema</button>
                </form>
                {!isSupabaseConfigured && (
                    <p className="text-[10px] text-slate-600 text-center mt-6 leading-relaxed">
                        Nota: Como o Supabase não está configurado, os dados salvos ficarão apenas neste dispositivo.
                    </p>
                )}
            </div>
        </div>
    );
};

export default function App() {
  const [userDB, setUserDB] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAllUsers().then(users => { 
        setUserDB(users); 
        setIsLoading(false); 
    });
  }, []);

  const [pipes, setPipes] = useState<PipeSegment[]>(INITIAL_PIPES);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [projectLocation, setProjectLocation] = useState('ÁREA / SETOR 01');
  const [projectClient, setProjectClient] = useState('VALE');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'3d' | 'dashboard'>('3d');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDBModalOpen, setIsDBModalOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);

  const prodSettings: ProductivitySettings = {
      pipingBase: BASE_PRODUCTIVITY.PIPING,
      insulationBase: BASE_PRODUCTIVITY.INSULATION,
      weights: DIFFICULTY_WEIGHTS as any
  };

  const reportStats = useMemo(() => {
      const totalLength = pipes.reduce((acc, p) => acc + (p?.length || 0), 0);
      let totalHH = 0;
      pipes.forEach(p => {
          const effort = (p.length * prodSettings.pipingBase * (PIPING_REMAINING_FACTOR[p.status] || 0)) + (p.length * prodSettings.insulationBase * (INSULATION_REMAINING_FACTOR[p.insulationStatus || 'NONE'] || 0));
          totalHH += effort;
      });
      return { totalLength, totalHH, projectedEnd: getWorkingEndDate(new Date(activityDate), Math.ceil(totalHH/8.8)).toLocaleDateString('pt-BR') };
  }, [pipes, activityDate]);

  const handleDBAction_Save = async (name: string) => { 
      await saveProjectToDB({ id: crypto.randomUUID(), name, location: projectLocation, client: projectClient, pipes, annotations });
      getAllProjects().then(setSavedProjects);
  };
  const handleDBAction_Load = (p: any) => { setPipes(p.pipes); setAnnotations(p.annotations); setProjectLocation(p.location); setProjectClient(p.client); setIsDBModalOpen(false); };

  if (isLoading) return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="text-blue-500 animate-spin" size={48} />
      </div>
  );

  if (!currentUser) return <LoginScreen onLogin={setCurrentUser} users={userDB} />;

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <DatabaseModal isOpen={isDBModalOpen} onClose={() => setIsDBModalOpen(false)} projects={savedProjects} onSave={handleDBAction_Save} onLoad={handleDBAction_Load} onDelete={deleteProjectFromDB} />
        
        <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-50">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg"><Cuboid className="text-white" size={24} /></div>
                    <h1 className="font-bold text-xl">Isometrico Manager</h1>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <button onClick={()=>setIsDBModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-bold flex items-center gap-2"><Database size={16}/> Projetos</button>
                <button onClick={()=>setCurrentUser(null)} className="p-2 text-slate-500 hover:text-red-400 transition-colors"><LogOut size={20}/></button>
            </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
            <div className="flex-1 relative flex flex-col p-4">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                        <button onClick={()=>setIsDrawing(!isDrawing)} className={`px-6 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${isDrawing ? 'bg-red-500' : 'bg-blue-600'}`}>{isDrawing ? 'PARAR' : 'DESENHAR'}</button>
                        <div className="bg-slate-900 p-1 rounded-xl flex gap-1 border border-slate-800">
                            <button onClick={()=>setViewMode('3d')} className={`px-5 py-1.5 rounded-lg text-xs font-bold ${viewMode==='3d' ? 'bg-slate-700' : 'text-slate-500'}`}>3D</button>
                            <button onClick={()=>setViewMode('dashboard')} className={`px-5 py-1.5 rounded-lg text-xs font-bold ${viewMode==='dashboard' ? 'bg-slate-700' : 'text-slate-500'}`}>DASHBOARD</button>
                        </div>
                    </div>
                    <div className="bg-slate-900 px-6 py-2 rounded-2xl border border-slate-800 flex gap-8">
                        <div className="flex flex-col"><span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Saldo Geral</span><span className="font-bold text-lg text-white">{reportStats.totalHH.toFixed(1)} h</span></div>
                        <div className="flex flex-col items-end"><span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Previsão</span><span className="font-bold text-lg text-green-400">{reportStats.projectedEnd}</span></div>
                    </div>
                </div>
                <div className="flex-1 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800">
                    <Scene pipes={pipes} annotations={annotations} selectedIds={selectedIds} onSelectPipe={setSelectedIds as any} isDrawing={isDrawing} onAddPipe={(s,e)=>setPipes(prev=>[...prev, {id:crypto.randomUUID(), name:'Novo', start:s, end:e, diameter:0.2, length:1, status:'PENDING'} as any])} onUpdatePipe={p=>setPipes(prev=>prev.map(o=>o.id===p.id?p:o))} onCancelDraw={()=>setIsDrawing(false)} />
                </div>
            </div>
        </main>
    </div>
  );
}
