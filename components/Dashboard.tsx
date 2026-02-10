import React, { useMemo, useRef, useState } from 'react';
import { PipeSegment } from '../types';
import { STATUS_COLORS, STATUS_LABELS, ALL_STATUSES, INSULATION_COLORS, INSULATION_LABELS, ALL_INSULATION_STATUSES } from '../constants';
import { Activity, FileDown, Upload, Image as ImageIcon, Map as MapIcon, Layers, Shield, ClipboardList } from 'lucide-react';

interface DashboardProps {
  pipes: PipeSegment[];
  onExportPDF?: () => void;
  isExporting?: boolean;
  exportMode?: boolean;
  secondaryImage?: string | null;
  mapImage?: string | null;
  onUploadSecondary?: (img: string | null) => void;
  onUploadMap?: (img: string | null) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
    pipes = [], 
    onExportPDF, 
    isExporting = false, 
    exportMode = false,
    secondaryImage,
    mapImage,
    onUploadSecondary,
    onUploadMap
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'BOM'>('OVERVIEW');
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

    // --- BOM CALCULATIONS ---
    const pipesByDiameter: Record<number, number> = {};
    pipes.forEach(p => {
        const d = p.diameter || 0.3; // Default 300mm if undefined
        pipesByDiameter[d] = (pipesByDiameter[d] || 0) + p.length;
    });

