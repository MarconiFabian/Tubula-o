
import React, { useState, useEffect, useMemo } from 'react';
import { PipeSegment, PipeStatus, InsulationStatus, PlanningFactors, ProductivitySettings } from '../types';
import { STATUS_LABELS, STATUS_COLORS, ALL_STATUSES, INSULATION_LABELS, INSULATION_COLORS, ALL_INSULATION_STATUSES, PIPING_REMAINING_FACTOR, INSULATION_REMAINING_FACTOR, HOURS_PER_DAY } from '../constants';
import { X, CheckCircle, AlertCircle, FileText, Trash2, Shield, Wrench, Layers, MapPin, Timer, Truck, Construction, Users, ArrowUpCircle, Calendar, Moon, ShieldAlert, Clock, Activity, Settings2, Sliders, Info, Percent, ZapOff, HardHat, Copy, BarChart3 } from 'lucide-react';
import PlanningReportModal from './PlanningReportModal';
import { getWorkingEndDate } from '../utils/planning';

interface SidebarProps {
  selectedPipes: PipeSegment[];
  onUpdateSingle: (updatedPipe: PipeSegment) => void;
  onUpdateBatch: (updates: Partial<PipeSegment>) => void;
  onDelete: () => void;
  onClose: () => void;
  mode?: 'TRACKING' | 'PLANNING';
  startDate?: string;
  prodSettings?: ProductivitySettings;
  onUpdateProdSettings?: (settings: ProductivitySettings) => void;
  onCopy?: () => void;
}

const DEFAULT_FACTORS: PlanningFactors = { 
    hasCrane: false, 
    accessType: 'NONE', 
    hasBlockage: false, 
    isNightShift: false,
    isCriticalArea: false,
    delayHours: 0, 
    teamCount: 1 
};

// Tabelas de saldo remanescente (REMOVIDO - USANDO CONSTANTS)

