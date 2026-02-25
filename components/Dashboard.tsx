
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

    // Daily Productivity Calculation
    const dailyProd: Record<string, number> = {};
    pipes.forEach(p => {
        if (p.welderInfo?.weldDate) {
            const date = p.welderInfo.weldDate;
            dailyProd[date] = (dailyProd[date] || 0) + (p.length || 0);
        }
    });
    const sortedDailyProd = Object.entries(dailyProd)
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .slice(-7); // Last 7 days

    const completedWeight = (pipeCounts['WELDED'] * 0.8) + (pipeCounts['HYDROTEST'] * 1.0) + (pipeCounts['MOUNTED'] * 0.3);
    const progress = totalPipes > 0 ? (completedWeight / totalPipes) * 100 : 0;

    return { totalLength, totalPipes, pipeCounts, insulationCounts, bom, progress, sortedDailyProd };
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
    <div className={`flex flex-col gap-6 w-full bg-grid-slate ${exportMode ? 'p-0' : 'pb-12'}`}>
      
      {!exportMode && onExportPDF && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/80 backdrop-blur-md p-6 rounded-xl border border-slate-800 shadow-2xl gap-4">
             <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded flex items-center justify-center">
                    <Activity className="text-blue-500 animate-pulse" size={24} />
                 </div>
                 <div>
                     <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">MISSION CONTROL <span className="text-[10px] bg-blue-600 px-1.5 py-0.5 rounded text-white font-mono">LIVE</span></h2>
                     <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Industrial Piping Management System v2.0</p>
                 </div>
             </div>
             <div className="flex gap-4 items-center">
                 <div className="bg-slate-950 p-1 rounded-lg flex border border-slate-800">
                    <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-md text-[10px] font-mono uppercase tracking-wider flex items-center gap-2 transition-all ${activeTab === 'overview' ? 'bg-slate-800 text-blue-400 shadow-inner border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}><Activity size={14}/> Overview</button>
                    <button onClick={() => setActiveTab('tracking')} className={`px-4 py-2 rounded-md text-[10px] font-mono uppercase tracking-wider flex items-center gap-2 transition-all ${activeTab === 'tracking' ? 'bg-slate-800 text-blue-400 shadow-inner border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}><ClipboardList size={14}/> Tracking</button>
                 </div>
                 <button onClick={onExportPDF} disabled={isExporting} className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest flex gap-2 items-center transition-all shadow-lg h-10"><FileDown size={14} /> {isExporting ? 'BUSY' : 'EXPORT'}</button>
             </div>
        </div>
      )}

      {(activeTab === 'overview' || exportMode) && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Ruler size={64} className="text-blue-500" /></div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                        <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Total Linear</span>
                    </div>
                    <div className="text-3xl font-bold text-white font-mono tracking-tighter">{stats.totalLength.toFixed(2)}<span className="text-xs text-slate-500 ml-1">m</span></div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group hover:border-purple-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Package size={64} className="text-purple-500" /></div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                        <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Spool Count</span>
                    </div>
                    <div className="text-3xl font-bold text-white font-mono tracking-tighter">{stats.totalPipes}</div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group hover:border-green-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Activity size={64} className="text-green-500" /></div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse"></div>
                        <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Efficiency</span>
                    </div>
                    <div className="text-3xl font-bold text-green-400 font-mono tracking-tighter">{stats.progress.toFixed(1)}<span className="text-xs ml-1">%</span></div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group hover:border-red-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><AlertCircle size={64} className="text-red-500" /></div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                        <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Backlog</span>
                    </div>
                    <div className="text-3xl font-bold text-white font-mono tracking-tighter">{stats.pipeCounts['PENDING']}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-5 flex flex-col gap-6">
                    <div className="bg-slate-900 rounded-xl border border-slate-800 aspect-video flex flex-col items-center justify-center relative overflow-hidden group shadow-2xl">
                        <div className="absolute top-0 left-0 w-full p-3 bg-slate-950/80 backdrop-blur-sm z-10 border-b border-slate-800 flex justify-between items-center">
                            <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                3D TELEMETRY FEED
                            </span>
                            <span className="text-[8px] font-mono text-slate-500">REF: ISO-MGR-01</span>
                        </div>
                        {sceneScreenshot ? <img src={sceneScreenshot} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" /> : <div className="text-slate-800 flex flex-col items-center"><Activity size={48} className="mb-2 opacity-20"/><p className="text-[10px] font-mono uppercase tracking-widest opacity-40">Waiting for data stream...</p></div>}
                    </div>
                    <div className="grid grid-cols-2 gap-4 h-40">
                            <div className="bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden group flex flex-col shadow-lg">
                                <div className="absolute top-0 left-0 w-full p-2 bg-slate-950/80 backdrop-blur-sm z-10 flex justify-between items-center border-b border-slate-800"><span className="text-[9px] font-mono text-yellow-500 uppercase tracking-widest flex items-center gap-1"><ImageIcon size={10} /> FIELD_PHOTO</span></div>
                                {secondaryImage ? <img src={secondaryImage} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all" /> : <div className="flex-1 flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => secInputRef.current?.click()}><Upload size={20} className="text-slate-700"/></div>}
                                <input type="file" ref={secInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, onUploadSecondary)} />
                            </div>
                            <div className="bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden group flex flex-col shadow-lg">
                                <div className="absolute top-0 left-0 w-full p-2 bg-slate-950/80 backdrop-blur-sm z-10 flex justify-between items-center border-b border-slate-800"><span className="text-[9px] font-mono text-green-500 uppercase tracking-widest flex items-center gap-1"><MapIcon size={10} /> GEOLOCATION</span></div>
                                {mapImage ? <img src={mapImage} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all" /> : <div className="flex-1 flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => mapInputRef.current?.click()}><Upload size={20} className="text-slate-700"/></div>}
                                <input type="file" ref={mapInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, onUploadMap)} />
                            </div>
                    </div>
                </div>

                <div className="col-span-12 md:col-span-7 flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16"></div>
                            <h3 className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
                                <Layers size={14}/> PIPING_STATUS_MATRIX
                            </h3>
                            <div className="flex items-end justify-around gap-3 h-32">
                                {ALL_STATUSES.map(status => {
                                    const height = (stats.pipeCounts[status] / Math.max(1, stats.totalPipes)) * 100;
                                    return (
                                        <div key={status} className="flex flex-col items-center flex-1 h-full justify-end group">
                                            <span className="text-white font-mono text-[9px] mb-2 opacity-0 group-hover:opacity-100 transition-opacity">{stats.pipeCounts[status]}</span>
                                            <div className="w-full rounded-t-[2px] transition-all duration-500 group-hover:brightness-125" style={{ height: `${Math.max(height, 4)}%`, backgroundColor: STATUS_COLORS[status], boxShadow: `0 0 15px ${STATUS_COLORS[status]}33` }}></div>
                                            <span className="text-[7px] text-slate-600 font-mono uppercase text-center mt-2 truncate w-full tracking-tighter">{STATUS_LABELS[status].split(' ')[0]}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl -mr-16 -mt-16"></div>
                            <h3 className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
                                <Shield size={14}/> THERMAL_PROTECTION_LOG
                            </h3>
                            <div className="flex items-end justify-around gap-3 h-32">
                                {ALL_INSULATION_STATUSES.map(status => {
                                    const height = (stats.insulationCounts[status] / Math.max(1, stats.totalPipes)) * 100;
                                    const color = INSULATION_COLORS[status] === 'transparent' ? '#1e293b' : INSULATION_COLORS[status];
                                    return (
                                        <div key={status} className="flex flex-col items-center flex-1 h-full justify-end group">
                                            <span className="text-white font-mono text-[9px] mb-2 opacity-0 group-hover:opacity-100 transition-opacity">{stats.insulationCounts[status]}</span>
                                            <div className="w-full rounded-t-[2px] transition-all duration-500 group-hover:brightness-125" style={{ height: `${Math.max(height, 4)}%`, backgroundColor: color, boxShadow: color !== '#1e293b' ? `0 0 15px ${color}33` : 'none' }}></div>
                                            <span className="text-[7px] text-slate-600 font-mono uppercase text-center mt-2 truncate w-full tracking-tighter">{INSULATION_LABELS[status].replace('Isol. ', '')}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* NEW: DAILY PRODUCTIVITY CHART */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-2xl relative overflow-hidden">
                        <h3 className="text-[10px] font-mono font-bold text-green-400 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
                            <Activity size={14}/> DAILY_WELDING_OUTPUT (m)
                        </h3>
                        <div className="flex items-end justify-around gap-1 h-24">
                            {stats.sortedDailyProd.length > 0 ? stats.sortedDailyProd.map(([date, value]) => {
                                const maxVal = Math.max(...stats.sortedDailyProd.map(d => d[1]), 1);
                                const height = (value / maxVal) * 100;
                                return (
                                    <div key={date} className="flex flex-col items-center flex-1 h-full justify-end group">
                                        <div className="w-full bg-green-500/20 border-t border-green-500/50 transition-all group-hover:bg-green-500/40" style={{ height: `${Math.max(height, 10)}%` }}></div>
                                        <span className="text-[6px] text-slate-600 font-mono uppercase text-center mt-2 tracking-tighter">{date.split('-').slice(1).join('/')}</span>
                                    </div>
                                )
                            }) : (
                                <div className="w-full h-full flex items-center justify-center border border-dashed border-slate-800 rounded">
                                    <span className="text-[8px] font-mono text-slate-700 uppercase tracking-widest">No production data recorded</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-2xl flex-1 flex flex-col">
                            <div className="p-4 border-b border-slate-800 bg-slate-950/50 rounded-t-xl flex justify-between items-center">
                                <h3 className="text-[10px] font-mono font-bold text-white uppercase tracking-widest flex items-center gap-2"><Package size={14} className="text-yellow-500"/> BILL_OF_MATERIALS_SUMMARY</h3>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Verified</span>
                                </div>
                            </div>
                            <div className="p-0 overflow-hidden">
                                <table className="w-full text-[10px] text-left font-mono">
                                    <thead className="bg-slate-950 text-slate-600 uppercase">
                                        <tr><th className="p-3 font-normal tracking-widest border-b border-slate-800">COMPONENT_DESC</th><th className="p-3 text-right font-normal tracking-widest border-b border-slate-800">QTY_EST</th><th className="p-3 text-right font-normal tracking-widest border-b border-slate-800">UNIT</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {Object.entries(stats.bom).map(([diameterInch, length]) => (
                                            <tr key={diameterInch} className="hover:bg-slate-800/20 transition-colors group">
                                                <td className="p-3 text-slate-400 group-hover:text-slate-200 transition-colors">CARBON_STEEL_PIPE - <span className="text-blue-500 font-bold">{diameterInch}"</span></td>
                                                <td className="p-3 text-right text-white font-bold">{(length as number).toFixed(3)}</td>
                                                <td className="p-3 text-right text-slate-600">METERS</td>
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
            <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-slate-800 flex flex-wrap gap-4 items-center shadow-xl">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <input type="text" placeholder="SEARCH_SPOOL_OR_LINE..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-slate-200 font-mono text-[10px] uppercase tracking-widest outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"/>
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-600" />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-400 font-mono text-[10px] uppercase tracking-widest outline-none focus:ring-1 focus:ring-blue-500/50 transition-all">
                        <option value="ALL">ALL_STATUS</option>
                        {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s].toUpperCase()}</option>)}
                    </select>
                </div>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col shadow-2xl">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono">
                        <thead className="bg-slate-950 text-slate-600 uppercase text-[9px] font-bold tracking-widest">
                            <tr><th className="p-4 w-12 text-center border-b border-slate-800"><input type="checkbox" checked={allFilteredSelected && filteredPipes.length > 0} onChange={handleSelectAll} className="rounded border-slate-700 bg-slate-900 text-blue-600"/></th><th className="p-4 border-b border-slate-800">SPOOL_ID</th><th className="p-4 border-b border-slate-800">LINE_DESC</th><th className="p-4 border-b border-slate-800">STATUS</th><th className="p-4 border-b border-slate-800">INSULATION</th><th className="p-4 border-b border-slate-800">INSP_ID</th><th className="p-4 border-b border-slate-800">TIMESTAMP</th><th className="p-4 text-center border-b border-slate-800">QC</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 text-[10px]">
                            {filteredPipes.map(pipe => (
                                <tr key={pipe.id} className={`cursor-pointer transition-colors ${selectedIds.includes(pipe.id) ? 'bg-blue-500/10' : 'hover:bg-slate-800/30'}`} onClick={() => onSelectPipe?.(pipe.id, false)}>
                                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(pipe.id)} onChange={() => onSelectPipe?.(pipe.id, true)} className="rounded border-slate-700 bg-slate-900 text-blue-600"/></td>
                                    <td className="p-4 text-blue-400 font-bold">{pipe.spoolId || 'N/A'}</td>
                                    <td className="p-4 text-slate-400 group-hover:text-slate-200">{pipe.name.toUpperCase()}</td>
                                    <td className="p-4"><span className="px-2 py-0.5 rounded-[2px] font-bold text-white uppercase text-[8px] tracking-tighter" style={{ backgroundColor: STATUS_COLORS[pipe.status], boxShadow: `0 0 10px ${STATUS_COLORS[pipe.status]}44` }}>{STATUS_LABELS[pipe.status]}</span></td>
                                    <td className="p-4"><span className="px-2 py-0.5 rounded-[2px] font-bold uppercase text-[8px] tracking-tighter" style={{ backgroundColor: pipe.insulationStatus && pipe.insulationStatus !== 'NONE' ? INSULATION_COLORS[pipe.insulationStatus] : 'transparent', color: pipe.insulationStatus === 'FINISHED' ? '#0f172a' : '#64748b', border: pipe.insulationStatus === 'NONE' ? '1px solid #334155' : 'none' }}>{INSULATION_LABELS[pipe.insulationStatus || 'NONE']}</span></td>
                                    <td className="p-4 text-slate-500">{pipe.welderInfo?.welderId || '---'}</td>
                                    <td className="p-4 text-slate-500">{pipe.welderInfo?.weldDate || '---'}</td>
                                    <td className="p-4 text-center">{pipe.welderInfo?.visualInspection ? <CheckSquare size={12} className="text-green-500 mx-auto"/> : <div className="w-1 h-1 rounded-full bg-slate-800 mx-auto"></div>}</td>
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
