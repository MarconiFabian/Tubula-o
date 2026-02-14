
import React, { useMemo, useRef, useState } from 'react';
import { PipeSegment } from '../types';
import { STATUS_COLORS, STATUS_LABELS, ALL_STATUSES, INSULATION_COLORS, INSULATION_LABELS, ALL_INSULATION_STATUSES } from '../constants';
import { Activity, FileDown, Upload, Image as ImageIcon, Map as MapIcon, Layers, Shield, Ruler, Package, AlertCircle, Search, Filter, ClipboardList, UserCog, Calendar, CheckSquare } from 'lucide-react';

interface DashboardProps {
  pipes: PipeSegment[];
  onExportPDF?: () => void;
  isExporting?: boolean;
  exportMode?: boolean; 
  secondaryImage?: string | null;
  mapImage?: string | null;
  onUploadSecondary?: (img: string | null) => void;
  onUploadMap?: (img: string | null) => void;
  sceneScreenshot?: string | null;
  onSelectPipe?: (id: string, multi?: boolean) => void; 
  selectedIds?: string[];
  onSetSelection?: (ids: string[]) => void;
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
    sceneScreenshot,
    onSelectPipe,
    selectedIds = [],
    onSetSelection
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
    
    const pipeCounts: Record<string, number> = {};
    ALL_STATUSES.forEach(s => pipeCounts[s] = 0);
    pipes.forEach(p => { if (p.status) pipeCounts[p.status] = (pipeCounts[p.status] || 0) + 1; });

    const insulationCounts: Record<string, number> = {};
    ALL_INSULATION_STATUSES.forEach(s => insulationCounts[s] = 0);
    pipes.forEach(p => { 
        const status = p.insulationStatus || 'NONE';
        insulationCounts[status] = (insulationCounts[status] || 0) + 1; 
    });

    const bom: Record<string, number> = {};
    pipes.forEach(p => {
        const inches = Math.round(p.diameter * 39.37);
        const dLabel = `${inches}`; 
        if (!bom[dLabel]) bom[dLabel] = 0;
        bom[dLabel] += p.length;
    });

    const completedWeight = (pipeCounts['WELDED'] * 0.8) + (pipeCounts['HYDROTEST'] * 1.0) + (pipeCounts['MOUNTED'] * 0.3);
    const progress = totalPipes > 0 ? (completedWeight / totalPipes) * 100 : 0;

