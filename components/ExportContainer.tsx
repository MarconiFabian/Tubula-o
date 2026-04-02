import React, { useMemo } from 'react';
import { Ruler, Wrench, Shield, Timer, Calendar, Cuboid, Image as ImageIcon, Package, MapPin, TrendingUp, BarChart3, AlertCircle, Users } from 'lucide-react';
import { PipeSegment, Annotation, PipeStatus, InsulationStatus, ProductivitySettings } from '../types';
import { STATUS_LABELS, STATUS_COLORS, INSULATION_LABELS, INSULATION_COLORS, ALL_STATUSES, ALL_INSULATION_STATUSES, PIPING_REMAINING_FACTOR, INSULATION_REMAINING_FACTOR } from '../constants';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceDot } from 'recharts';

interface ExportContainerProps {
  viewMode: string;
  reportStats: any;
  sceneScreenshot: string | null;
  secondaryImage: string | null;
  mapImage: string | null;
  projectClient: string;
  projectLocation: string;
  activityDate: string;
  pipes: PipeSegment[];
  prodSettings: ProductivitySettings;
  startDate: string;
  dailyProduction?: any[];
  annotations?: Annotation[];
  deadlineDate?: string | null;
}

export const ExportContainer: React.FC<ExportContainerProps> = ({
  viewMode, reportStats, sceneScreenshot, secondaryImage, mapImage, projectClient, projectLocation, activityDate, pipes, prodSettings, startDate, dailyProduction = [], annotations = [], deadlineDate
}) => {
  const progress = useMemo(() => {
      const pipingTotalLength = pipes.reduce((acc, p) => acc + (p.length || 0), 0);
      const completedWeight = pipes.reduce((acc, p) => {
          const pipingDone = 1 - (PIPING_REMAINING_FACTOR[p.status] ?? 1);
          return acc + (p.length * pipingDone);
      }, 0);
      return pipingTotalLength > 0 ? (completedWeight / pipingTotalLength) * 100 : 0;
  }, [pipes]);

  const sCurveData = useMemo(() => {
    const data: any[] = [];
    if (pipes.length === 0) return data;

    const totalLengthValue = pipes.reduce((acc, p) => acc + (p?.length || 0), 0);
    const startStr = (startDate || new Date().toISOString().split('T')[0]);
    const todayStr = new Date().toISOString().split('T')[0];
    
    const initialCumulativeActual = pipes
        .filter(p => {
            const d = p.welderInfo?.weldDate || todayStr;
            return d < startStr;
        })
        .reduce((acc, p) => {
            const pipingDone = 1 - (PIPING_REMAINING_FACTOR[p.status] ?? 1);
            return acc + (p.length * pipingDone);
        }, 0);

    let cumulativeActual = initialCumulativeActual;
    let cumulativePlanned = initialCumulativeActual;
    
    const initialProgressPct = totalLengthValue > 0 ? (initialCumulativeActual / totalLengthValue * 100) : 0;

    const start = new Date(startStr + 'T12:00:00');
    
    let plotDays = reportStats.daysNeeded || 30;
    if (deadlineDate) {
        const end = new Date(deadlineDate + 'T12:00:00');
        const diffTime = end.getTime() - start.getTime();
        plotDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    const today = new Date(todayStr + 'T12:00:00');
    const daysSinceStart = Math.max(1, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    for (let i = 0; i <= plotDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        
        const dayProd = pipes.filter(p => {
            const d = p.welderInfo?.weldDate || todayStr;
            return d === dateStr;
        }).reduce((acc, p) => {
            const pipingDone = 1 - (PIPING_REMAINING_FACTOR[p.status] ?? 1);
            return acc + (p.length * pipingDone);
        }, 0);
        cumulativeActual += dayProd;

        let planned = 0;
        if (dailyProduction && dailyProduction.length > 0) {
            const dp = dailyProduction.find(d => d.date === dateStr);
            if (dp) {
                cumulativePlanned += dp.pipeMeters;
            }
            planned = totalLengthValue > 0 ? (cumulativePlanned / totalLengthValue * 100) : 0;
        } else {
            const x = (i / (plotDays || 1)) * 10 - 5;
            const sigmoid = 1 / (1 + Math.exp(-x));
            
            const s0 = 1 / (1 + Math.exp(5));
            const s1 = 1 / (1 + Math.exp(-5));
            const normalizedSigmoid = (sigmoid - s0) / (s1 - s0);
            
            planned = initialProgressPct + (normalizedSigmoid * (100 - initialProgressPct));
        }

        let autoProgress = null;
        if (dateStr <= todayStr) {
            const linearFactor = Math.min(i / daysSinceStart, 1);
            autoProgress = parseFloat((initialProgressPct + (linearFactor * (progress - initialProgressPct))).toFixed(2));
        }

        let milestone = null;
        if (i === Math.round(plotDays * 0.25)) milestone = "25%";
        if (i === Math.round(plotDays * 0.50)) milestone = "50%";
        if (i === Math.round(plotDays * 0.75)) milestone = "75%";
        if (i === plotDays) milestone = "100%";

        const isFuture = dateStr > todayStr;

        const [y, m, day] = dateStr.split('-');
        data.push({
            date: `${day}/${m}/${y.slice(2)}`,
            actual: !isFuture && totalLengthValue && totalLengthValue > 0 ? parseFloat(((cumulativeActual || 0) / totalLengthValue * 100).toFixed(2)) : null,
            planned: parseFloat(planned.toFixed(2)),
            autoProgress: autoProgress,
            actualMeters: parseFloat((cumulativeActual || 0).toFixed(2)),
            plannedMeters: parseFloat(((planned / 100) * totalLengthValue).toFixed(2)),
            milestone,
            isLastActual: dateStr === todayStr
        });
    }
    return data;
  }, [pipes, startDate, reportStats.daysNeeded]);

  const effortData = useMemo(() => {
    return ALL_STATUSES.map(status => {
        const count = pipes.filter(p => p.status === status).length;
        const percentage = pipes.length > 0 ? (count / pipes.length) * 100 : 0;
        return {
            name: STATUS_LABELS[status],
            value: percentage,
            color: STATUS_COLORS[status]
        };
    });
  }, [pipes]);

  return (
    <div id="composed-dashboard-export" style={{ position: 'absolute', top: '-20000px', left: 0, width: '1920px', backgroundColor: '#0f172a', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', color: '#f1f5f9' }}>
      {/* PAGE 1: OVERVIEW & TRACKING */}
      <div id="export-page-1" style={{ padding: '60px', minHeight: '1350px', display: 'flex', flexDirection: 'column', gap: '40px', backgroundColor: '#0f172a', width: '1920px' }}>
        <div className="flex justify-between items-start pb-6" style={{ borderBottom: '1px solid #334155' }}>
            <div>
            <h1 className="text-6xl font-bold tracking-tight leading-none mb-2 uppercase" style={{ color: '#ffffff' }}>
                RASTREABILIDADE FÍSICA E STATUS DE OBRA
            </h1>
            <p className="text-xl font-medium tracking-widest uppercase" style={{ color: '#94a3b8' }}>Monitoramento de Campo e Registro Fotográfico</p>
            </div>
            <div className="text-right text-2xl font-light tracking-[0.2em] uppercase" style={{ color: '#94a3b8' }}>Marconi Fabian - Isometrico Manager</div>
        </div>

        <div className="grid grid-cols-5 gap-6">
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
            <Ruler style={{ color: '#60a5fa', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Total Metros</span>
            <div className="text-4xl font-bold" style={{ color: '#ffffff' }}>{(reportStats?.totalLength || 0).toFixed(2)}m</div>
            </div>
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
            <Wrench style={{ color: '#93c5fd', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Saldo Piping</span>
            <div className="text-4xl font-bold" style={{ color: '#ffffff' }}>{(reportStats?.totalPipingHH || 0).toFixed(1)}h</div>
            </div>
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
            <Shield style={{ color: '#c084fc', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Saldo Isolamento</span>
            <div className="text-4xl font-bold" style={{ color: '#ffffff' }}>{(reportStats?.totalInsulationHH || 0).toFixed(1)}h</div>
            </div>
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
            <Timer style={{ color: '#d8b4fe', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Total Saldo</span>
            <div className="text-4xl font-bold" style={{ color: '#ffffff' }}>{(reportStats?.totalHH || 0).toFixed(1)}h</div>
            {reportStats?.annotationHH > 0 && (
                <div className="text-[10px] font-bold mt-1" style={{ color: '#94a3b8' }}>Inclui {(reportStats?.annotationHH || 0).toFixed(1)}h Apoio</div>
            )}
            </div>
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
            <Calendar style={{ color: '#4ade80', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Progresso Total</span>
            <div className="text-3xl font-bold mt-1" style={{ color: '#4ade80' }}>{progress.toFixed(1)}%</div>
            {deadlineDate && (
                <div className="text-[10px] font-bold mt-2 uppercase px-2 py-1 rounded" style={{ 
                    color: reportStats?.deadlineStats?.isFeasible ? '#4ade80' : '#f87171',
                    backgroundColor: reportStats?.deadlineStats?.isFeasible ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                    border: `1px solid ${reportStats?.deadlineStats?.isFeasible ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`
                }}>
                    Meta: {deadlineDate.split('-').reverse().join('/')}
                </div>
            )}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                    <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#60a5fa' }}>
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        Balanço de Tubulação
                    </h3>
                    <span className="text-blue-400 font-bold text-lg">{(reportStats?.pipingTotalLength || 0) > 0 ? (((reportStats?.pipingExecutedLength || 0) / reportStats.pipingTotalLength) * 100).toFixed(1) : 0}%</span>
                </div>
                <div className="grid grid-cols-3 gap-6">
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total</span>
                        <span className="text-3xl font-bold text-white font-mono">{(reportStats?.pipingTotalLength || 0).toFixed(2)}<span className="text-sm text-slate-500 ml-1">m</span></span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Executado</span>
                        <span className="text-3xl font-bold text-green-400 font-mono">{(reportStats?.pipingExecutedLength || 0).toFixed(2)}<span className="text-sm text-slate-500 ml-1">m</span></span>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                <span>Soldado:</span>
                                <span className="text-white">{((reportStats?.pipeLengths?.['WELDED'] || 0) + (reportStats?.pipeLengths?.['HYDROTEST'] || 0)).toFixed(2)}m</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                <span>Testado:</span>
                                <span className="text-white">{(reportStats?.pipeLengths?.['HYDROTEST'] || 0).toFixed(2)}m</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">A Executar</span>
                        <span className="text-3xl font-bold text-yellow-400 font-mono">{(reportStats?.pipingRemainingLength || 0).toFixed(2)}<span className="text-sm text-slate-500 ml-1">m</span></span>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                <span>P/ Soldar:</span>
                                <span className="text-white">{((reportStats?.pipeLengths?.['PENDING'] || 0) + (reportStats?.pipeLengths?.['MOUNTED'] || 0)).toFixed(2)}m</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                <span>P/ Testar:</span>
                                <span className="text-white">{((reportStats?.pipingTotalLength || 0) - (reportStats?.pipeLengths?.['HYDROTEST'] || 0)).toFixed(2)}m</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-blue-500" style={{ width: `${(reportStats?.pipingTotalLength || 0) > 0 ? ((reportStats?.pipingExecutedLength || 0) / reportStats.pipingTotalLength) * 100 : 0}%` }}></div>
                </div>
            </div>

            <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                    <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#c084fc' }}>
                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                        Balanço de Proteção Térmica
                    </h3>
                    <span className="text-purple-400 font-bold text-lg">{(reportStats?.insulationTotalLength || 0) > 0 ? (((reportStats?.insulationExecutedLength || 0) / reportStats.insulationTotalLength) * 100).toFixed(1) : 0}%</span>
                </div>
                <div className="grid grid-cols-3 gap-6">
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total</span>
                        <span className="text-3xl font-bold text-white font-mono">{(reportStats?.insulationTotalLength || 0).toFixed(2)}<span className="text-sm text-slate-500 ml-1">m</span></span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Executado</span>
                        <span className="text-3xl font-bold text-green-400 font-mono">{(reportStats?.insulationExecutedLength || 0).toFixed(2)}<span className="text-sm text-slate-500 ml-1">m</span></span>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                <span>Concluído:</span>
                                <span className="text-white">{(reportStats?.insulationLengths?.['FINISHED'] || 0).toFixed(2)}m</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">A Executar</span>
                        <span className="text-3xl font-bold text-yellow-400 font-mono">{(reportStats?.insulationRemainingLength || 0).toFixed(2)}<span className="text-sm text-slate-500 ml-1">m</span></span>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                <span>P/ Concluir:</span>
                                <span className="text-white">{((reportStats?.insulationTotalLength || 0) - (reportStats?.insulationLengths?.['FINISHED'] || 0)).toFixed(2)}m</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-purple-500" style={{ width: `${(reportStats?.insulationTotalLength || 0) > 0 ? ((reportStats?.insulationExecutedLength || 0) / reportStats.insulationTotalLength) * 100 : 0}%` }}></div>
                </div>
            </div>
        </div>

        <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
            <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#f59e0b' }}>
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    Acessórios e Componentes
                </h3>
                <div className="flex gap-6">
                    <span className="text-amber-400 font-bold text-lg">Suportes: {reportStats?.componentStats?.supports?.installed || 0}/{reportStats?.componentStats?.supports?.total || 0}</span>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-8 mt-4">
                {[
                    { id: 'supports', label: 'Suportes', color: '#f97316' }
                ].filter(comp => reportStats?.componentStats?.[comp.id] && (reportStats.componentStats[comp.id]?.total || 0) > 0).map(comp => {
                    const data = reportStats?.componentStats?.[comp.id];
                    const pct = (data?.total || 0) > 0 ? ((data?.installed || 0) / (data?.total || 1)) * 100 : 0;
                    return (
                        <div key={comp.id} className="flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">{comp.label}</span>
                                <span className="text-sm font-mono text-white font-bold">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-3xl font-bold text-white font-mono">{data?.installed || 0}</span>
                                <span className="text-sm text-slate-500 mb-1">/ {data?.total || 0}</span>
                                <span className="text-xs text-amber-500 font-bold ml-auto mb-1">FALTA: {(data?.total || 0) - (data?.installed || 0)}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: comp.color }}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-8 flex-1">
            <div className="flex flex-col gap-2">
            <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#cbd5e1' }}>
                <Cuboid size={20}/> Vista Principal 3D
            </h3>
            <div className="flex-1 rounded-xl relative overflow-hidden flex items-center justify-center p-2 min-h-[450px]" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid #334155' }}>
                {sceneScreenshot ? <img src={sceneScreenshot} className="w-full h-full object-cover rounded-lg" /> : <div style={{ color: '#475569' }} className="flex flex-col items-center"><Cuboid size={64} className="opacity-50"/><span>Sem Captura</span></div>}
            </div>
            </div>
            <div className="flex flex-col gap-2">
            <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#cbd5e1' }}>
                <ImageIcon size={20}/> Registro Fotográfico
            </h3>
            <div className="flex-1 rounded-xl relative overflow-hidden flex items-center justify-center p-2 min-h-[450px]" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid #334155' }}>
                {secondaryImage ? <img src={secondaryImage} className="w-full h-full object-cover rounded-lg" /> : <div style={{ color: '#475569' }} className="flex flex-col items-center"><span>Sem Foto</span></div>}
            </div>
            </div>
            <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold uppercase tracking-wider" style={{ color: '#cbd5e1' }}>Dados da Obra</h3>
                <div className="rounded-xl p-6" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid #334155' }}>
                <table className="w-full text-xl text-left">
                    <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <td className="py-3 font-bold uppercase w-1/3" style={{ color: '#94a3b8' }}>Cliente</td>
                        <td className="py-3 uppercase font-bold" style={{ color: '#60a5fa' }}>{projectClient}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                        <td className="py-3 font-bold uppercase" style={{ color: '#94a3b8' }}>Área/Setor</td>
                        <td className="py-3 uppercase font-medium" style={{ color: '#ffffff' }}>{projectLocation}</td>
                    </tr>
                    <tr>
                        <td className="py-3 font-bold uppercase" style={{ color: '#94a3b8' }}>Data Ref.</td>
                        <td className="py-3 font-medium" style={{ color: '#ffffff' }}>{activityDate.split('-').reverse().join('/')}</td>
                    </tr>
                    </tbody>
                </table>
                </div>
            </div>
            <div className="flex flex-col gap-2 flex-1">
                <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#cbd5e1' }}>
                <Package size={20}/> Quantitativos (BOM)
                </h3>
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid #334155' }}>
                <table className="w-full text-xl text-left">
                    <thead style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#94a3b8' }} className="uppercase text-sm font-bold">
                    <tr><th className="p-4">Descrição Material</th><th className="p-4 text-right">Qtd.</th><th className="p-4 text-center">Unid.</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                    {Object.entries(reportStats.bom).map(([label, length]) => (
                        <tr key={label}>
                        <td className="p-4 font-medium" style={{ color: '#ffffff' }}>Tubo Aço Carbono <span style={{ color: '#60a5fa' }} className="font-bold">{label}</span></td>
                        <td className="p-4 text-right font-mono" style={{ color: '#ffffff' }}>{((length as number) || 0).toFixed(2)}</td>
                        <td className="p-4 text-center" style={{ color: '#64748b' }}>Metros</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            </div>
            </div>
            <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#cbd5e1' }}>
                <MapPin size={20}/> Localização em Planta
                </h3>
                <div className="rounded-xl p-2 min-h-[250px] relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid #334155' }}>
                {mapImage ? <img src={mapImage} className="w-full h-full object-cover rounded-lg opacity-80" /> : <div style={{ color: '#475569' }}>Sem Mapa</div>}
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold uppercase tracking-wider" style={{ color: '#cbd5e1' }}>Status Físico de Obra</h3>
                <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl p-4 h-[250px] flex flex-col" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid #334155' }}>
                    <div className="text-xs font-bold uppercase mb-2 text-center" style={{ color: '#60a5fa' }}>Montagem/Solda</div>
                    <div className="flex-1 flex items-end justify-around gap-2">
                    {ALL_STATUSES.map(status => {
                        const h = (reportStats.pipeLengths?.[status] / Math.max(1, reportStats.pipingTotalLength)) * 100 || 0;
                        const pct = reportStats.pipingTotalLength > 0 ? ((reportStats.pipeLengths?.[status] / reportStats.pipingTotalLength) * 100).toFixed(1) : "0.0";
                        return (
                        <div key={status} className="flex flex-col items-center flex-1 h-full justify-end">
                            <span className="font-bold text-[10px]" style={{ color: '#ffffff' }}>{pct}%</span>
                            <span className="font-bold text-[8px] mb-1" style={{ color: '#94a3b8' }}>{(reportStats.pipeLengths?.[status] || 0).toFixed(1)}m</span>
                            <div className="w-full rounded-t-sm opacity-80 relative flex items-center justify-center" style={{ height: `${Math.max(h, 5)}%`, backgroundColor: STATUS_COLORS[status] }}>
                                {parseFloat(pct) > 5 && <span className="absolute text-[8px] font-bold text-slate-900/50">{pct}%</span>}
                            </div>
                            <span className="text-[8px] font-bold uppercase text-center mt-1 truncate w-full" style={{ color: '#64748b' }}>{STATUS_LABELS[status].split(' ')[0]}</span>
                        </div>
                        )
                    })}
                    </div>
                </div>
                <div className="rounded-xl p-4 h-[250px] flex flex-col" style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px solid #334155' }}>
                    <div className="text-xs font-bold uppercase mb-2 text-center" style={{ color: '#c084fc' }}>Isolamento</div>
                    <div className="flex-1 flex items-end justify-around gap-2">
                    {ALL_INSULATION_STATUSES.map(status => {
                        const h = (reportStats.insulationLengths?.[status] / Math.max(1, reportStats.insulationTotalLength)) * 100 || 0;
                        const pct = reportStats.insulationTotalLength > 0 ? ((reportStats.insulationLengths?.[status] / reportStats.insulationTotalLength) * 100).toFixed(1) : "0.0";
                        const c = INSULATION_COLORS[status] === 'transparent' ? '#475569' : INSULATION_COLORS[status];
                        return (
                        <div key={status} className="flex flex-col items-center flex-1 h-full justify-end">
                            <span className="font-bold text-[10px]" style={{ color: '#ffffff' }}>{pct}%</span>
                            <span className="font-bold text-[8px] mb-1" style={{ color: '#94a3b8' }}>{(reportStats.insulationLengths?.[status] || 0).toFixed(1)}m</span>
                            <div className="w-full rounded-t-sm opacity-80 relative flex items-center justify-center" style={{ height: `${Math.max(h, 5)}%`, backgroundColor: c }}>
                                {parseFloat(pct) > 5 && <span className="absolute text-[8px] font-bold text-slate-900/50">{pct}%</span>}
                            </div>
                            <span className="text-[8px] font-bold uppercase text-center mt-1 truncate w-full" style={{ color: '#64748b' }}>{INSULATION_LABELS[status].split(' ')[0]}</span>
                        </div>
                        )
                    })}
                    </div>
                </div>
                </div>
            </div>
            </div>
        </div>
        <div className="mt-4 pt-4 flex justify-between font-mono text-lg" style={{ borderTop: '1px solid #1e293b', color: '#64748b' }}>
            <span>Relatório Automático Isometrico Manager - Marconi Fabian</span>
            <span>Página 1 de 2</span>
        </div>
      </div>

      {/* PAGE 2: PLANNING & S-CURVE & HISTOGRAM & GANTT */}
      <div id="export-page-2" style={{ padding: '60px', minHeight: '2715px', display: 'flex', flexDirection: 'column', gap: '40px', backgroundColor: '#0f172a', width: '1920px' }}>
        <div className="flex justify-between items-start pb-6" style={{ borderBottom: '1px solid #334155' }}>
            <div>
            <h1 className="text-6xl font-bold tracking-tight leading-none mb-2 uppercase" style={{ color: '#ffffff' }}>
                CRONOGRAMA E PLANEJAMENTO 4D
            </h1>
            <p className="text-xl font-medium tracking-widest uppercase" style={{ color: '#94a3b8' }}>Análise de Produtividade, Curva de Avanço e Recursos</p>
            </div>
            <div className="text-right text-2xl font-light tracking-[0.2em] uppercase" style={{ color: '#94a3b8' }}>Marconi Fabian - Isometrico Manager</div>
        </div>

        <div className="grid grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                    <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#60a5fa' }}>
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        Balanço de Tubulação
                    </h3>
                    <span className="text-blue-400 font-bold text-lg">{reportStats.pipingTotalLength > 0 ? ((reportStats.pipingExecutedLength / reportStats.pipingTotalLength) * 100).toFixed(1) : 0}%</span>
                </div>
                <div className="grid grid-cols-3 gap-6">
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total</span>
                        <span className="text-3xl font-bold text-white font-mono">{reportStats.pipingTotalLength?.toFixed(2) || '0.00'}<span className="text-sm text-slate-500 ml-1">m</span></span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Executado</span>
                        <span className="text-3xl font-bold text-green-400 font-mono">{reportStats.pipingExecutedLength?.toFixed(2) || '0.00'}<span className="text-sm text-slate-500 ml-1">m</span></span>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                <span>Soldado:</span>
                                <span className="text-white">{((reportStats.pipeLengths?.['WELDED'] || 0) + (reportStats.pipeLengths?.['HYDROTEST'] || 0)).toFixed(2)}m</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                <span>Testado:</span>
                                <span className="text-white">{(reportStats.pipeLengths?.['HYDROTEST'] || 0).toFixed(2)}m</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">A Executar</span>
                        <span className="text-3xl font-bold text-yellow-400 font-mono">{reportStats.pipingRemainingLength?.toFixed(2) || '0.00'}<span className="text-sm text-slate-500 ml-1">m</span></span>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                <span>P/ Soldar:</span>
                                <span className="text-white">{((reportStats.pipeLengths?.['PENDING'] || 0) + (reportStats.pipeLengths?.['MOUNTED'] || 0)).toFixed(2)}m</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                <span>P/ Testar:</span>
                                <span className="text-white">{(reportStats.pipingTotalLength - (reportStats.pipeLengths?.['HYDROTEST'] || 0)).toFixed(2)}m</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-blue-500" style={{ width: `${reportStats.pipingTotalLength > 0 ? (reportStats.pipingExecutedLength / reportStats.pipingTotalLength) * 100 : 0}%` }}></div>
                </div>
            </div>

            <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                    <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#c084fc' }}>
                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                        Balanço de Proteção Térmica
                    </h3>
                    <span className="text-purple-400 font-bold text-lg">{reportStats.insulationTotalLength > 0 ? ((reportStats.insulationExecutedLength / reportStats.insulationTotalLength) * 100).toFixed(1) : 0}%</span>
                </div>
                <div className="grid grid-cols-3 gap-6">
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Total</span>
                        <span className="text-3xl font-bold text-white font-mono">{reportStats.insulationTotalLength?.toFixed(2) || '0.00'}<span className="text-sm text-slate-500 ml-1">m</span></span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Executado</span>
                        <span className="text-3xl font-bold text-green-400 font-mono">{reportStats.insulationExecutedLength?.toFixed(2) || '0.00'}<span className="text-sm text-slate-500 ml-1">m</span></span>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                <span>Concluído:</span>
                                <span className="text-white">{reportStats.insulationLengths?.['FINISHED']?.toFixed(2) || '0.00'}m</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">A Executar</span>
                        <span className="text-3xl font-bold text-yellow-400 font-mono">{reportStats.insulationRemainingLength?.toFixed(2) || '0.00'}<span className="text-sm text-slate-500 ml-1">m</span></span>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                                <span>P/ Concluir:</span>
                                <span className="text-white">{(reportStats.insulationTotalLength - (reportStats.insulationLengths?.['FINISHED'] || 0)).toFixed(2)}m</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-purple-500" style={{ width: `${reportStats.insulationTotalLength > 0 ? (reportStats.insulationExecutedLength / reportStats.insulationTotalLength) * 100 : 0}%` }}></div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
            <div className="col-span-8 flex flex-col gap-6">
                <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-800 flex flex-col gap-6 shadow-2xl">
                    <h3 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-3" style={{ color: '#60a5fa' }}>
                        <TrendingUp size={28}/> Curva S de Produção (Acumulado Metros)
                    </h3>
                    <div style={{ width: '100%', height: '500px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sCurveData}>
                                <defs>
                                    <linearGradient id="colorPlannedExp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorActualExp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorAutoExp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="date" stroke="#475569" fontSize={14} tickLine={false} axisLine={false} />
                                <YAxis stroke="#475569" fontSize={14} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                                <Area type="monotone" dataKey="planned" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorPlannedExp)" dot={false} strokeDasharray="5 5" />
                                <Area type="monotone" dataKey="autoProgress" stroke="#f59e0b" strokeWidth={4} fillOpacity={1} fill="url(#colorAutoExp)" dot={{ r: 4, fill: '#f59e0b' }} />
                                <Area type="monotone" dataKey="actual" stroke="#22c55e" strokeWidth={4} fillOpacity={1} fill="url(#colorActualExp)" dot={{ r: 6, fill: '#22c55e' }} />
                                {sCurveData.filter(d => d.milestone).map((d, idx) => (
                                    <ReferenceDot 
                                        key={idx} 
                                        x={d.date} 
                                        y={d.planned} 
                                        r={6} 
                                        fill="#3b82f6" 
                                        stroke="#fff" 
                                        label={{ value: d.milestone, position: 'top', fill: '#3b82f6', fontSize: 12, fontWeight: 'bold' }} 
                                    />
                                ))}
                                {sCurveData.filter(d => d.isLastActual && d.actual !== null).map((d, idx) => (
                                    <ReferenceDot 
                                        key={`actual-${idx}`} 
                                        x={d.date} 
                                        y={d.actual} 
                                        r={8} 
                                        fill="#22c55e" 
                                        stroke="#fff" 
                                        strokeWidth={2}
                                        label={{ value: `${d.actual}%`, position: 'top', fill: '#22c55e', fontSize: 14, fontWeight: 'bold' }} 
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-12 mt-4">
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-blue-500 rounded-full" style={{ border: '2px dashed #fff' }}></div>
                            <span className="text-xl font-bold uppercase tracking-wider" style={{ color: '#3b82f6' }}>Previsto (Azul)</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-amber-500 rounded-full"></div>
                            <span className="text-xl font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>Automático</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-green-500 rounded-full"></div>
                            <span className="text-xl font-bold uppercase tracking-wider" style={{ color: '#22c55e' }}>Realizado</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-800 flex flex-col gap-6 shadow-2xl">
                    <h3 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-3" style={{ color: '#a855f7' }}>
                        <BarChart3 size={28}/> Distribuição de Esforço por Status
                    </h3>
                    <div style={{ width: '100%', height: '350px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
                        {/* TUBULAÇÃO */}
                        <div>
                            <div className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#64748b' }}>Tubulação</div>
                            <div className="flex flex-col gap-3">
                                {ALL_STATUSES.map(status => {
                                    const length = reportStats.pipeLengths?.[status] || 0;
                                    const percentage = reportStats.pipingTotalLength > 0 ? (length / reportStats.pipingTotalLength) * 100 : 0;
                                    return (
                                        <div key={status} className="flex flex-col gap-1">
                                            <div className="flex justify-between text-xs font-bold uppercase">
                                                <span style={{ color: '#94a3b8' }}>{STATUS_LABELS[status]}</span>
                                                <span style={{ color: '#ffffff' }}>{length.toFixed(2)}m ({percentage.toFixed(1)}%)</span>
                                            </div>
                                            <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#1e293b' }}>
                                                <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: STATUS_COLORS[status] }}></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* PROTEÇÃO TÉRMICA */}
                        <div>
                            <div className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#64748b' }}>Proteção Térmica</div>
                            <div className="flex flex-col gap-3">
                                {ALL_INSULATION_STATUSES.filter(s => s !== 'NONE').map(status => {
                                    const length = reportStats.insulationLengths?.[status] || 0;
                                    const percentage = reportStats.insulationTotalLength > 0 ? (length / reportStats.insulationTotalLength) * 100 : 0;
                                    return (
                                        <div key={status} className="flex flex-col gap-1">
                                            <div className="flex justify-between text-xs font-bold uppercase">
                                                <span style={{ color: '#94a3b8' }}>{INSULATION_LABELS[status]}</span>
                                                <span style={{ color: '#ffffff' }}>{length.toFixed(2)}m ({percentage.toFixed(1)}%)</span>
                                            </div>
                                            <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#1e293b' }}>
                                                <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: INSULATION_COLORS[status] }}></div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* APOIO / INFRAESTRUTURA */}
                        {reportStats.annotationHH > 0 && (
                            <div>
                                <div className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: '#64748b' }}>Apoio / Infraestrutura</div>
                                <div className="flex flex-col gap-3">
                                    {Object.entries(reportStats.annotationBreakdown || {}).map(([type, hours]) => {
                                        const h = hours as number;
                                        const percentage = (h / reportStats.annotationHH) * 100;
                                        let label = type;
                                        let color = '#94a3b8';
                                        
                                        switch(type) {
                                            case 'SCAFFOLD': label = 'Andaime'; color = '#eab308'; break;
                                            case 'SCAFFOLD_CANTILEVER': label = 'Andaime em Balanço'; color = '#ca8a04'; break;
                                            case 'CRANE': label = 'Guindaste'; color = '#f97316'; break;
                                            default: label = 'Outros'; color = '#64748b';
                                        }

                                        return (
                                            <div key={type} className="flex flex-col gap-1">
                                                <div className="flex justify-between text-xs font-bold uppercase">
                                                    <span style={{ color: '#94a3b8' }}>{label}</span>
                                                    <span style={{ color: '#ffffff' }}>{h.toFixed(1)}h ({percentage.toFixed(1)}%)</span>
                                                </div>
                                                <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#1e293b' }}>
                                                    <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: color }}></div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="col-span-4 flex flex-col gap-8">
                <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-800 flex flex-col gap-6 shadow-2xl">
                    <h3 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-3" style={{ color: '#eab308' }}>
                        <AlertCircle size={28}/> Alertas de Gestão
                    </h3>
                    <div className="flex flex-col gap-6">
                        {(reportStats?.totalHH || 0) > 500 && (
                            <div className="p-6 rounded-xl border border-red-500/20" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                                <p className="text-xl text-red-200 leading-relaxed font-medium">
                                    <span className="font-bold text-red-400">CRÍTICO:</span> Volume de saldo H/H elevado ({(reportStats?.totalHH || 0).toFixed(1)}h). Recomenda-se reforço de equipe imediato.
                                </p>
                            </div>
                        )}
                        {reportStats?.deadlineStats && !reportStats.deadlineStats.isFeasible && (
                            <div className="p-6 rounded-xl border border-red-500/20" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                                <p className="text-xl text-red-200 leading-relaxed font-medium">
                                    <span className="font-bold text-red-400">ALERTA DE PRAZO:</span> A meta de {deadlineDate?.split('-').reverse().join('/')} é inviável com a capacidade atual. Necessário aumento de {(reportStats.deadlineStats.ratio - 100).toFixed(0)}% na produtividade.
                                </p>
                            </div>
                        )}
                        <div className="p-6 rounded-xl border border-blue-500/20" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                            <p className="text-xl text-blue-200 leading-relaxed font-medium">
                                <span className="font-bold text-blue-400">INFO:</span> Produtividade média linear necessária para conclusão no prazo: <span className="text-white">{( (reportStats?.totalLength || 0) / Math.max(1, reportStats?.daysNeeded || 1)).toFixed(2)}m/dia</span>.
                            </p>
                        </div>
                        <div className="p-6 rounded-xl border border-purple-500/20" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)' }}>
                            <p className="text-xl text-purple-200 leading-relaxed font-medium">
                                <span className="font-bold text-purple-400">ESTRATÉGIA:</span> Foco em frentes de soldagem para liberação de frentes de isolamento térmico.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-800 flex flex-col gap-6 shadow-2xl flex-1">
                    <h3 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-3" style={{ color: '#4ade80' }}>
                        <Timer size={28}/> Métricas de Desempenho
                    </h3>
                    <div className="flex flex-col gap-8 mt-4">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                            <span className="text-xl font-bold text-slate-400 uppercase">Progresso Global</span>
                            <span className="text-4xl font-bold text-green-400 font-mono">{(reportStats?.progress || 0).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                            <span className="text-xl font-bold text-slate-400 uppercase">H/H por Metro</span>
                            <span className="text-4xl font-bold text-white font-mono">{( (reportStats?.totalHH || 0) / Math.max(1, reportStats?.totalLength || 1)).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xl font-bold text-slate-400 uppercase">Dias para Término</span>
                            <span className="text-4xl font-bold text-yellow-400 font-mono">{reportStats?.daysNeeded || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex flex-col gap-8 flex-1 mt-8">
            <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-800 flex flex-col gap-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-3" style={{ color: '#f97316' }}>
                        <Users size={28}/> Histograma de Recursos (Equipes Necessárias)
                    </h3>
                </div>
                <div style={{ width: '100%', height: '400px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sCurveData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="date" stroke="#475569" fontSize={14} tickLine={false} axisLine={false} />
                            <YAxis stroke="#475569" fontSize={14} tickLine={false} axisLine={false} />
                            <Bar dataKey="planned" fill="#f97316" radius={[4, 4, 0, 0]} opacity={0.6}>
                                {sCurveData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={reportStats.deadlineStats?.isFeasible ? '#3b82f6' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-800 flex flex-col gap-6 shadow-2xl flex-1">
                <h3 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-3 border-b border-slate-800 pb-6" style={{ color: '#22d3ee' }}>
                    <Calendar size={28}/> Cronograma de Execução (Gantt Simplificado)
                </h3>
                <div className="space-y-4 overflow-y-auto" style={{ maxHeight: '600px' }}>
                    {pipes.slice(0, 30).map((p, idx) => {
                        const pipingF = PIPING_REMAINING_FACTOR[p.status] ?? 1;
                        const hasInsulation = p.insulationStatus && p.insulationStatus !== 'NONE';
                        const insF = hasInsulation ? (INSULATION_REMAINING_FACTOR[p.insulationStatus] ?? 1) : 0;
                        
                        const totalRemainingF = hasInsulation ? (pipingF + insF) / 2 : pipingF;
                        const isDone = totalRemainingF === 0;
                        const progressPercent = (1 - totalRemainingF) * 100;
                        
                        return (
                            <div key={p.id} className="flex items-center gap-6 group">
                                <div className="w-48 text-lg font-mono text-slate-400 truncate">{p.spoolId || p.name}</div>
                                <div className="flex-1 bg-slate-800 h-10 rounded relative overflow-hidden">
                                    <div 
                                        className={`absolute h-full transition-all duration-500 ${isDone ? 'bg-green-500/40' : 'bg-blue-500/40'}`}
                                        style={{ 
                                            left: `${(idx * 3) % 60}%`, 
                                            width: `${Math.max(10, progressPercent)}%`,
                                            opacity: isDone ? 1 : 0.6
                                        }}
                                    >
                                        <div className="h-full w-full flex items-center px-4">
                                            <span className="text-sm font-bold text-white uppercase truncate">
                                                {isDone ? 'Concluído' : 'Em Execução'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-24 text-right text-lg font-mono text-slate-300">
                                    {isDone ? 'OK' : `${progressPercent.toFixed(0)}%`}
                                </div>
                            </div>
                        );
                    })}
                    {pipes.length > 30 && (
                        <div className="text-center text-slate-500 mt-4 text-lg font-mono">
                            + {pipes.length - 30} itens não exibidos
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="mt-4 pt-4 flex justify-between font-mono text-lg" style={{ borderTop: '1px solid #1e293b', color: '#64748b' }}>
            <span>Relatório Automático Isometrico Manager - Marconi Fabian</span>
            <span>Página 2 de 2</span>
        </div>
      </div>
    </div>
  );
};