    return { totalLength, pipeCounts, insulationCounts, pipesByDiameter };
  }, [pipes]);

  // --- EXPORT VIEW (SPLIT PIPING VS INSULATION) ---
  if (exportMode) {
      return (
          <div className="flex flex-col h-full w-full gap-4">
               {/* Top Half: PIPING STATS */}
               <div className="flex-1 border-b border-slate-600 pb-2">
                    <div className="flex items-center gap-2 mb-2">
                        <Layers size={24} className="text-blue-400" />
                        <h3 className="text-xl font-bold text-blue-400 tracking-widest uppercase">Tubulação - Status Físico</h3>
                        <div className="ml-auto bg-slate-900 px-3 py-1 rounded border border-slate-600">
                             <span className="text-slate-400 text-sm mr-2">TOTAL METROS:</span>
                             <span className="text-white font-bold text-lg">{stats.totalLength.toFixed(2)}m</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 h-[120px]">
                        {ALL_STATUSES.map(status => (
                            <div key={status} className="bg-slate-900/60 rounded-lg border-l-4 flex flex-col justify-center items-center relative" style={{ borderColor: STATUS_COLORS[status] }}>
                                <span className="text-4xl font-bold text-white">{stats.pipeCounts[status]}</span>
                                <span className="text-xs text-slate-400 uppercase tracking-widest mt-1">{STATUS_LABELS[status]}</span>
                                {/* Mini percentage bar at bottom */}
                                <div className="absolute bottom-2 w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                                     <div className="h-full" style={{ width: `${(stats.pipeCounts[status] / (pipes.length || 1)) * 100}%`, backgroundColor: STATUS_COLORS[status] }} />
                                </div>
                            </div>
                        ))}
                    </div>
               </div>

               {/* Bottom Half: INSULATION STATS */}
               <div className="flex-1 pt-2">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield size={24} className="text-yellow-400" />
                        <h3 className="text-xl font-bold text-yellow-400 tracking-widest uppercase">Proteção Térmica / Isolamento</h3>
                    </div>
                    <div className="grid grid-cols-4 gap-4 h-[120px]">
                        {ALL_INSULATION_STATUSES.map(status => (
                            <div key={status} className="bg-slate-900/60 rounded-lg border-t-4 flex flex-col justify-center items-center relative" style={{ borderColor: INSULATION_COLORS[status] === 'transparent' ? '#64748b' : INSULATION_COLORS[status] }}>
                                <span className="text-4xl font-bold text-white">{stats.insulationCounts[status]}</span>
                                <span className="text-xs text-slate-400 uppercase tracking-widest mt-1 text-center px-1">{INSULATION_LABELS[status]}</span>
                            </div>
                        ))}
                    </div>
               </div>
          </div>
      )
  }

  // --- INTERACTIVE VIEW ---
  return (
    <div className="flex flex-col gap-6">
      {onExportPDF && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl gap-4">
             <div>
                 <h2 className="text-xl font-bold text-white flex items-center gap-2"><Activity className="text-blue-500" /> Painel de Controle (HUD)</h2>
                 <p className="text-slate-400 text-sm">Adicione as fotos abaixo para compor o relatório final.</p>
             </div>
             <button onClick={onExportPDF} disabled={isExporting} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold flex gap-2 items-center transition-all shadow-lg shadow-blue-500/20">
                <FileDown size={20} /> {isExporting ? 'Gerando PDF...' : 'Exportar Relatório PDF'}
            </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Main 3D Placeholder */}
          <div className="col-span-12 md:col-span-8 h-80 bg-slate-900 rounded-xl border-2 border-dashed border-slate-800 flex flex-col items-center justify-center relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 to-transparent pointer-events-none" />
               <Activity size={48} className="text-slate-700 mb-2" />
               <p className="text-slate-500 font-bold uppercase tracking-wider">Vista Principal 3D</p>
               <p className="text-slate-600 text-xs mt-1">Será capturada automaticamente do modelo</p>
          </div>

          {/* Secondary Image Upload */}
          <div className="col-span-12 md:col-span-4 h-80 bg-slate-900 rounded-xl border border-slate-800 flex flex-col relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-full p-3 bg-black/60 backdrop-blur-sm z-10 flex justify-between items-center border-b border-white/10">
                   <span className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-2"><ImageIcon size={14} /> Foto Obra</span>
                   {secondaryImage && <button onClick={() => onUploadSecondary?.(null)} className="text-xs text-red-400 hover:text-red-300 font-bold">Remover</button>}
               </div>
               
               {secondaryImage ? (
                   <img src={secondaryImage} className="w-full h-full object-cover" />
               ) : (
                   <div className="flex-1 flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => secInputRef.current?.click()}>
                       <div className="bg-slate-800 p-4 rounded-full mb-3"><Upload size={24} className="text-slate-400" /></div>
                       <p className="text-slate-400 text-sm font-bold">Carregar Foto</p>
                       <p className="text-slate-600 text-xs mt-1">Clique para selecionar</p>
                   </div>
               )}
               <input type="file" ref={secInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, onUploadSecondary)} />
          </div>

          {/* Map Image Upload */}
          <div className="col-span-12 md:col-span-4 h-64 bg-slate-900 rounded-xl border border-slate-800 flex flex-col relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-full p-3 bg-black/60 backdrop-blur-sm z-10 flex justify-between items-center border-b border-white/10">
                   <span className="text-xs font-bold text-green-400 uppercase flex items-center gap-2"><MapIcon size={14} /> Mapa Local</span>
                   {mapImage && <button onClick={() => onUploadMap?.(null)} className="text-xs text-red-400 hover:text-red-300 font-bold">Remover</button>}
               </div>
               
               {mapImage ? (
                   <img src={mapImage} className="w-full h-full object-cover" />
               ) : (
                   <div className="flex-1 flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => mapInputRef.current?.click()}>
                       <div className="bg-slate-800 p-3 rounded-full mb-3"><MapIcon size={20} className="text-slate-400" /></div>
                       <p className="text-slate-400 text-sm font-bold">Carregar Mapa</p>
                   </div>
               )}
               <input type="file" ref={mapInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, onUploadMap)} />
          </div>

          {/* TABS HEADER */}
          <div className="col-span-12 flex gap-4 border-b border-slate-800">
              <button onClick={() => setActiveTab('OVERVIEW')} className={`pb-2 px-4 text-sm font-bold uppercase ${activeTab === 'OVERVIEW' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>Visão Geral</button>
              <button onClick={() => setActiveTab('BOM')} className={`pb-2 px-4 text-sm font-bold uppercase ${activeTab === 'BOM' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>Lista de Materiais (BOM)</button>
          </div>

          {activeTab === 'OVERVIEW' && (
            <div className="col-span-12 md:col-span-8 h-64 bg-slate-900 rounded-xl border border-slate-800 p-6 flex flex-col overflow-y-auto">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2 shrink-0">
                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><Activity size={16} /> Indicadores Gerais</h3>
                        <span className="text-xs text-blue-500 font-mono animate-pulse">LIVE DATA</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-8">
                        {/* Piping Section */}
                        <div>
                            <h4 className="text-blue-400 font-bold text-xs uppercase mb-3 border-b border-blue-900/30 pb-1">Status Tubulação</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-950 p-2 rounded border border-slate-800 col-span-2">
                                    <span className="text-[10px] text-slate-500 block">Total Metros</span>
                                    <span className="text-lg font-bold text-white">{stats.totalLength.toFixed(1)}m</span>
                                </div>
                                {ALL_STATUSES.map(s => (
                                    <div key={s} className="bg-slate-950 p-2 rounded border-l-2" style={{ borderColor: STATUS_COLORS[s] }}>
                                        <span className="text-lg font-bold text-white block leading-none">{stats.pipeCounts[s]}</span>
                                        <span className="text-[9px] text-slate-500 uppercase">{STATUS_LABELS[s].split(' ')[0]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Insulation Section */}
                        <div>
                            <h4 className="text-yellow-400 font-bold text-xs uppercase mb-3 border-b border-yellow-900/30 pb-1">Isolamento Térmico</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {ALL_INSULATION_STATUSES.map(s => (
                                    <div key={s} className="bg-slate-950 p-2 rounded border-t-2" style={{ borderColor: INSULATION_COLORS[s] === 'transparent' ? '#475569' : INSULATION_COLORS[s] }}>
                                        <span className="text-lg font-bold text-white block leading-none">{stats.insulationCounts[s]}</span>
                                        <span className="text-[9px] text-slate-500 uppercase">{INSULATION_LABELS[s].replace('Isol. ', '')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
            </div>
          )}

          {activeTab === 'BOM' && (
             <div className="col-span-12 h-64 bg-slate-900 rounded-xl border border-slate-800 p-6 flex flex-col overflow-y-auto">
                 <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2 shrink-0">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><ClipboardList size={16} /> Lista de Materiais Quantitativa (BOM)</h3>
                    <span className="text-xs text-slate-500">Estimativa Automática</span>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     {/* Pipes Table */}
                     <div className="col-span-2">
                         <table className="w-full text-sm text-left text-slate-400">
                             <thead className="bg-slate-800 text-xs uppercase text-slate-200">
                                 <tr>
                                     <th className="px-3 py-2">Item (Tubulação)</th>
                                     <th className="px-3 py-2 text-right">Qtd (m)</th>
                                 </tr>
                             </thead>
                             <tbody>
                                 {Object.entries(stats.pipesByDiameter).map(([diam, len]) => (
                                     <tr key={diam} className="border-b border-slate-800">
                                         <td className="px-3 py-2">Tubo Aço Carbono - {diam}m Diam.</td>
                                         <td className="px-3 py-2 text-right font-mono text-white">{(len as number).toFixed(2)}m</td>
                                     </tr>
                                 ))}
                                 {Object.keys(stats.pipesByDiameter).length === 0 && (
                                     <tr><td colSpan={2} className="px-3 py-4 text-center italic text-slate-600">Nenhum tubo desenhado</td></tr>
                                 )}
                             </tbody>
                         </table>
                     </div>
                 </div>
             </div>
          )}

      </div>
    </div>
  );
};

export default Dashboard;