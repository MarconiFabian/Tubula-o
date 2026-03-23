import React from 'react';
import { Cuboid, Building2, MapPin, Calendar, LogOut, Database, Timer, LayoutDashboard, Ruler, HelpCircle, FileCode, FileSpreadsheet, FileDown, Loader2, MousePointer2 } from 'lucide-react';

interface TopNavProps {
  projectClient: string;
  setProjectClient: (v: string) => void;
  projectLocation: string;
  setProjectLocation: (v: string) => void;
  activityDate: string;
  setActivityDate: (v: string) => void;
  currentUser: string | null;
  handleLogout: () => void;
  setIsDBModalOpen: (v: boolean) => void;
  viewMode: '3d' | 'dashboard' | 'planning';
  setViewMode: (v: '3d' | 'dashboard' | 'planning') => void;
  setIsDrawing: (v: boolean) => void;
  showDimensions: boolean;
  setShowDimensions: (v: boolean) => void;
  handleExportDXF: () => void;
  handleExportExcel: () => void;
  handleExportPDF: () => void;
  isExporting: boolean;
  currentProjectName?: string | null;
  handleNewProject: () => void;
  onOpenDailyProduction: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  projectClient, setProjectClient,
  projectLocation, setProjectLocation,
  activityDate, setActivityDate,
  currentUser, handleLogout,
  setIsDBModalOpen,
  viewMode, setViewMode,
  setIsDrawing,
  showDimensions, setShowDimensions,
  handleExportDXF, handleExportExcel, handleExportPDF, isExporting,
  currentProjectName, handleNewProject,
  onOpenDailyProduction
}) => {
  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-50 shadow-lg">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-600/20">
            <Cuboid className="text-white" size={20} />
          </div>
          <div className="hidden lg:block">
            <h1 className="font-bold text-lg leading-none tracking-tight text-white">Isometrico Manager</h1>
            <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest">Engineering Suite v2.5</p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg ml-2">
          <Database size={14} className={currentProjectName ? "text-blue-400" : "text-slate-500"} />
          <span className={`text-sm font-bold truncate max-w-[200px] ${currentProjectName ? "text-blue-100" : "text-slate-500 italic"}`}>
            {currentProjectName || "Projeto Não Salvo"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950/50 p-1 rounded-xl border border-slate-800/50">
          <div className="flex flex-col px-2">
            <label className="text-[8px] font-black text-slate-600 uppercase flex items-center gap-1 tracking-tighter">
              <Building2 size={9} /> Cliente
            </label>
            <input 
              type="text" 
              value={projectClient} 
              onChange={(e) => setProjectClient(e.target.value)} 
              className="text-xs font-bold bg-transparent border-none text-blue-400 focus:ring-0 w-24 uppercase p-0 placeholder:text-slate-800"
              placeholder="CLIENTE"
            />
          </div>
          <div className="h-6 w-px bg-slate-800 mx-1"></div>
          <div className="flex flex-col px-2">
            <label className="text-[8px] font-black text-slate-600 uppercase flex items-center gap-1 tracking-tighter">
              <MapPin size={9} /> Localização
            </label>
            <input 
              type="text" 
              value={projectLocation} 
              onChange={(e) => setProjectLocation(e.target.value)} 
              className="text-xs font-bold bg-transparent border-none text-white focus:ring-0 w-32 uppercase p-0 placeholder:text-slate-800"
              placeholder="ÁREA / SETOR"
            />
          </div>
          <div className="h-6 w-px bg-slate-800 mx-1"></div>
          <div className="flex flex-col px-2">
            <label className="text-[8px] font-black text-slate-600 uppercase flex items-center gap-1 tracking-tighter">
              <Calendar size={9} /> Data Ref.
            </label>
            <input 
              type="date" 
              value={activityDate} 
              onChange={(e) => setActivityDate(e.target.value)} 
              className="text-xs font-bold bg-transparent border-none text-white focus:ring-0 p-0 [color-scheme:dark] w-24" 
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="hidden xl:flex flex-col items-end mr-2">
          <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">Operador</span>
          <span className="text-xs font-bold text-blue-400 leading-none">{currentUser}</span>
        </div>
        
        <button 
          onClick={handleLogout}
          className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all border border-transparent hover:border-red-400/20"
          title="Sair do Sistema"
        >
          <LogOut size={18} />
        </button>
        
        <div className="h-6 w-px bg-slate-800 mx-1"></div>
        
        <button 
          onClick={handleNewProject} 
          className="bg-slate-950 hover:bg-slate-800 text-emerald-400 border border-slate-800 px-3 py-1.5 rounded-xl font-bold text-[10px] flex items-center gap-2 whitespace-nowrap transition-all uppercase tracking-widest"
        >
          <FileCode size={14} /> Novo Projeto
        </button>

        <button 
          onClick={() => setIsDBModalOpen(true)} 
          className="bg-slate-950 hover:bg-slate-800 text-blue-400 border border-slate-800 px-3 py-1.5 rounded-xl font-bold text-[10px] flex items-center gap-2 whitespace-nowrap transition-all uppercase tracking-widest"
        >
          <Database size={14} /> Banco de Dados
        </button>

        <div className="bg-slate-950 p-1 rounded-xl flex gap-1 border border-slate-800 flex-shrink-0">
          <button 
            onClick={() => { setViewMode('3d'); setIsDrawing(false); }} 
            className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-tighter flex items-center gap-1.5 ${viewMode === '3d' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Cuboid size={14}/> Vista 3D
          </button>
          <button 
            onClick={() => { setViewMode('planning'); setIsDrawing(false); }} 
            className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-tighter flex items-center gap-1.5 ${viewMode === 'planning' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Timer size={14}/> Plano 4D
          </button>
          <button 
            onClick={() => { setViewMode('dashboard'); setIsDrawing(false); }} 
            className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-tighter flex items-center gap-1.5 ${viewMode === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <LayoutDashboard size={14}/> Dashboard
          </button>
          <button 
            onClick={onOpenDailyProduction} 
            className="px-3 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-tighter flex items-center gap-1.5 text-slate-500 hover:text-slate-300"
          >
            <Calendar size={14}/> Cálculo Diário
          </button>
        </div>

        <div className="flex gap-1 ml-1">
          <button 
            onClick={() => setShowDimensions(!showDimensions)}
            className={`p-2 rounded-xl border transition-all ${showDimensions ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-slate-950 border-slate-800 text-slate-600'}`}
            title="Alternar Dimensões"
          >
            <Ruler size={18} />
          </button>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('RESET_CAMERA'))}
            className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all border border-slate-800"
            title="Resetar Câmera"
          >
            <MousePointer2 size={18} />
          </button>
          <button 
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }))}
            className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all border border-slate-800"
            title="Ajuda (H)"
          >
            <HelpCircle size={18} />
          </button>
        </div>

        <div className="h-6 w-px bg-slate-800 mx-1"></div>

        <div className="flex gap-1.5">
          <button onClick={handleExportDXF} className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 text-[10px] uppercase tracking-widest transition-all" title="Exportar para AutoCAD">
            <FileCode size={14} className="text-blue-400"/> CAD
          </button>
          <button onClick={handleExportExcel} className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 text-[10px] uppercase tracking-widest transition-all" title="Exportar para Excel">
            <FileSpreadsheet size={14} className="text-emerald-400"/> XLS
          </button>
          <button 
            onClick={handleExportPDF} 
            disabled={isExporting} 
            className="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-xl font-bold flex items-center gap-2 text-[10px] uppercase tracking-widest shadow-lg shadow-red-600/20 transition-all disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="animate-spin" size={14}/> : <FileDown size={14}/>} PDF
          </button>
        </div>
      </div>
    </header>
  );
};
