
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Scene from './components/3d/Scene';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import { DatabaseModal } from './components/DatabaseModal';
import { saveProjectToDB, getAllProjects, deleteProjectFromDB, getAllUsers, registerUserDB, updateUserStatusDB, deleteUserDB } from './utils/db';
import { INITIAL_PIPES, STATUS_LABELS, STATUS_COLORS, INSULATION_LABELS, PIPE_DIAMETERS, AVAILABLE_DIAMETERS, ALL_STATUSES, ALL_INSULATION_STATUSES, INSULATION_COLORS, BASE_PRODUCTIVITY, DIFFICULTY_WEIGHTS } from './constants';
import { PipeSegment, PipeStatus, Annotation, ProductivitySettings } from './types';
import { LayoutDashboard, Cuboid, PenTool, XCircle, FileDown, Database, Loader2, MapPin, Calendar, Lock, User, LogOut, ChevronRight, Users, Ruler, Building2, Timer, FileCode, ShieldAlert, Check, X, AlertTriangle, ExternalLink } from 'lucide-react';
import { isSupabaseConfigured } from './utils/supabaseClient';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

type UserRole = 'ADMIN' | 'USER';
type UserStatus = 'APPROVED' | 'PENDING' | 'REJECTED';
interface UserAccount { username: string; password: string; role: UserRole; status: UserStatus; createdAt: string; }

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

// --- COMPONENTE DE LOGIN ---
const LoginScreen = ({ onLogin, users, onRegister, isLoading }: any) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleSubmit = async (e: any) => {
        e.preventDefault();
        setError(''); setSuccessMsg('');
        
        // Fallback: Login de Administrador Padrão (Offline)
        if (username === 'Marconi Fabian' && password === '2905') {
            onLogin({ username: 'Marconi Fabian', password: '2905', role: 'ADMIN', status: 'APPROVED', createdAt: new Date().toISOString() });
            return;
        }

        if (isRegistering) {
            if (users.find((u: any) => u.username.toLowerCase() === username.toLowerCase())) return setError('Usuário já existe.');
            try {
                await onRegister({ username, password, role: 'USER', status: 'PENDING', createdAt: new Date().toISOString() });
                setSuccessMsg('Solicitação enviada!'); setIsRegistering(false);
            } catch (err) { setError('Erro ao registrar no banco cloud.'); }
        } else {
            const user = users.find((u: any) => u.username === username && u.password === password);
            if (user) {
                if (user.status === 'APPROVED') onLogin(user);
                else setError('Aguardando aprovação do Admin.');
            } else setError('Credenciais inválidas.');
        }
    };

    return (
        <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-slate-950 to-slate-950"></div>
            <div className="z-10 w-full max-w-md p-8 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-blue-600 p-4 rounded-xl mb-4 shadow-lg shadow-blue-600/20"><Cuboid className="text-white" size={40} /></div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Isometrico Manager</h1>
                    <p className="text-slate-400 text-sm">Desenvolvido por Marconi Fabian</p>
                    {isSupabaseConfigured ? (
                        <p className="text-green-400 text-[10px] font-mono mt-2 uppercase tracking-widest bg-green-900/30 px-2 py-0.5 rounded border border-green-500/30">Servidor Cloud Conectado</p>
                    ) : (
                        <p className="text-yellow-400 text-[10px] font-mono mt-2 uppercase tracking-widest bg-yellow-900/30 px-2 py-0.5 rounded border border-yellow-500/30">Modo Local (Configuração Pendente)</p>
                    )}
                </div>
                {successMsg && <div className="bg-green-500/10 text-green-400 p-3 rounded mb-4 text-xs font-bold border border-green-500/20">{successMsg}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Usuário</label>
                        <input type="text" value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="Digite seu usuário" required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Senha</label>
                        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••" required />
                    </div>
                    {error && <div className="text-red-400 text-xs font-bold text-center bg-red-900/20 p-2 rounded border border-red-500/20">{error}</div>}
                    <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 shadow-lg shadow-blue-600/20 transition-all">
                        {isLoading ? <Loader2 className="animate-spin" size={20}/> : (isRegistering ? 'Solicitar Acesso' : 'Acessar Sistema')}
                    </button>
                </form>
                <div className="mt-6 text-center">
                    <button onClick={()=>setIsRegistering(!isRegistering)} className="text-slate-400 text-sm hover:text-white transition-colors">{isRegistering ? 'Já tem conta? Fazer Login' : 'Não tem conta? Solicitar Acesso'}</button>
                </div>
            </div>
        </div>
    );
};