    return { totalLength, totalPipes, pipeCounts, insulationCounts, bom, progress };
  }, [pipes]);

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

  const allFilteredSelected = filteredPipes.length > 0 && filteredPipes.every(p => selectedIds.includes(p.id));
  
  const handleSelectAll = () => {
      if (!onSetSelection) return;
      if (allFilteredSelected) {
          const newSelection = selectedIds.filter(id => !filteredPipes.find(p => p.id === id));
          onSetSelection(newSelection);
      } else {
          const newIds = filteredPipes.map(p => p.id);
          const combined = Array.from(new Set([...selectedIds, ...newIds]));
          onSetSelection(combined);
      }
  };

  return (
    <div className={`flex flex-col gap-6 w-full ${exportMode ? 'p-0' : ''}`}>
      
      {!exportMode && onExportPDF && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl gap-4">
             <div>
                 <h2 className="text-xl font-bold text-white flex items-center gap-2"><Activity className="text-blue-500" /> Dashboard de Controle</h2>
                 <p className="text-slate-400 text-sm">Gerenciamento de Shop, Soldagem e Montagem.</p>
             </div>
             <div className="flex gap-4 items-center">
                 <div className="bg-slate-800 p-1 rounded-lg flex border border-slate-700">
                    <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'overview' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}><Activity size={16}/> Visão Geral</button>
                    <button onClick={() => setActiveTab('tracking')} className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'tracking' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}><ClipboardList size={16}/> Rastreabilidade</button>
                 </div>
                 <button onClick={onExportPDF} disabled={isExporting} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex gap-2 items-center transition-all shadow-lg h-10 text-sm"><FileDown size={18} /> {isExporting ? '...' : 'PDF'}</button>
             </div>
        </div>
      )}

      {(activeTab === 'overview' || exportMode) && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Ruler size={64} className="text-blue-500" /></div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Metros</span>
                    <div className="text-3xl font-bold text-white mt-1">{stats.totalLength.toFixed(2)}m</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Package size={64} className="text-purple-500" /></div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Spools</span>
                    <div className="text-3xl font-bold text-white mt-1">{stats.totalPipes}</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={64} className="text-green-500" /></div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Progresso</span>
                    <div className="text-3xl font-bold text-green-400 mt-1">{stats.progress.toFixed(1)}%</div>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><AlertCircle size={64} className="text-red-500" /></div>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Pendentes</span>
                    <div className="text-3xl font-bold text-white mt-1">{stats.pipeCounts['PENDING']}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-5 flex flex-col gap-6">
                    <div className="bg-slate-900 rounded-xl border border-slate-800 aspect-video flex flex-col items-center justify-center relative overflow-hidden group shadow-lg">
                        {sceneScreenshot ? <img src={sceneScreenshot} className="w-full h-full object-cover" /> : <div className="text-slate-700 flex flex-col items-center"><Activity size={48} className="mb-2"/><p className="text-xs font-bold uppercase tracking-wider">Modelo 3D (Auto-Capture)</p></div>}
                    </div>
                    <div className="grid grid-cols-2 gap-4 h-40">
                            <div className="bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden group flex flex-col">
                                <div className="absolute top-0 left-0 w-full p-2 bg-black/60 backdrop-blur-sm z-10 flex justify-between items-center"><span className="text-[10px] font-bold text-yellow-400 uppercase flex items-center gap-1"><ImageIcon size={10} /> Foto Local</span></div>
                                {secondaryImage ? <img src={secondaryImage} className="w-full h-full object-cover" /> : <div className="flex-1 flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => secInputRef.current?.click()}><Upload size={20} className="text-slate-500"/></div>}
                                <input type="file" ref={secInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, onUploadSecondary)} />
                            </div>
                            <div className="bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden group flex flex-col">
                                <div className="absolute top-0 left-0 w-full p-2 bg-black/60 backdrop-blur-sm z-10 flex justify-between items-center"><span className="text-[10px] font-bold text-green-400 uppercase flex items-center gap-1"><MapIcon size={10} /> Localização</span></div>
                                {mapImage ? <img src={mapImage} className="w-full h-full object-cover" /> : <div className="flex-1 flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => mapInputRef.current?.click()}><Upload size={20} className="text-slate-500"/></div>}
                                <input type="file" ref={mapInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, onUploadMap)} />
                            </div>
                    </div>
                </div>

                <div className="col-span-12 md:col-span-7 flex flex-col gap-6">
                    {/* GRÁFICOS LADO A LADO - DASHBOARD */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg">
                            <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                                <Layers size={14}/> Status Tubulação
                            </h3>
                            <div className="flex items-end justify-around gap-2 h-40">
                                {ALL_STATUSES.map(status => {
                                    const height = (stats.pipeCounts[status] / Math.max(1, stats.totalPipes)) * 100;
                                    return (
                                        <div key={status} className="flex flex-col items-center flex-1 h-full justify-end">
                                            <span className="text-white font-bold text-[10px] mb-1">{stats.pipeCounts[status]}</span>
                                            <div className="w-full rounded-t-sm opacity-80" style={{ height: `${Math.max(height, 5)}%`, backgroundColor: STATUS_COLORS[status] }}></div>
                                            <span className="text-[8px] text-slate-500 font-bold uppercase text-center mt-1 truncate w-full">{STATUS_LABELS[status].split(' ')[0]}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-lg">
                            <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                                <Shield size={14}/> Proteção Térmica
                            </h3>
                            <div className="flex items-end justify-around gap-2 h-40">
                                {ALL_INSULATION_STATUSES.map(status => {
                                    const height = (stats.insulationCounts[status] / Math.max(1, stats.totalPipes)) * 100;
                                    const color = INSULATION_COLORS[status] === 'transparent' ? '#475569' : INSULATION_COLORS[status];
                                    return (
                                        <div key={status} className="flex flex-col items-center flex-1 h-full justify-end">
                                            <span className="text-white font-bold text-[10px] mb-1">{stats.insulationCounts[status]}</span>
                                            <div className="w-full rounded-t-sm opacity-80" style={{ height: `${Math.max(height, 5)}%`, backgroundColor: color }}></div>
                                            <span className="text-[8px] text-slate-500 font-bold uppercase text-center mt-1 truncate w-full">{INSULATION_LABELS[status].replace('Isol. ', '')}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg flex-1 flex flex-col">
                            <div className="p-4 border-b border-slate-800 bg-slate-800/30 rounded-t-xl flex justify-between items-center">
                                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2"><Package size={14} className="text-yellow-400"/> Resumo de Materiais (BOM)</h3>
                                <span className="text-[10px] bg-slate-950 px-2 py-1 rounded text-slate-400 border border-slate-700">Quantitativo</span>
                            </div>
                            <div className="p-0 overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                                        <tr><th className="p-3">Item / Descrição</th><th className="p-3 text-right">Qtd. Estimada</th><th className="p-3 text-right">Unid.</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {Object.entries(stats.bom).map(([diameterInch, length]) => (
                                            <tr key={diameterInch} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="p-3 text-slate-200">Tubo Aço Carbono - <span className="text-blue-400 font-bold">{diameterInch}"</span></td>
                                                <td className="p-3 text-right font-mono text-white">{(length as number).toFixed(2)}</td>
                                                <td className="p-3 text-right text-slate-500">Metros</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'tracking' && !exportMode && (
         <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col gap-6 h-full">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input type="text" placeholder="Buscar Spool, Linha..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"/>
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-slate-500" />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 outline-none">
                        <option value="ALL">Todos os Status</option>
                        {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col shadow-2xl">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold">
                            <tr><th className="p-4 w-12 text-center"><input type="checkbox" checked={allFilteredSelected && filteredPipes.length > 0} onChange={handleSelectAll} className="rounded border-slate-600 bg-slate-800 text-blue-600"/></th><th className="p-4">Spool / ID</th><th className="p-4">Linha / Descrição</th><th className="p-4">Status</th><th className="p-4">Isolamento</th><th className="p-4">Inspetor</th><th className="p-4">Data</th><th className="p-4 text-center">Insp.</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-xs">
                            {filteredPipes.map(pipe => (
                                <tr key={pipe.id} className={`cursor-pointer ${selectedIds.includes(pipe.id) ? 'bg-blue-900/20' : 'hover:bg-slate-800/50'}`} onClick={() => onSelectPipe?.(pipe.id, false)}>
                                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(pipe.id)} onChange={() => onSelectPipe?.(pipe.id, true)} className="rounded border-slate-600 bg-slate-800 text-blue-600"/></td>
                                    <td className="p-4 font-mono text-blue-300">{pipe.spoolId || '-'}</td>
                                    <td className="p-4 text-slate-200">{pipe.name}</td>
                                    <td className="p-4"><span className="px-2 py-1 rounded-[4px] font-bold text-white uppercase text-[9px]" style={{ backgroundColor: STATUS_COLORS[pipe.status] }}>{STATUS_LABELS[pipe.status]}</span></td>
                                    <td className="p-4"><span className="px-2 py-1 rounded-[4px] font-bold uppercase text-[9px]" style={{ backgroundColor: pipe.insulationStatus && pipe.insulationStatus !== 'NONE' ? INSULATION_COLORS[pipe.insulationStatus] : 'transparent', color: pipe.insulationStatus === 'FINISHED' ? '#0f172a' : '#94a3b8' }}>{INSULATION_LABELS[pipe.insulationStatus || 'NONE']}</span></td>
                                    <td className="p-4 text-slate-400">{pipe.welderInfo?.welderId || '-'}</td>
                                    <td className="p-4 text-slate-400">{pipe.welderInfo?.weldDate || '-'}</td>
                                    <td className="p-4 text-center">{pipe.welderInfo?.visualInspection ? <CheckSquare size={14} className="text-green-500 mx-auto"/> : <div className="w-1.5 h-1.5 rounded-full bg-slate-700 mx-auto"></div>}</td>
                                </tr>
                            ))}
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
