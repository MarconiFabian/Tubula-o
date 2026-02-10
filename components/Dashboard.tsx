import React, { useMemo, useRef, useState } from 'react';
import { PipeSegment } from '../types';
import { STATUS_COLORS, STATUS_LABELS, ALL_STATUSES, INSULATION_COLORS, INSULATION_LABELS, ALL_INSULATION_STATUSES } from '../constants';
import { Activity, FileDown, Upload, Image as ImageIcon, Map as MapIcon, Layers, Shield, Ruler, Package, AlertCircle, Search, Filter, ClipboardList, UserCog, Calendar, CheckSquare } from 'lucide-react';

interface DashboardProps {
  pipes: PipeSegment[];
  onExportPDF?: () => void;
  isExporting?: boolean;
  exportMode?: boolean; // Se true, remove botões e ajusta layout para impressão
  secondaryImage?: string | null;
  mapImage?: string | null;
  onUploadSecondary?: (img: string | null) => void;
  onUploadMap?: (img: string | null) => void;
  sceneScreenshot?: string | null; // NOVA PROPRIEDADE
}

type TabType = 'overview' | 'tracking';

const Dashboard: React.FC<DashboardProps> = ({ 
    pipes = [], 
    onExportPDF, 
    isExporting = false, 
    exportMode = false,
    secondaryImage,
    mapImage,
    onUploadSecondary,
    onUploadMap,
    sceneScreenshot // Recebe a imagem
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const secInputRef = useRef<HTMLInputElement>(null);
  const mapInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter?: (val: string | null) => void) => {
      const file = e.target.files?.[0];
      if (file && setter) {
          const reader = new FileReader();
          reader.onload = (ev) => setter(ev.target?.result as string);
          reader.readAsDataURL(file);
      }
  };

  const stats = useMemo(() => {
    const totalLength = pipes.reduce((acc, p) => acc + (p?.length || 0), 0);
    const totalPipes = pipes.length;
    
    // Piping Status Counts
    const pipeCounts: Record<string, number> = {};
    ALL_STATUSES.forEach(s => pipeCounts[s] = 0);
    pipes.forEach(p => { if (p.status) pipeCounts[p.status] = (pipeCounts[p.status] || 0) + 1; });

    // Insulation Status Counts
    const insulationCounts: Record<string, number> = {};
    ALL_INSULATION_STATUSES.forEach(s => insulationCounts[s] = 0);
    pipes.forEach(p => { 
        const status = p.insulationStatus || 'NONE';
        insulationCounts[status] = (insulationCounts[status] || 0) + 1; 
    });

    // Material List (BOM) - Group by Diameter (Converted to Inches)
    const bom: Record<string, number> = {};
    pipes.forEach(p => {
        const inches = Math.round(p.diameter * 39.37);
        const dLabel = `${inches}`; 
        
        if (!bom[dLabel]) bom[dLabel] = 0;
        bom[dLabel] += p.length;
    });

    // Calculate Progress %
    const completedWeight = (pipeCounts['WELDED'] * 0.8) + (pipeCounts['HYDROTEST'] * 1.0) + (pipeCounts['MOUNTED'] * 0.3);
    const progress = totalPipes > 0 ? (completedWeight / totalPipes) * 100 : 0;

    return { totalLength, totalPipes, pipeCounts, insulationCounts, bom, progress };
  }, [pipes]);

  // Filtered Pipes for Tracking Tab
  const filteredPipes = useMemo(() => {
      return pipes.filter(p => {
          const matchesSearch = 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.spoolId && p.spoolId.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (p.welderInfo?.welderId && p.welderInfo.welderId.toLowerCase().includes(searchTerm.toLowerCase()));
          
          const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
          
          return matchesSearch && matchesStatus;
      });
  }, [pipes, searchTerm, statusFilter]);

  return (
    <div className={`flex flex-col gap-6 w-full ${exportMode ? 'p-0' : ''}`}>
      
      {/* HEADER ACTION (Only visible in interactive mode) */}
      {!exportMode && onExportPDF && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl gap-4">
             <div>
                 <h2 className="text-xl font-bold text-white flex items-center gap-2"><Activity className="text-blue-500" /> Dashboard de Controle</h2>
                 <p className="text-slate-400 text-sm">Gerenciamento de Pipe Shop, Soldagem e Montagem.</p>
             </div>
             
             <div className="flex gap-4 items-center">
                 {/* TAB SWITCHER */}
                 <div className="bg-slate-800 p-1 rounded-lg flex border border-slate-700">
                    <button 
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'overview' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Activity size={16}/> Visão Geral
                    </button>
                    <button 
                        onClick={() => setActiveTab('tracking')}
                        className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'tracking' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        <ClipboardList size={16}/> Rastreabilidade
                    </button>
                 </div>

                 <button onClick={onExportPDF} disabled={isExporting} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex gap-2 items-center transition-all shadow-lg shadow-blue-500/20 h-10 text-sm">
                    <FileDown size={18} /> {isExporting ? '...' : 'PDF'}
                </button>
             </div>
        </div>
      )}

      {/* --- TAB CONTENT: OVERVIEW --- */}
      {(activeTab === 'overview' || exportMode) && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {/* TOP CARDS - KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Ruler size={64} className="text-blue-500" /></div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Metros Lineares</span>
                    <div className="text-3xl font-bold text-white mt-1">{stats.totalLength.toFixed(2)}<span className="text-sm text-slate-500 ml-1">m</span></div>
                    <div className="w-full bg-slate-800 h-1 mt-3 rounded-full overflow-hidden"><div className="bg-blue-500 h-full" style={{width: '100%'}}></div></div>
                </div>
                
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Package size={64} className="text-purple-500" /></div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Spools / Linhas</span>
                    <div className="text-3xl font-bold text-white mt-1">{stats.totalPipes}</div>
                    <div className="w-full bg-slate-800 h-1 mt-3 rounded-full overflow-hidden"><div className="bg-purple-500 h-full" style={{width: '100%'}}></div></div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={64} className="text-green-500" /></div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Progresso Físico (Est.)</span>
                    <div className="text-3xl font-bold text-green-400 mt-1">{stats.progress.toFixed(1)}<span className="text-sm text-slate-500 ml-1">%</span></div>
                    <div className="w-full bg-slate-800 h-1 mt-3 rounded-full overflow-hidden"><div className="bg-green-500 h-full" style={{width: `${stats.progress}%`}}></div></div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><AlertCircle size={64} className="text-red-500" /></div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Pendências (Montagem)</span>
                    <div className="text-3xl font-bold text-white mt-1">{stats.pipeCounts['PENDING']}</div>
                    <div className="w-full bg-slate-800 h-1 mt-3 rounded-full overflow-hidden"><div className="bg-red-500 h-full" style={{width: `${(stats.pipeCounts['PENDING']/stats.totalPipes)*100}%`}}></div></div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* LEFT COLUMN: VISUALS (3D View + Photos) */}
                <div className="col-span-12 md:col-span-5 flex flex-col gap-6">
                    {/* 3D Placeholder/Screenshot */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 aspect-video flex flex-col items-center justify-center relative overflow-hidden group shadow-lg">
                        {sceneScreenshot ? (
                             <>
                                <img src={sceneScreenshot} className="w-full h-full object-cover" alt="Captura 3D" />
                                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-[10px] text-white backdrop-blur-sm">Captura Automática</div>
                             </>
                        ) : (
                            <>
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-transparent pointer-events-none" />
                                <Activity size={48} className="text-slate-700 mb-2" />
                                <p className="text-slate-500 font-bold uppercase tracking-wider text-sm">Modelo 3D (Captura Automática)</p>
                            </>
                        )}
                    </div>

                    {/* Image Slots */}
                    <div className="grid grid-cols-2 gap-4 h-48">
                            {/* Secondary Image */}
                            <div className="bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden group flex flex-col">
                                <div className="absolute top-0 left-0 w-full p-2 bg-black/60 backdrop-blur-sm z-10 flex justify-between items-center border-b border-white/10">
                                    <span className="text-[10px] font-bold text-yellow-400 uppercase flex items-center gap-1"><ImageIcon size={10} /> Foto Local</span>
                                    {!exportMode && secondaryImage && <button onClick={() => onUploadSecondary?.(null)} className="text-[10px] text-red-400 hover:text-red-300 font-bold">X</button>}
                                </div>
                                {secondaryImage ? (
                                    <img src={secondaryImage} className="w-full h-full object-cover" />
                                ) : !exportMode ? (
                                    <div className="flex-1 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => secInputRef.current?.click()}>
                                        <Upload size={20} className="text-slate-500 mb-1" /><span className="text-xs text-slate-500">Upload</span>
                                    </div>
                                ) : <div className="flex-1 flex items-center justify-center text-slate-700 text-xs">Sem Foto</div>}
                                <input type="file" ref={secInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, onUploadSecondary)} />
                            </div>

                            {/* Map Image */}
                            <div className="bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden group flex flex-col">
                                <div className="absolute top-0 left-0 w-full p-2 bg-black/60 backdrop-blur-sm z-10 flex justify-between items-center border-b border-white/10">
                                    <span className="text-[10px] font-bold text-green-400 uppercase flex items-center gap-1"><MapIcon size={10} /> Mapa/ISO</span>
                                    {!exportMode && mapImage && <button onClick={() => onUploadMap?.(null)} className="text-[10px] text-red-400 hover:text-red-300 font-bold">X</button>}
                                </div>
                                {mapImage ? (
                                    <img src={mapImage} className="w-full h-full object-cover" />
                                ) : !exportMode ? (
                                    <div className="flex-1 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => mapInputRef.current?.click()}>
                                        <Upload size={20} className="text-slate-500 mb-1" /><span className="text-xs text-slate-500">Upload</span>
                                    </div>
                                ) : <div className="flex-1 flex items-center justify-center text-slate-700 text-xs">Sem Mapa</div>}
                                <input type="file" ref={mapInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, onUploadMap)} />
                            </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: DETAILED STATS & BOM */}
                <div className="col-span-12 md:col-span-7 flex flex-col gap-6">
                    
                    {/* STATUS BARS */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                                <Layers size={16} className="text-blue-400"/> Status Tubulação & Solda
                            </h3>
                            <div className="space-y-4">
                                {ALL_STATUSES.map(status => {
                                    const count = stats.pipeCounts[status];
                                    const pct = stats.totalPipes > 0 ? (count / stats.totalPipes) * 100 : 0;
                                    return (
                                        <div key={status} className="flex items-center gap-3">
                                            <div className="w-24 text-[10px] font-bold uppercase text-right text-slate-400">{STATUS_LABELS[status]}</div>
                                            <div className="flex-1 h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
                                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[status] }}></div>
                                            </div>
                                            <div className="w-12 text-xs font-mono font-bold text-white text-right">{count}</div>
                                        </div>
                                    )
                                })}
                            </div>
                    </div>

                    {/* BOM (BILL OF MATERIALS) SUMMARY */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg flex-1 flex flex-col">
                            <div className="p-4 border-b border-slate-800 bg-slate-800/30 rounded-t-xl flex justify-between items-center">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                    <Package size={16} className="text-yellow-400"/> Resumo de Materiais (BOM)
                                </h3>
                                <span className="text-[10px] bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-700">Quantitativo</span>
                            </div>
                            <div className="p-0 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-950 text-slate-400 text-xs uppercase font-semibold">
                                        <tr>
                                            <th className="p-3">Item / Descrição</th>
                                            <th className="p-3 text-right">Qtd. Estimada</th>
                                            <th className="p-3 text-right">Unid.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {Object.keys(stats.bom).length === 0 ? (
                                            <tr><td colSpan={3} className="p-4 text-center text-slate-600 italic">Nenhum tubo modelado.</td></tr>
                                        ) : (
                                            Object.entries(stats.bom).map(([diameterInch, length]) => (
                                                <tr key={diameterInch} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="p-3 font-medium text-slate-200">
                                                        Tubo Aço Carbono - <span className="text-blue-400 font-bold">{diameterInch}"</span>
                                                    </td>
                                                    <td className="p-3 text-right font-mono text-white">{(length as number).toFixed(2)}</td>
                                                    <td className="p-3 text-right text-slate-500 text-xs">Metros</td>
                                                </tr>
                                            ))
                                        )}
                                        {/* Example of extra item */}
                                        {stats.totalPipes > 0 && (
                                            <tr className="hover:bg-slate-800/30">
                                                <td className="p-3 font-medium text-slate-200">Juntas de Solda / Conexões (Est.)</td>
                                                <td className="p-3 text-right font-mono text-white">~{stats.totalPipes * 2}</td>
                                                <td className="p-3 text-right text-slate-500 text-xs">Un</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                    </div>

                </div>
            </div>
        </div>
      )}

      {/* --- TAB CONTENT: TRACKING (RASTREABILIDADE) --- */}
      {activeTab === 'tracking' && !exportMode && (
         <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col gap-6 h-full">
            {/* Filters Bar */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por Spool, ID da Linha ou Soldador..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-slate-500" />
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="ALL">Todos os Status</option>
                        {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                </div>
            </div>

            {/* Tracking Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col shadow-2xl">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="p-4 border-b border-slate-800">Spool / ID</th>
                                <th className="p-4 border-b border-slate-800">Linha / Descrição</th>
                                <th className="p-4 border-b border-slate-800">Status</th>
                                <th className="p-4 border-b border-slate-800"><div className="flex items-center gap-1"><UserCog size={14}/> Soldador</div></th>
                                <th className="p-4 border-b border-slate-800"><div className="flex items-center gap-1"><Calendar size={14}/> Data</div></th>
                                <th className="p-4 border-b border-slate-800 text-center"><div className="flex items-center justify-center gap-1"><CheckSquare size={14}/> Insp.</div></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                            {filteredPipes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500 italic">Nenhum registro encontrado.</td>
                                </tr>
                            ) : (
                                filteredPipes.map(pipe => (
                                    <tr key={pipe.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 font-mono text-blue-300">
                                            {pipe.spoolId ? <span className="bg-blue-900/30 px-2 py-1 rounded border border-blue-500/20">{pipe.spoolId}</span> : <span className="opacity-50">-</span>}
                                            <div className="text-[10px] text-slate-500 mt-1">{pipe.id}</div>
                                        </td>
                                        <td className="p-4 text-slate-200 font-medium">
                                            {pipe.name}
                                            <div className="text-xs text-slate-500">{pipe.length.toFixed(2)}m - {Math.round(pipe.diameter * 39.37)}" pol</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border border-black/20 shadow-sm" style={{ backgroundColor: STATUS_COLORS[pipe.status], color: '#fff' }}>
                                                {STATUS_LABELS[pipe.status]}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-300">
                                            {pipe.welderInfo?.welderId || '-'}
                                            {pipe.welderInfo?.electrodeBatch && <div className="text-[10px] text-slate-500">Lot: {pipe.welderInfo.electrodeBatch}</div>}
                                        </td>
                                        <td className="p-4 text-slate-300 font-mono text-xs">
                                            {pipe.welderInfo?.weldDate ? new Date(pipe.welderInfo.weldDate).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="p-4 text-center">
                                            {pipe.welderInfo?.visualInspection ? (
                                                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                                                    <CheckSquare size={14} />
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-slate-600 border border-slate-700">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600"></div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default Dashboard;