// --- TELA DE ERRO DE CONFIGURAÇÃO ---
const ConfigErrorScreen = () => (
    <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 p-8 rounded-3xl border border-red-500/30 shadow-2xl animate-in zoom-in duration-300">
            <div className="bg-red-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Configuração Necessária</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                O seu aplicativo está tentando se conectar à nuvem, mas as chaves do **Supabase** no arquivo <code className="bg-black px-1 rounded text-blue-400">utils/supabaseClient.ts</code> não foram preenchidas corretamente.
            </p>
            <div className="bg-black/50 p-4 rounded-xl text-left mb-6 space-y-2 border border-slate-800">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Como resolver:</p>
                <ol className="text-xs text-slate-300 list-decimal ml-4 space-y-1">
                    <li>Acesse o seu painel do **Supabase**.</li>
                    <li>Vá em **Project Settings** > **API**.</li>
                    <li>Copie a **Project URL** e a **anon public Key**.</li>
                    <li>Cole-as no arquivo <code className="text-blue-400">utils/supabaseClient.ts</code>.</li>
                </ol>
            </div>
            <p className="text-[10px] text-slate-600 font-bold uppercase mb-4 italic">Isometrico Manager - Desenvolvido por Marconi Fabian</p>
            <button onClick={() => window.location.reload()} className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors">Tentar Novamente</button>
        </div>
    </div>
);