const Sidebar: React.FC<SidebarProps> = ({ 
    selectedPipes, onUpdateSingle, onUpdateBatch, onDelete, onClose, 
    mode = 'TRACKING', startDate = new Date().toISOString().split('T')[0],
    prodSettings, onUpdateProdSettings, onCopy
}) => {
  const [showMetricsConfig, setShowMetricsConfig] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [localTeamCount, setLocalTeamCount] = useState<string>('1');

  const isBatch = selectedPipes.length > 1;
  const activeFactors = selectedPipes[0]?.planningFactors || DEFAULT_FACTORS;

  useEffect(() => {
      if (selectedPipes.length > 0) {
          setLocalTeamCount(String(activeFactors.teamCount || 1));
      }
  }, [selectedPipes[0]?.id]);

  const handleUpdateFactors = (updates: Partial<PlanningFactors>) => {
      onUpdateBatch({
          planningFactors: {
              ...activeFactors,
              ...updates
          }
      });
  };

  const totals = useMemo(() => {
      if (!prodSettings) return { totalHH: 0, daysNeeded: 0, endDate: '', isZeroIndex: false };
      
      let totalHH = 0;
      let weightedHours = 0;
      let hasWorkButZeroIndex = false;
      
      selectedPipes.forEach(p => {
          const pipingFactor = PIPING_REMAINING_FACTOR[p.status] || 0;
          const insulationFactor = INSULATION_REMAINING_FACTOR[p.insulationStatus || 'NONE'] || 0;

          // Se o status é pendente mas o índice de produtividade está 0
          if ((pipingFactor > 0 && prodSettings.pipingBase === 0) || (insulationFactor > 0 && prodSettings.insulationBase === 0)) {
              hasWorkButZeroIndex = true;
          }

          const pipeEffort = (p.length * prodSettings.pipingBase) * pipingFactor;
          const insEffort = (p.length * prodSettings.insulationBase) * insulationFactor;
          
          let baseEffort = pipeEffort + insEffort;
          if (baseEffort <= 0) return;

          const factors = p.planningFactors || DEFAULT_FACTORS;
          let mult = 1.0; // Nível de Esforço 0
          if (factors.hasCrane) mult += prodSettings.weights.crane;
          if (factors.hasBlockage) mult += prodSettings.weights.blockage;
          if (factors.isNightShift) mult += prodSettings.weights.nightShift;
          if (factors.isCriticalArea) mult += prodSettings.weights.criticalArea;
          if (factors.accessType === 'SCAFFOLD_FLOOR') mult += prodSettings.weights.scaffoldFloor;
          if (factors.accessType === 'SCAFFOLD_HANGING') mult += prodSettings.weights.scaffoldHanging;
          if (factors.accessType === 'PTA') mult += prodSettings.weights.pta;
          
          const finalHH = (baseEffort * mult) + (factors.delayHours || 0);
          totalHH += finalHH;
          weightedHours += (finalHH / (factors.teamCount || 1));
      });

      const daysNeeded = Math.ceil(weightedHours / HOURS_PER_DAY);
      const start = new Date((activeFactors.customStartDate || startDate) + 'T12:00:00');
      const end = getWorkingEndDate(start, daysNeeded);

      return { 
          totalHH, 
          weightedHours, // Retornando as horas ponderadas (tempo real)
          daysNeeded, 
          endDate: end.toLocaleDateString('pt-BR'), 
          isZeroIndex: hasWorkButZeroIndex && totalHH === 0 
      };
  }, [selectedPipes, startDate, prodSettings, activeFactors.customStartDate]);

  if (mode === 'PLANNING' && prodSettings && onUpdateProdSettings) {
      return (
        <div className="h-full flex flex-col bg-slate-900 border-l border-slate-700 shadow-2xl overflow-y-auto w-full animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-purple-900/30">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Timer size={18} className="text-purple-400" /> Planejamento 4D
                </h2>
                <div className="flex gap-2">
                    <button onClick={() => setShowMetricsConfig(!showMetricsConfig)} className={`p-1.5 rounded transition-all ${showMetricsConfig ? 'bg-purple-600 text-white shadow-lg' : 'hover:bg-slate-700 text-slate-400'}`} title="Configurar Índices">
                        <Settings2 size={18}/>
                    </button>
                    <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400"><X size={20} /></button>
                </div>
            </div>

            <div className="p-6 space-y-6 flex-1">
                {showMetricsConfig && (
                    <div className="bg-slate-950 border border-purple-500/50 p-4 rounded-xl space-y-4 animate-in slide-in-from-top duration-300 shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-2">
                                <Sliders size={12}/> Editor de Índices (h/m)
                            </h3>
                            <Percent size={12} className="text-slate-600" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] text-slate-500 uppercase font-bold">Base Tubo (h/m)</label>
                                <input type="number" step="0.01" value={prodSettings.pipingBase} onChange={(e)=>onUpdateProdSettings({...prodSettings, pipingBase: parseFloat(e.target.value)||0})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-purple-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] text-slate-500 uppercase font-bold">Base Isol. (h/m)</label>
                                <input type="number" step="0.01" value={prodSettings.insulationBase} onChange={(e)=>onUpdateProdSettings({...prodSettings, insulationBase: parseFloat(e.target.value)||0})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-purple-500" />
                            </div>
                        </div>

                        <div className="border-t border-slate-800 pt-3 mt-2">
                            <h4 className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-3">Pesos de Complexidade (Agravantes)</h4>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                {[
                                    { key: 'crane', label: 'Guindaste' },
                                    { key: 'blockage', label: 'Obstrução' },
                                    { key: 'nightShift', label: 'Noturno' },
                                    { key: 'criticalArea', label: 'Área Crítica' },
                                    { key: 'scaffoldFloor', label: 'Andaime' },
                                    { key: 'scaffoldHanging', label: 'Balanço' },
                                    { key: 'pta', label: 'PTA' }
                                ].map(item => (
                                    <div key={item.key} className="flex items-center justify-between gap-2">
                                        <label className="text-[8px] text-slate-500 uppercase font-bold truncate">{item.label}</label>
                                        <input 
                                            type="number" 
                                            step="0.05" 
                                            value={(prodSettings.weights as any)[item.key]} 
                                            onChange={(e) => onUpdateProdSettings({
                                                ...prodSettings,
                                                weights: {
                                                    ...prodSettings.weights,
                                                    [item.key]: parseFloat(e.target.value) || 0
                                                }
                                            })}
                                            className="w-12 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-[10px] text-purple-400 font-bold outline-none focus:border-purple-500 text-right" 
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-slate-950 border border-purple-500/30 p-5 rounded-2xl shadow-inner relative overflow-hidden group">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Saldo Remanescente</span>
                        <div className="bg-purple-600/20 px-2 py-0.5 rounded text-[9px] text-purple-300 font-bold border border-purple-500/20">Cronograma de Campo</div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mb-6 relative">
                        <div className="flex flex-col items-center z-10 relative">
                            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-1 shadow-lg cursor-pointer hover:border-purple-500 transition-colors relative overflow-hidden group/date">
                                <Calendar size={16} className="text-slate-400 group-hover/date:text-purple-400"/>
                                <input type="date" value={activeFactors.customStartDate || startDate} onChange={(e) => handleUpdateFactors({ customStartDate: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark]" />
                            </div>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">Início</span>
                            <span className="text-[11px] font-bold text-white">{new Date((activeFactors.customStartDate || startDate) + 'T12:00:00').toLocaleDateString('pt-BR').split('/')[0]}/{new Date((activeFactors.customStartDate || startDate) + 'T12:00:00').toLocaleDateString('pt-BR').split('/')[1]}</span>
                        </div>
                        
                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full relative mx-1 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-purple-400 animate-pulse"></div>
                            <div className="absolute top-[-20px] left-1/2 -translate-x-1/2 text-[10px] text-purple-300 font-black tracking-tighter uppercase whitespace-nowrap">
                                {totals.daysNeeded} Dias Úteis
                            </div>
                        </div>

                        <div className="flex flex-col items-center z-10">
                            <div className="w-10 h-10 rounded-full bg-purple-900 border border-purple-500/40 flex items-center justify-center mb-1 shadow-lg shadow-purple-500/20"><CheckCircle size={16} className="text-purple-400"/></div>
                            <span className="text-[9px] text-purple-400 font-bold uppercase">Término</span>
                            <span className="text-[11px] font-bold text-purple-300">{totals.daysNeeded > 0 ? totals.endDate.split('/')[0] + '/' + totals.endDate.split('/')[1] : 'IMEDIATO'}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                        <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Saldo de Horas (Total)</span>
                            <span className="text-xl font-black text-white">{totals.totalHH.toFixed(1)}<span className="text-[10px] ml-1 text-slate-500">H/H</span></span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Equipes</span>
                            <span className="text-xl font-black text-blue-400">{activeFactors.teamCount}<span className="text-[10px] ml-1 text-slate-500">EQP</span></span>
                        </div>
                        <div className="col-span-2 pt-2 mt-2 border-t border-slate-800 flex justify-between items-center">
                            <span className="text-[9px] text-purple-400 font-black uppercase tracking-widest">Duração Estimada:</span>
                            <span className="text-xl font-black text-purple-400 animate-in fade-in zoom-in duration-500" key={totals.weightedHours}>
                                {totals.weightedHours.toFixed(1)}<span className="text-[10px] ml-1">HORAS</span>
                            </span>
                        </div>
                    </div>

                    <button 
                        onClick={() => setShowReport(true)}
                        className="w-full mt-4 bg-slate-900 hover:bg-slate-800 border border-purple-500/30 p-3 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black text-purple-400 uppercase tracking-widest transition-all group"
                    >
                        <BarChart3 size={14} className="group-hover:scale-110 transition-transform" />
                        Ver Análise Profissional
                    </button>
                </div>

                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 focus-within:border-purple-500 transition-colors">
                             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2"><Users size={12}/> Alocação Equipes</label>
                             <input type="number" min="1" value={localTeamCount} onChange={(e) => { setLocalTeamCount(e.target.value); handleUpdateFactors({ teamCount: parseInt(e.target.value) || 1 }) }} className="w-full bg-transparent text-white font-black text-xl outline-none" />
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 focus-within:border-purple-500 transition-colors">
                             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2"><Clock size={12}/> Atrasos Previstos (h)</label>
                             <input type="number" step="0.5" value={activeFactors.delayHours} onChange={(e) => handleUpdateFactors({ delayHours: parseFloat(e.target.value) || 0 })} className="w-full bg-transparent text-white font-black text-xl outline-none" />
                        </div>
                     </div>

                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 pt-2"><HardHat size={14}/> Nível de Esforço (Acesso)</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { id: 'NONE', label: 'Nível 0 (Solo)', icon: <CheckCircle size={12}/> },
                            { id: 'SCAFFOLD_FLOOR', label: `Andaime (+${(prodSettings.weights.scaffoldFloor * 100).toFixed(0)}%)`, icon: <Layers size={12}/> },
                            { id: 'SCAFFOLD_HANGING', label: `Balanço (+${(prodSettings.weights.scaffoldHanging * 100).toFixed(0)}%)`, icon: <ArrowUpCircle size={12}/> },
                            { id: 'PTA', label: `PTA (+${(prodSettings.weights.pta * 100).toFixed(0)}%)`, icon: <Truck size={12}/> }
                        ].map(opt => (
                            <button key={opt.id} onClick={() => handleUpdateFactors({ accessType: opt.id as any })} className={`flex items-center gap-2 p-4 rounded-xl border text-[10px] font-black transition-all uppercase tracking-tight ${activeFactors.accessType === opt.id ? 'bg-purple-600 border-purple-400 text-white shadow-lg' : 'bg-slate-800/50 border-slate-800 text-slate-500 hover:bg-slate-800'}`}>
                                {opt.icon} {opt.label}
                            </button>
                        ))}
                    </div>

                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 pt-2"><Construction size={14}/> Agravantes de Campo</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            { id: 'hasCrane', label: 'Içamento / Guindaste', weight: prodSettings.weights.crane, icon: <Truck size={16}/>, color: 'text-blue-400' },
                            { id: 'hasBlockage', label: 'Interferência / Obstrução', weight: prodSettings.weights.blockage, icon: <AlertCircle size={16}/>, color: 'text-orange-400' },
                            { id: 'isNightShift', label: 'Turno Noturno', weight: prodSettings.weights.nightShift, icon: <Moon size={16}/>, color: 'text-yellow-200' },
                            { id: 'isCriticalArea', label: 'Área Crítica / Risco', weight: prodSettings.weights.criticalArea, icon: <ShieldAlert size={16}/>, color: 'text-red-400' }
                        ].map(factor => (
                            <button key={factor.id} onClick={() => handleUpdateFactors({ [factor.id]: !(activeFactors as any)[factor.id] })} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${ (activeFactors as any)[factor.id] ? 'bg-purple-900/40 border-purple-500 text-white shadow-lg ring-1 ring-purple-500/50' : 'bg-slate-800/40 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                                <div className={(activeFactors as any)[factor.id] ? factor.color : 'text-slate-600'}>{factor.icon}</div>
                                <div className="flex-1">
                                    <p className="text-[11px] font-black uppercase tracking-tight">{factor.label}</p>
                                    <p className="text-[9px] opacity-70 font-bold">Esforço +{ (factor.weight * 100).toFixed(0) }%</p>
                                </div>
                                {(activeFactors as any)[factor.id] && <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow-lg"><CheckCircle size={12} className="text-white"/></div>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            <div className="p-4 bg-slate-950 border-t border-slate-700">
                 <button onClick={onClose} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-purple-600/20 transition-all uppercase tracking-[0.2em] text-xs">Atualizar Cronograma</button>
            </div>

            <PlanningReportModal isOpen={showReport} onClose={() => setShowReport(false)} />
        </div>
      );
  }

  // --- MODO RASTREAMENTO (BATCH) ---
  if (isBatch) {
      const totalLength = selectedPipes.reduce((acc, p) => acc + p.length, 0);
      const totalArea = selectedPipes.reduce((acc, p) => acc + (Math.PI * p.diameter * p.length), 0);

      return (
        <div className="h-full flex flex-col bg-slate-900 border-l border-slate-700 shadow-xl overflow-y-auto w-full absolute right-0 top-0 z-20">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                <h2 className="text-lg font-bold text-white flex items-center gap-2"><Layers size={18} className="text-blue-400" /> Edição em Lote</h2>
                <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6 flex-1">
                <div className="bg-blue-900/30 text-blue-300 p-4 rounded-xl border border-blue-500/20 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <Activity size={24} />
                        <div><p className="font-bold">{selectedPipes.length} Segmentos</p><p className="text-xs opacity-70">Seleção Múltipla</p></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t border-blue-500/20 pt-3 mt-1">
                        <div>
                            <span className="text-[9px] uppercase font-bold opacity-70 block mb-1">Comp. Total</span>
                            <div className="text-xl font-mono font-bold text-white leading-none">{totalLength.toFixed(2)}<span className="text-xs ml-0.5 text-blue-400">m</span></div>
                        </div>
                        <div>
                            <span className="text-[9px] uppercase font-bold opacity-70 block mb-1">Área Sup.</span>
                            <div className="text-xl font-mono font-bold text-white leading-none">{totalArea.toFixed(2)}<span className="text-xs ml-0.5 text-blue-400">m²</span></div>
                        </div>
                    </div>
                </div>

                {/* Batch Spool Input */}
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Atribuir Spool (Lote)</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Ex: SP-01"
                            className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-blue-500 font-mono uppercase"
                            id="batch-spool-input"
                        />
                        <button 
                            onClick={() => {
                                const val = (document.getElementById('batch-spool-input') as HTMLInputElement).value;
                                if(val) onUpdateBatch({ spoolId: val.toUpperCase() });
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded font-bold text-xs transition-colors"
                        >
                            APLICAR
                        </button>
                    </div>
                    <p className="text-[9px] text-slate-600 mt-1">Define o mesmo ID para todos os itens selecionados.</p>
                </div>

                <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Definir Status</label><div className="grid grid-cols-2 gap-2">{ALL_STATUSES.map(s => (<button key={s} onClick={() => onUpdateBatch({ status: s as PipeStatus })} className="p-2 rounded font-bold text-[10px] text-white transition-all uppercase" style={{ backgroundColor: STATUS_COLORS[s] }}>{STATUS_LABELS[s]}</button>))}</div></div>
                <div><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Proteção Térmica</label><div className="grid grid-cols-1 gap-2">{ALL_INSULATION_STATUSES.map(i => (<button key={i} onClick={() => onUpdateBatch({ insulationStatus: i as InsulationStatus })} className="flex items-center gap-3 p-2 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-slate-400 hover:text-white transition-all"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: INSULATION_COLORS[i] === 'transparent' ? '#475569' : INSULATION_COLORS[i] }} /> {INSULATION_LABELS[i]}</button>))}</div></div>
            </div>
            <div className="p-4 bg-slate-950 border-t border-slate-700 grid grid-cols-2 gap-2">
                {onCopy && <button onClick={onCopy} className="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors uppercase text-xs tracking-widest"><Copy size={16} /> Copiar</button>}
                <button onClick={onDelete} className={`${onCopy ? '' : 'col-span-2'} bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors uppercase text-xs tracking-widest`}><Trash2 size={16} /> Excluir</button>
            </div>
        </div>
      )
  }

  // --- MODO RASTREAMENTO (INDIVIDUAL) ---
  const singlePipe = selectedPipes[0];
  if (!singlePipe) return null;
  return (
    <div className="h-full flex flex-col bg-slate-900 border-l border-slate-700 shadow-xl overflow-y-auto w-full absolute right-0 top-0 z-20">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><FileText size={18} /> {singlePipe.name || 'Segmento'}</h2>
        <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded text-slate-400"><X size={20} /></button>
      </div>
      <div className="p-6 space-y-6 flex-1">
        <div className="space-y-4">
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-3 block flex items-center gap-2"><Layers size={14}/> Especificações de Material</label>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="flex flex-col"><span className="text-slate-500">Material</span><span className="text-white font-bold">Aço Carbono A106-B</span></div>
                    <div className="flex flex-col"><span className="text-slate-500">Schedule</span><span className="text-white font-bold">SCH 40</span></div>
                    <div className="flex flex-col"><span className="text-slate-500">Pressão Projeto</span><span className="text-white font-bold">150 PSI</span></div>
                    <div className="flex flex-col"><span className="text-slate-500">Temp. Projeto</span><span className="text-white font-bold">80°C</span></div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[10px] font-bold text-slate-500 uppercase">ID Linha</label><div className="text-blue-400 font-mono text-xs">{singlePipe.id}</div></div>
                <div><label className="text-[10px] font-bold text-slate-500 uppercase">Comp.</label><div className="text-white font-bold text-xs">{singlePipe.length.toFixed(2)}m</div></div>
                
                {/* Spool ID Input */}
                <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Spool ID</label>
                    <input 
                        type="text" 
                        value={singlePipe.spoolId || ''} 
                        onChange={(e) => onUpdateSingle({ ...singlePipe, spoolId: e.target.value.toUpperCase() })}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-blue-500 font-mono uppercase"
                        placeholder="Ex: SP-01"
                    />
                </div>

                <div className="col-span-2 border-t border-slate-800 pt-2 flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Área Superfície</label>
                    <div className="text-white font-mono text-xs font-bold">{(Math.PI * singlePipe.diameter * singlePipe.length).toFixed(2)}m²</div>
                </div>
            </div>
            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Status Montagem</label><div className="grid grid-cols-2 gap-2">{ALL_STATUSES.map(s => (<button key={s} onClick={() => onUpdateSingle({ ...singlePipe, status: s as PipeStatus })} className={`p-2 rounded font-bold text-[9px] border transition-all ${singlePipe.status === s ? 'ring-2 ring-white scale-105 opacity-100' : 'opacity-40'}`} style={{ backgroundColor: STATUS_COLORS[s], color: '#fff' }}>{STATUS_LABELS[s]}</button>))}</div></div>
        </div>
        <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800"><label className="text-[10px] font-bold text-slate-500 uppercase mb-3 block flex items-center gap-2"><Shield size={14}/> Isolamento</label><div className="grid grid-cols-1 gap-2">{ALL_INSULATION_STATUSES.map(i => (<button key={i} onClick={() => onUpdateSingle({ ...singlePipe, insulationStatus: i as InsulationStatus })} className={`flex items-center gap-3 p-2.5 rounded-lg text-[10px] font-bold border transition-all ${singlePipe.insulationStatus === i ? 'bg-slate-800 border-slate-700 text-white shadow-inner' : 'border-transparent text-slate-600 hover:text-slate-400'}`}><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: INSULATION_COLORS[i] === 'transparent' ? '#334155' : INSULATION_COLORS[i] }} /> {INSULATION_LABELS[i]}</button>))}</div></div>
      </div>
      <div className="p-4 bg-slate-950 border-t border-slate-700 grid grid-cols-2 gap-2">
          {onCopy && <button onClick={onCopy} className="bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors uppercase text-xs tracking-widest"><Copy size={16} /> Copiar</button>}
          <button onClick={onDelete} className={`${onCopy ? '' : 'col-span-2'} bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all uppercase text-[10px] tracking-widest`}><Trash2 size={16} /> Excluir</button>
      </div>
    </div>
  );
};

export default Sidebar;
