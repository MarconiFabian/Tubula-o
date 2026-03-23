
import React, { useState, useEffect, useMemo } from 'react';
import { PipeSegment, PipeStatus, InsulationStatus, PlanningFactors, ProductivitySettings, AccessoryType, AccessoryStatus } from '../types';
import { STATUS_LABELS, STATUS_COLORS, ALL_STATUSES, INSULATION_LABELS, INSULATION_COLORS, ALL_INSULATION_STATUSES, PIPING_REMAINING_FACTOR, INSULATION_REMAINING_FACTOR, HOURS_PER_DAY } from '../constants';
import { X, CheckCircle, AlertCircle, FileText, Trash2, Shield, Wrench, Layers, MapPin, Timer, Truck, Construction, Users, ArrowUpCircle, Calendar, Moon, ShieldAlert, Clock, Activity, Settings2, Sliders, Info, Percent, ZapOff, HardHat, Copy, BarChart3, Flag, Package, Zap, CheckSquare, Check, CircleDot, MousePointer2 } from 'lucide-react';
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
  deadlineDate?: string | null;
  onUpdateDeadline?: (date: string | null) => void;
  placementMode?: AccessoryType | null;
  onSetPlacementMode?: (mode: AccessoryType | null) => void;
  onBatchAddSupports?: (spacing: number, status: AccessoryStatus) => void;
  onBatchUpdateSupportStatus?: (status: AccessoryStatus) => void;
  onClearAccessories?: () => void;
  onClearAllAccessories?: () => void;
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
    prodSettings, onUpdateProdSettings, onCopy, deadlineDate, onUpdateDeadline,
    placementMode, onSetPlacementMode, onBatchAddSupports, onBatchUpdateSupportStatus, onClearAccessories, onClearAllAccessories
}) => {
  const [showMetricsConfig, setShowMetricsConfig] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [localTeamCount, setLocalTeamCount] = useState<string>('1');
  const [batchSpacing, setBatchSpacing] = useState<string>('3');
  const [batchInitialStatus, setBatchInitialStatus] = useState<AccessoryStatus>(AccessoryStatus.PENDING);

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

          if ((pipingFactor > 0 && prodSettings.pipingBase === 0) || (insulationFactor > 0 && prodSettings.insulationBase === 0)) {
              hasWorkButZeroIndex = true;
          }

          const pipeEffort = (p.length * prodSettings.pipingBase) * pipingFactor;
          const insEffort = (p.length * prodSettings.insulationBase) * insulationFactor;
          
          let baseEffort = pipeEffort + insEffort;
          if (baseEffort <= 0) return;

          const factors = p.planningFactors || DEFAULT_FACTORS;
          let mult = 1.0;
          if (factors.hasCrane) mult += prodSettings.weights.crane;
          if (factors.hasBlockage) mult += prodSettings.weights.blockage;
          if (factors.isNightShift) mult += prodSettings.weights.nightShift;
          if (factors.isCriticalArea) mult += prodSettings.weights.criticalArea;
          if (factors.accessType === 'SCAFFOLD_FLOOR') mult += prodSettings.weights.scaffoldFloor;
          if (factors.accessType === 'SCAFFOLD_HANGING') mult += prodSettings.weights.scaffoldHanging;
          if (factors.accessType === 'PTA') mult += prodSettings.weights.pta;
          
          // Novos Fatores
          if (factors.weatherExposed) mult += prodSettings.globalConfig.weatherFactor;
          if (!factors.materialAvailable) mult += prodSettings.globalConfig.materialDelayFactor;

          let finalHH = (baseEffort * mult) * (1 + prodSettings.globalConfig.reworkFactor) + (factors.delayHours || 0);
          totalHH += finalHH;
          weightedHours += (finalHH / (factors.teamCount || 1));
      });

      const totalHHWithBuffer = totalHH * (1 + prodSettings.globalConfig.safetyBuffer);
      const weightedHoursWithBuffer = weightedHours * (1 + prodSettings.globalConfig.safetyBuffer);

      const daysNeeded = Math.ceil(weightedHoursWithBuffer / prodSettings.globalConfig.shiftHours);
      const start = new Date((activeFactors.customStartDate || startDate) + 'T12:00:00');
      const end = getWorkingEndDate(start, daysNeeded, prodSettings.globalConfig.workOnWeekends);

      return { 
          totalHH: totalHHWithBuffer, 
          weightedHours: weightedHoursWithBuffer,
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
                                <Sliders size={12}/> Configurações Globais
                            </h3>
                            <Settings2 size={12} className="text-slate-600" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] text-slate-500 uppercase font-bold">Jornada (h/dia)</label>
                                <input type="number" step="0.1" value={prodSettings.globalConfig.shiftHours} onChange={(e)=>onUpdateProdSettings({...prodSettings, globalConfig: {...prodSettings.globalConfig, shiftHours: parseFloat(e.target.value)||0}})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-purple-500" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] text-slate-500 uppercase font-bold">Margem Seg. (%)</label>
                                <input type="number" step="0.01" value={prodSettings.globalConfig.safetyBuffer * 100} onChange={(e)=>onUpdateProdSettings({...prodSettings, globalConfig: {...prodSettings.globalConfig, safetyBuffer: (parseFloat(e.target.value)||0)/100}})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-purple-500" />
                            </div>
                            <div className="flex items-center gap-2 col-span-2">
                                <input type="checkbox" checked={prodSettings.globalConfig.workOnWeekends} onChange={(e)=>onUpdateProdSettings({...prodSettings, globalConfig: {...prodSettings.globalConfig, workOnWeekends: e.target.checked}})} className="rounded border-slate-700 bg-slate-900 text-purple-600" />
                                <label className="text-[9px] text-slate-400 uppercase font-bold">Trabalhar Fins de Semana</label>
                            </div>
                        </div>

                        <div className="border-t border-slate-800 pt-3">
                            <h4 className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-3">Índices Base (h/m)</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 uppercase font-bold">Tubo</label>
                                    <input type="number" step="0.01" value={prodSettings.pipingBase} onChange={(e)=>onUpdateProdSettings({...prodSettings, pipingBase: parseFloat(e.target.value)||0})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-purple-500" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] text-slate-500 uppercase font-bold">Isol.</label>
                                    <input type="number" step="0.01" value={prodSettings.insulationBase} onChange={(e)=>onUpdateProdSettings({...prodSettings, insulationBase: parseFloat(e.target.value)||0})} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-purple-500" />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-800 pt-3 mt-2">
                            <h4 className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-3">Pesos de Complexidade</h4>
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
                            <span className="text-xl font-black text-white">{(totals.totalHH || 0).toFixed(1)}<span className="text-[10px] ml-1 text-slate-500">H/H</span></span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Equipes</span>
                            <span className="text-xl font-black text-blue-400">{activeFactors.teamCount}<span className="text-[10px] ml-1 text-slate-500">EQP</span></span>
                        </div>
                        <div className="col-span-2 pt-2 mt-2 border-t border-slate-800 flex justify-between items-center">
                            <span className="text-[9px] text-purple-400 font-black uppercase tracking-widest">Duração Estimada:</span>
                            <span className="text-xl font-black text-purple-400 animate-in fade-in zoom-in duration-500" key={totals.weightedHours}>
                                {(totals.weightedHours || 0).toFixed(1)}<span className="text-[10px] ml-1">HORAS</span>
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

                {/* DEADLINE SECTION */}
                <div className={`bg-slate-950 border p-5 rounded-2xl shadow-inner relative overflow-hidden transition-all ${deadlineDate ? 'border-amber-500/50 shadow-amber-900/10' : 'border-slate-800'}`}>
                    <div className="flex justify-between items-center mb-4">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${deadlineDate ? 'text-amber-400' : 'text-slate-500'}`}>Meta de Término (Deadline)</span>
                        {deadlineDate && <button onClick={() => onUpdateDeadline?.(null)} className="text-[9px] text-slate-500 hover:text-red-400 font-bold uppercase">Limpar</button>}
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full border flex items-center justify-center shadow-lg relative overflow-hidden group/deadline ${deadlineDate ? 'bg-amber-900/20 border-amber-500/50' : 'bg-slate-900 border-slate-700'}`}>
                            <Flag size={16} className={deadlineDate ? 'text-amber-400' : 'text-slate-600'} />
                            <input 
                                type="date" 
                                value={deadlineDate || ''} 
                                min={activeFactors.customStartDate || startDate}
                                onChange={(e) => onUpdateDeadline?.(e.target.value || null)} 
                                className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:dark]" 
                            />
                        </div>
                        <div className="flex-1">
                            {deadlineDate ? (
                                <>
                                    <div className="text-[11px] font-bold text-white">
                                        {new Date(deadlineDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                                    </div>
                                    <div className="text-[9px] text-amber-400 font-bold uppercase">
                                        Meta Definida
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-[11px] font-bold text-slate-500">Nenhuma meta definida</div>
                                    <div className="text-[9px] text-slate-600 font-bold uppercase">Clique para definir data</div>
                                </>
                            )}
                        </div>
                    </div>
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
                            { id: 'SCAFFOLD_FLOOR', label: `Andaime (+${((prodSettings?.weights?.scaffoldFloor || 0) * 100).toFixed(0)}%)`, icon: <Layers size={12}/> },
                            { id: 'SCAFFOLD_HANGING', label: `Balanço (+${((prodSettings?.weights?.scaffoldHanging || 0) * 100).toFixed(0)}%)`, icon: <ArrowUpCircle size={12}/> },
                            { id: 'PTA', label: `PTA (+${((prodSettings?.weights?.pta || 0) * 100).toFixed(0)}%)`, icon: <Truck size={12}/> }
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
                            { id: 'isCriticalArea', label: 'Área Crítica / Risco', weight: prodSettings.weights.criticalArea, icon: <ShieldAlert size={16}/>, color: 'text-red-400' },
                            { id: 'weatherExposed', label: 'Exposto a Intempéries', weight: prodSettings.globalConfig.weatherFactor, icon: <Activity size={16}/>, color: 'text-cyan-400' },
                            { id: 'materialAvailable', label: 'Material em Campo', weight: -prodSettings.globalConfig.materialDelayFactor, icon: <Package size={16}/>, color: 'text-emerald-400', invert: true }
                        ].map(factor => {
                            const isActive = factor.invert ? (activeFactors as any)[factor.id] : (activeFactors as any)[factor.id];
                            const displayActive = factor.invert ? !(activeFactors as any)[factor.id] : (activeFactors as any)[factor.id];

                            return (
                                <button key={factor.id} onClick={() => handleUpdateFactors({ [factor.id]: !(activeFactors as any)[factor.id] })} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${ displayActive ? 'bg-purple-900/40 border-purple-500 text-white shadow-lg ring-1 ring-purple-500/50' : 'bg-slate-800/40 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                                    <div className={displayActive ? factor.color : 'text-slate-600'}>{factor.icon}</div>
                                    <div className="flex-1">
                                        <p className="text-[11px] font-black uppercase tracking-tight">{factor.label}</p>
                                        <p className="text-[9px] opacity-70 font-bold">{factor.invert ? (displayActive ? 'Falta Material (+50%)' : 'Material OK') : `Esforço +${ ((factor.weight || 0) * 100).toFixed(0) }%`}</p>
                                    </div>
                                    {displayActive && <div className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow-lg"><CheckCircle size={12} className="text-white"/></div>}
                                </button>
                            );
                        })}
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
                            <div className="text-xl font-mono font-bold text-white leading-none">{(totalLength || 0).toFixed(2)}<span className="text-xs ml-0.5 text-blue-400">m</span></div>
                        </div>
                        <div>
                            <span className="text-[9px] uppercase font-bold opacity-70 block mb-1">Área Sup.</span>
                            <div className="text-xl font-mono font-bold text-white leading-none">{(totalArea || 0).toFixed(2)}<span className="text-xs ml-0.5 text-blue-400">m²</span></div>
                        </div>
                    </div>
                </div>

                {/* Batch Support Tools - MOVED UP */}
                <div className="bg-blue-600/10 p-4 rounded-xl border border-blue-500/30 space-y-4 shadow-lg shadow-blue-900/10">
                    <label className="text-[10px] font-black text-blue-400 uppercase mb-1 block flex items-center gap-2 tracking-widest">
                        <Layers size={14}/> Suportes em Lote
                    </label>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between bg-slate-950/50 p-2 rounded border border-slate-800">
                            <span className="text-[9px] text-slate-500 uppercase font-bold">Status Inicial:</span>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => setBatchInitialStatus(AccessoryStatus.PENDING)}
                                    className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-all ${batchInitialStatus === AccessoryStatus.PENDING ? 'bg-slate-700 text-white border border-slate-500' : 'bg-slate-900 text-slate-500 border border-transparent'}`}
                                >
                                    Pendente
                                </button>
                                <button 
                                    onClick={() => setBatchInitialStatus(AccessoryStatus.MOUNTED)}
                                    className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-all ${batchInitialStatus === AccessoryStatus.MOUNTED ? 'bg-emerald-600 text-white border border-emerald-400' : 'bg-slate-900 text-slate-500 border border-transparent'}`}
                                >
                                    Montado
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 uppercase font-bold">Distância entre suportes (m)</label>
                            <div className="flex gap-2">
                                <input 
                                    type="number" 
                                    value={batchSpacing} 
                                    onChange={(e) => setBatchSpacing(e.target.value)}
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-blue-500 font-mono"
                                    placeholder="Ex: 3"
                                    min="0.1"
                                    step="0.1"
                                />
                                <button 
                                    onClick={() => onBatchAddSupports?.(parseFloat(batchSpacing) || 3, batchInitialStatus)}
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-black text-[10px] uppercase transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                >
                                    <Wrench size={12}/> Recalcular
                                </button>
                            </div>
                        </div>
                        {parseFloat(batchSpacing) > 0 && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2 flex items-center justify-between">
                                <span className="text-[9px] text-blue-300 uppercase font-bold">Total Estimado:</span>
                                <span className="text-xs font-black text-white">
                                    {selectedPipes.reduce((acc, p) => acc + Math.floor((p.length || 0) / (parseFloat(batchSpacing) || 3)), 0)} un
                                </span>
                            </div>
                        )}
                        <p className="text-[8px] text-slate-500 italic">O sistema calculará a quantidade automaticamente para cada tubo e substituirá os suportes existentes.</p>
                        
                        <div className="pt-3 mt-3 border-t border-blue-500/20">
                            <span className="text-[9px] text-blue-300 uppercase font-bold mb-2 block">Atualizar Status dos Existentes:</span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => onBatchUpdateSupportStatus?.(AccessoryStatus.MOUNTED)}
                                    className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 py-2 rounded text-[9px] font-bold uppercase transition-colors flex items-center justify-center gap-1"
                                >
                                    <Check size={10}/> Marcar Montados
                                </button>
                                <button 
                                    onClick={() => onBatchUpdateSupportStatus?.(AccessoryStatus.PENDING)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-2 rounded text-[9px] font-bold uppercase transition-colors flex items-center justify-center gap-1"
                                >
                                    Marcar Pendentes
                                </button>
                            </div>
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

                <div className="pt-4 border-t border-slate-800">
                    <button 
                        onClick={onClearAccessories}
                        className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-400 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border border-red-500/20"
                    >
                        <Trash2 size={14}/> Limpar Todos os Acessórios
                    </button>
                </div>
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
                <div><label className="text-[10px] font-bold text-slate-500 uppercase">Comp.</label><div className="text-white font-bold text-xs">{(singlePipe.length || 0).toFixed(2)}m</div></div>
                
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
                    <div className="text-white font-mono text-xs font-bold">{(Math.PI * (singlePipe.diameter || 0) * (singlePipe.length || 0)).toFixed(2)}m²</div>
                </div>
            </div>
            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Status Montagem</label><div className="grid grid-cols-2 gap-2">{ALL_STATUSES.map(s => (<button key={s} onClick={() => onUpdateSingle({ ...singlePipe, status: s as PipeStatus })} className={`p-2 rounded font-bold text-[9px] border transition-all ${singlePipe.status === s ? 'ring-2 ring-white scale-105 opacity-100' : 'opacity-40'}`} style={{ backgroundColor: STATUS_COLORS[s], color: '#fff' }}>{STATUS_LABELS[s]}</button>))}</div></div>

            {/* Component Tracking Section */}
            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block flex items-center gap-2">
                    <Package size={14}/> Itens de Montagem (Acessórios)
                </label>
                
                {[
                    { id: 'supports', label: 'Suportes', icon: <Wrench size={12}/> }
                ].map(comp => {
                    const hasModernSupports = singlePipe.accessories?.some(a => a.type === 'SUPPORT');
                    const isPipeInstalled = singlePipe.status === 'MOUNTED' || singlePipe.status === 'WELDED' || singlePipe.status === 'HYDROTEST';
                    const status = hasModernSupports 
                        ? { 
                            total: singlePipe.accessories!.filter(a => a.type === 'SUPPORT').length, 
                            installed: singlePipe.accessories!.filter(a => a.type === 'SUPPORT' && (a.status === AccessoryStatus.MOUNTED || isPipeInstalled)).length 
                          }
                        : ((singlePipe as any)[comp.id] || { total: 0, installed: 0 });
                        
                    return (
                        <div key={comp.id} className="space-y-2 pb-3 border-b border-slate-800/50 last:border-0 last:pb-0">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
                                    {comp.icon} {comp.label}
                                </span>
                                <span className="text-[10px] font-mono text-blue-400 font-bold">
                                    {status.installed} / {status.total}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[8px] text-slate-600 uppercase font-bold">Total</span>
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={status.total}
                                        disabled={hasModernSupports}
                                        onChange={(e) => onUpdateSingle({ 
                                            ...singlePipe, 
                                            [comp.id]: { ...status, total: parseInt(e.target.value) || 0 } 
                                        })}
                                        className={`bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500 ${hasModernSupports ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[8px] text-slate-600 uppercase font-bold">Instalado</span>
                                    <input 
                                        type="number" 
                                        min="0"
                                        max={status.total}
                                        value={status.installed}
                                        disabled={hasModernSupports}
                                        onChange={(e) => onUpdateSingle({ 
                                            ...singlePipe, 
                                            [comp.id]: { ...status, installed: parseInt(e.target.value) || 0 } 
                                        })}
                                        className={`bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500 ${hasModernSupports ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />
                                </div>
                            </div>
                            {hasModernSupports && (
                                <p className="text-[8px] text-blue-400 italic mt-1">Gerenciado via Lote/3D. Use a ferramenta abaixo ou clique no 3D para alterar.</p>
                            )}
                            {/* Progress Bar */}
                            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-blue-500 transition-all duration-500" 
                                    style={{ width: `${status.total > 0 ? Math.min(100, (status.installed / status.total) * 100) : 0}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Manual Accessory Management */}
            {!isBatch && (
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block flex items-center gap-2">
                        <MousePointer2 size={14}/> Posicionamento Manual
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            { id: 'SUPPORT', label: 'Suporte', icon: <Wrench size={12}/> }
                        ].map(type => (
                            <button 
                                key={type.id}
                                onClick={() => onSetPlacementMode?.(placementMode === type.id ? null : type.id as any)}
                                className={`flex items-center gap-2 p-2 rounded-lg border text-[9px] font-bold transition-all uppercase ${placementMode === type.id ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                            >
                                {type.icon} {type.label}
                            </button>
                        ))}
                    </div>
                    
                    {singlePipe.accessories && singlePipe.accessories.length > 0 && (
                        <div className="space-y-3 mt-4 pt-4 border-t border-slate-800">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Itens Posicionados</span>
                                <button 
                                    onClick={() => onUpdateSingle({
                                        ...singlePipe,
                                        accessories: singlePipe.accessories?.map(a => ({ ...a, status: AccessoryStatus.MOUNTED }))
                                    })}
                                    className="text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase flex items-center gap-1 transition-colors"
                                >
                                    <CheckSquare size={10} /> Marcar Todos
                                </button>
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {singlePipe.accessories.map(acc => (
                                    <div key={acc.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${acc.status === AccessoryStatus.MOUNTED ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-slate-950/40 border-slate-800'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full shadow-sm ${acc.status === AccessoryStatus.MOUNTED ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-slate-600'}`}></div>
                                            <div className="flex flex-col">
                                                <span className={`text-[10px] font-black uppercase tracking-tight ${acc.status === AccessoryStatus.MOUNTED ? 'text-emerald-400' : 'text-slate-300'}`}>{acc.type}</span>
                                                <span className="text-[8px] text-slate-500 font-bold">POSIÇÃO: {(acc.offset * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => onUpdateSingle({
                                                    ...singlePipe,
                                                    accessories: singlePipe.accessories?.map(a => a.id === acc.id ? { ...a, status: a.status === AccessoryStatus.MOUNTED ? AccessoryStatus.PENDING : AccessoryStatus.MOUNTED } : a)
                                                })}
                                                title={acc.status === AccessoryStatus.MOUNTED ? "Marcar como Pendente" : "Marcar como Montado"}
                                                className={`p-1.5 rounded-lg transition-all ${acc.status === AccessoryStatus.MOUNTED ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                                            >
                                                <Check size={14} />
                                            </button>
                                            <button 
                                                onClick={() => onUpdateSingle({
                                                    ...singlePipe,
                                                    accessories: singlePipe.accessories?.filter(a => a.id !== acc.id)
                                                })}
                                                className="p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:bg-red-900/40 hover:text-red-400 transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {/* End of Manual Accessory Management */}


            {(singlePipe.status === 'WELDED' || singlePipe.status === 'HYDROTEST') && (
                <div className="bg-slate-950/60 p-4 rounded-xl border border-green-500/20 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-bold text-green-400 uppercase mb-1 block flex items-center gap-2">
                        <CheckSquare size={14}/> Controle de Qualidade (CQ)
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 uppercase font-bold">ID Inspetor/Soldador</label>
                            <input 
                                type="text" 
                                value={singlePipe.welderInfo?.welderId || ''} 
                                onChange={(e) => onUpdateSingle({ ...singlePipe, welderInfo: { ...(singlePipe.welderInfo || { weldDate: new Date().toISOString().split('T')[0], electrodeBatch: '', visualInspection: false }), welderId: e.target.value } })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-green-500 font-mono"
                                placeholder="Ex: W-01"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 uppercase font-bold">Data de Soldagem</label>
                            <input 
                                type="date" 
                                value={singlePipe.welderInfo?.weldDate || new Date().toISOString().split('T')[0]} 
                                onChange={(e) => onUpdateSingle({ ...singlePipe, welderInfo: { ...(singlePipe.welderInfo || { welderId: '', electrodeBatch: '', visualInspection: false }), weldDate: e.target.value } })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-green-500 [color-scheme:dark]"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 uppercase font-bold">Lote Eletrodo</label>
                            <input 
                                type="text" 
                                value={singlePipe.welderInfo?.electrodeBatch || ''} 
                                onChange={(e) => onUpdateSingle({ ...singlePipe, welderInfo: { ...(singlePipe.welderInfo || { welderId: '', weldDate: new Date().toISOString().split('T')[0], visualInspection: false }), electrodeBatch: e.target.value } })}
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none focus:border-green-500 font-mono"
                                placeholder="Ex: E-7018"
                            />
                        </div>
                        <div className="flex items-end pb-1">
                            <button 
                                onClick={() => onUpdateSingle({ ...singlePipe, welderInfo: { ...(singlePipe.welderInfo || { welderId: '', weldDate: new Date().toISOString().split('T')[0], electrodeBatch: '' }), visualInspection: !singlePipe.welderInfo?.visualInspection } })}
                                className={`w-full flex items-center justify-center gap-2 p-2 rounded border transition-all font-bold text-[9px] uppercase ${singlePipe.welderInfo?.visualInspection ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                            >
                                <Check size={12} /> Insp. Visual
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