export default function App() {
  const [userDB, setUserDB] = useState<UserAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDBError, setIsDBError] = useState(false);

  // Carregar dados cloud no início com tratamento de erro
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    setIsLoading(true);
    getAllUsers()
        .then(users => { 
            setUserDB(users as any); 
            setIsLoading(false); 
        })
        .catch(err => {
            console.error("Erro ao conectar no banco:", err);
            setIsDBError(true);
            setIsLoading(false);
        });
  }, []);

  const [pipes, setPipes] = useState<PipeSegment[]>(INITIAL_PIPES);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [projectLocation, setProjectLocation] = useState('ÁREA / SETOR 01');
  const [projectClient, setProjectClient] = useState('VALE');
  const [activityDate, setActivityDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'3d' | 'dashboard' | 'planning'>('3d');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDBModalOpen, setIsDBModalOpen] = useState(false);
  const [savedProjects, setSavedProjects] = useState<any[]>([]);

  // Bloquear tela preta se houver erro de config crítica (placeholder)
  // Nota: Deixamos o usuário entrar se o supabaseClient.ts retornar nulo, 
  // mas o isValidUrl dentro dele já impede a quebra do construtor do Supabase.

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

  const handleLogin = (user: UserAccount) => setCurrentUser(user);
  
  const handleRegister = async (u: UserAccount) => { 
      if (!isSupabaseConfigured) {
          setUserDB(prev => [...prev, u]);
          return;
      }
      await registerUserDB(u as any); 
      const users = await getAllUsers(); 
      setUserDB(users as any); 
  };
  
  const handleDBAction_Save = async (name: string) => { 
      if (!isSupabaseConfigured) {
          alert("Banco de dados não configurado. Salve localmente usando Exportar PDF.");
          return;
      }
      await saveProjectToDB({ name, location: projectLocation, client: projectClient, pipes, annotations });
      getAllProjects().then(setSavedProjects);
  };

  const handleDBAction_Load = (p: any) => { setPipes(p.pipes); setAnnotations(p.annotations); setProjectLocation(p.location); setProjectClient(p.client); setIsDBModalOpen(false); };

  if (!currentUser) return <LoginScreen onLogin={handleLogin} users={userDB} onRegister={handleRegister} isLoading={isLoading} />;

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <DatabaseModal isOpen={isDBModalOpen} onClose={() => setIsDBModalOpen(false)} projects={savedProjects} onSave={handleDBAction_Save} onLoad={handleDBAction_Load} onDelete={deleteProjectFromDB} />
        
        <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-50 shadow-2xl">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-600/20"><Cuboid className="text-white" size={24} /></div>
                    <div>
                        <h1 className="font-bold text-xl leading-none">Isometrico Manager</h1>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Marconi Fabian</p>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-4 bg-slate-800/50 p-2 rounded-xl border border-slate-700/50">
                    <div className="flex flex-col"><span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Cliente</span><input value={projectClient} onChange={e=>setProjectClient(e.target.value)} className="bg-transparent text-sm font-bold w-24 outline-none text-blue-400 uppercase"/></div>
                    <div className="w-px h-8 bg-slate-700"></div>
                    <div className="flex flex-col"><span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Área</span><input value={projectLocation} onChange={e=>setProjectLocation(e.target.value)} className="bg-transparent text-sm font-bold w-32 outline-none text-white uppercase"/></div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block mr-2"><p className="text-[10px] text-slate-500 font-bold uppercase">Logado</p><p className="text-sm font-bold text-blue-400">{currentUser.username}</p></div>
                <button onClick={()=>setIsDBModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all text-sm uppercase tracking-tighter"><Database size={16}/> {isSupabaseConfigured ? 'Banco Cloud' : 'Projetos Local'}</button>
                <button onClick={()=>setCurrentUser(null)} className="p-2 text-slate-500 hover:text-red-400 transition-colors bg-slate-800 rounded-lg"><LogOut size={20}/></button>
            </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
            <div className="flex-1 relative flex flex-col p-4">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                        <button onClick={()=>setIsDrawing(!isDrawing)} className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all ${isDrawing ? 'bg-red-500 shadow-red-500/20' : 'bg-blue-600 shadow-blue-600/20'}`}>{isDrawing ? <><XCircle size={18}/> PARAR</> : <><PenTool size={18}/> DESENHAR</>}</button>
                        <div className="bg-slate-900 p-1 rounded-xl flex gap-1 border border-slate-800">
                            <button onClick={()=>setViewMode('3d')} className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode==='3d' ? 'bg-slate-700 text-blue-400 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}>VISTA 3D</button>
                            <button onClick={()=>setViewMode('dashboard')} className={`px-5 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode==='dashboard' ? 'bg-slate-700 text-blue-400 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}>INDICADORES</button>
                        </div>
                    </div>
                    <div className="bg-slate-900 px-6 py-2 rounded-2xl border border-slate-800 flex gap-8 shadow-xl">
                        <div className="flex flex-col"><span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Saldo Geral</span><span className="font-bold text-lg text-white">{reportStats.totalHH.toFixed(1)} <span className="text-[10px] text-slate-600">H/H</span></span></div>
                        <div className="flex flex-col items-end"><span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Previsão Término</span><span className="font-bold text-lg text-green-400">{reportStats.projectedEnd}</span></div>
                    </div>
                </div>
                <div className="flex-1 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                    <Scene pipes={pipes} annotations={annotations} selectedIds={selectedIds} onSelectPipe={setSelectedIds as any} isDrawing={isDrawing} onAddPipe={(s,e)=>setPipes(prev=>[...prev, {id:crypto.randomUUID(), name:'Novo Segmento', start:s, end:e, diameter:0.2, length:1, status:'PENDING'} as any])} onUpdatePipe={p=>setPipes(prev=>prev.map(o=>o.id===p.id?p:o))} onCancelDraw={()=>setIsDrawing(false)} />
                </div>
            </div>
        </main>
    </div>
  );
}
