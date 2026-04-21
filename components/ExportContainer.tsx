import React, { useMemo } from 'react';
import { Ruler, Wrench, Shield, Timer, Calendar, Cuboid, Image as ImageIcon, Package, MapPin, TrendingUp, BarChart3, AlertCircle, Users, Activity } from 'lucide-react';
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

    // 1. Calculate Total Executed so far (from all pipes)
    const totalExecutedMeters = pipes.reduce((acc, p) => {
        const pipingDone = 1 - (PIPING_REMAINING_FACTOR[p.status] ?? 1);
        return acc + (p.length * pipingDone);
    }, 0);
    const totalProgressPct = totalLengthValue > 0 ? (totalExecutedMeters / totalLengthValue * 100) : 0;

    // 2. Dates and Duration
    const start = new Date(startStr + 'T12:00:00');
    const today = new Date(todayStr + 'T12:00:00');
    
    let plotDays = reportStats.daysNeeded || 30;
    if (plotDays < 7) plotDays = 30; // Sensible default for S-Curve if calculation is 0 or too small
    if (deadlineDate) {
        const end = new Date(deadlineDate + 'T12:00:00');
        const diffTime = end.getTime() - start.getTime();
        plotDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    // Days since start to today (for actual distribution)
    const daysSinceStart = Math.max(1, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    let cumulativeActualMeters = initialCumulativeActual;

    for (let i = 0; i <= plotDays; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const isFuture = dateStr > todayStr;
        
        // Actual (Realizado): Use table data if available, otherwise linear fallback
        let actual = null;
        if (!isFuture) {
            const dpForDate = dailyProduction.find(d => d.date === dateStr);
            if (dpForDate) {
                cumulativeActualMeters += dpForDate.pipeMeters;
            }
            
            if (dailyProduction.length > 0) {
                actual = totalLengthValue > 0 ? (cumulativeActualMeters / totalLengthValue * 100) : 0;
            } else {
                // Fallback to linear if no data in table at all
                const linearFactor = daysSinceStart > 0 ? Math.min(i / daysSinceStart, 1) : 1;
                actual = parseFloat((linearFactor * totalProgressPct).toFixed(2));
            }
        }

        // Planned (Planejado): ALWAYS Sigmoid S-Curve (Baseline)
        // Rule: Affected by start/end date, reprogrammed if dates change, stable shape.
        const progressRatio = plotDays > 0 ? (i / plotDays) : 1;
        const x = progressRatio * 10 - 5; // Range -5 to 5 for Sigmoid
        const sigmoid = 1 / (1 + Math.exp(-x));
        const sMin = 1 / (1 + Math.exp(5));
        const sMax = 1 / (1 + Math.exp(-5));
        const normalizedSigmoid = (sigmoid - sMin) / (sMax - sMin);
        const planned = normalizedSigmoid * 100;

        // Milestones
        let milestone = null;
        if (i === Math.round(plotDays * 0.25)) milestone = planned.toFixed(2) + "%";
        if (i === Math.round(plotDays * 0.50)) milestone = planned.toFixed(2) + "%";
        if (i === Math.round(plotDays * 0.75)) milestone = planned.toFixed(2) + "%";
        if (i === plotDays) milestone = "100%";

        const [y, m, day] = dateStr.split('-');
        data.push({
            date: `${day}/${m}/${y.slice(2)}`,
            actual: actual,
            planned: parseFloat(planned.toFixed(2)),
            actualMeters: actual ? parseFloat(((actual / 100) * totalLengthValue).toFixed(2)) : 0,
            plannedMeters: parseFloat(((planned / 100) * totalLengthValue).toFixed(2)),
            milestone,
            isLastActual: dateStr === todayStr
        });
    }

    return data;
  }, [pipes, startDate, reportStats.daysNeeded, dailyProduction, reportStats.totalLength]);

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
    <div id="composed-dashboard-export" style={{ width: '1920px', backgroundColor: '#0f172a', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', color: '#f1f5f9' }}>
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
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
            <Cuboid style={{ color: '#fbbf24', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Total Spools</span>
            <div className="text-4xl font-bold" style={{ color: '#ffffff' }}>{reportStats?.total || 0}</div>
            </div>
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
            <Ruler style={{ color: '#60a5fa', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Total Metros</span>
            <div className="text-4xl font-bold" style={{ color: '#ffffff' }}>{(reportStats?.totalLength || 0).toFixed(2)}m</div>
            </div>
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
            <Wrench style={{ color: '#93c5fd', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Saldo Piping</span>
            <div className="text-4xl font-bold" style={{ color: '#ffffff' }}>{(reportStats?.totalPipingHH || 0).toFixed(1)}h</div>
            </div>
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
            <Shield style={{ color: '#c084fc', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Saldo Isolamento</span>
            <div className="text-4xl font-bold" style={{ color: '#ffffff' }}>{(reportStats?.totalInsulationHH || 0).toFixed(1)}h</div>
            </div>
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
            <Timer style={{ color: '#d8b4fe', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Total Saldo</span>
            <div className="text-4xl font-bold" style={{ color: '#ffffff' }}>{(reportStats?.totalHH || 0).toFixed(1)}h</div>
            {reportStats?.annotationHH > 0 && (
                <div className="text-[10px] font-bold mt-1" style={{ color: '#94a3b8' }}>Inclui {(reportStats?.annotationHH || 0).toFixed(1)}h Apoio</div>
            )}
            </div>
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
            <Calendar style={{ color: '#4ade80', marginBottom: '8px' }} size={32} />
            <div className="flex justify-between w-full items-center mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>{deadlineDate ? 'Meta Diária' : 'Término'}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#4ade80' }}>{progress.toFixed(1)}%</span>
            </div>
            <div className="text-3xl font-bold mt-1" style={{ color: deadlineDate ? '#d8b4fe' : '#4ade80' }}>{deadlineDate ? deadlineDate.split('-').reverse().join('/') : reportStats?.projectedEnd}</div>
            <div className="flex flex-col gap-1 mt-3 w-full pt-3" style={{ borderTop: '1px solid #334155' }}>
                <div className="flex justify-between text-[10px] font-bold uppercase" style={{ color: '#94a3b8' }}>
                    <span>Dias {deadlineDate ? 'Úteis' : 'Necessários'}:</span>
                    <span style={{ color: '#ffffff' }}>{deadlineDate ? reportStats?.deadlineStats?.daysUntilDeadline : reportStats?.daysNeeded} dias</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase" style={{ color: '#94a3b8' }}>
                    <span>Saldo Tubulação:</span>
                    <span style={{ color: '#ffffff' }}>{reportStats?.pipingRemainingLength.toFixed(1)}m</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase" style={{ color: '#94a3b8' }}>
                    <span>Saldo Isolamento:</span>
                    <span style={{ color: '#ffffff' }}>{reportStats?.insulationRemainingLength.toFixed(1)}m</span>
                </div>
            </div>
            </div>
        </div>

        <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
            <div className="flex justify-between items-center pb-4" style={{ borderBottom: '1px solid #334155' }}>
                <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#f59e0b' }}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f59e0b' }}></div>
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
            <div className="flex-1 rounded-xl relative overflow-hidden flex items-center justify-center p-2 min-h-[400px]" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                {sceneScreenshot ? <img src={sceneScreenshot} className="w-full h-full object-cover rounded-lg" /> : <div style={{ color: '#475569' }} className="flex flex-col items-center"><Cuboid size={64} className="opacity-50"/><span>Sem Captura</span></div>}
            </div>
            </div>
            <div className="flex flex-col gap-2">
            <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#cbd5e1' }}>
                <ImageIcon size={20}/> Registro Fotográfico
            </h3>
            <div className="flex-1 rounded-xl relative overflow-hidden flex items-center justify-center p-2 min-h-[400px]" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                {secondaryImage ? <img src={secondaryImage} className="w-full h-full object-cover rounded-lg" /> : <div style={{ color: '#475569' }} className="flex flex-col items-center"><span>Sem Foto</span></div>}
            </div>
            </div>

            <div className="flex flex-col gap-2 col-span-2">
                <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#22c55e' }}>
                    <Activity size={20}/> Produção Diária de Solda (Metros)
                </h3>
                <div className="rounded-xl p-6 h-[200px]" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                    <div className="flex items-end justify-around gap-2 h-full">
                        {reportStats.sortedDailyProd && reportStats.sortedDailyProd.length > 0 ? reportStats.sortedDailyProd.slice(-15).map((day: any) => {
                            const maxVal = Math.max(...reportStats.sortedDailyProd.map((d: any) => d.pipingMeters), 1);
                            const height = (day.pipingMeters / maxVal) * 100;
                            return (
                                <div key={day.date} className="flex flex-col items-center flex-1 h-full justify-end">
                                    <div className="w-full" style={{ height: `${Math.max(height, 5)}%`, backgroundColor: '#22c55e', opacity: 0.4, borderTop: '1px solid #22c55e' }}></div>
                                    <span className="text-[10px] text-slate-500 font-mono uppercase text-center mt-2 tracking-tighter" style={{ color: '#64748b' }}>{day.date.split('-').slice(1).join('/')}</span>
                                </div>
                            )
                        }) : (
                            <div className="w-full h-full flex items-center justify-center border border-dashed border-slate-800 rounded" style={{ borderColor: '#1e293b' }}>
                                <span className="text-sm font-mono text-slate-700 uppercase tracking-widest" style={{ color: '#334155' }}>Nenhum dado de produção registrado</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        <div className="flex flex-col gap-6 flex-1">
            <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold uppercase tracking-wider" style={{ color: '#cbd5e1' }}>Dados da Obra</h3>
                <div className="rounded-xl p-6" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                <table className="w-full text-xl text-left">
                    <tbody>
                    <tr style={{ borderBottom: '1px solid #334155' }}>
                        <td className="py-3 font-bold uppercase w-1/3" style={{ color: '#94a3b8' }}>Cliente</td>
                        <td className="py-3 uppercase font-bold" style={{ color: '#60a5fa' }}>{projectClient}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #334155' }}>
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
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                <table className="w-full text-xl text-left">
                    <thead style={{ backgroundColor: '#0f172a', color: '#94a3b8' }} className="uppercase text-sm font-bold">
                    <tr><th className="p-4">Descrição Material</th><th className="p-4 text-right">Qtd.</th><th className="p-4 text-center">Unid.</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50" style={{ borderTop: '1px solid #334155' }}>
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
            <div className="flex flex-col gap-6 flex-1">
            <div className="flex flex-col gap-2">
                <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#cbd5e1' }}>
                <MapPin size={20}/> Localização em Planta
                </h3>
                <div className="rounded-xl p-2 min-h-[250px] relative overflow-hidden flex items-center justify-center flex-1" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                {mapImage ? <img src={mapImage} className="w-full h-full object-cover rounded-lg opacity-80" /> : <div style={{ color: '#475569' }}>Sem Mapa</div>}
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
        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
            <h2 className="text-4xl font-black tracking-tighter" style={{ color: '#ffffff' }}>
                DETALHAMENTO E PLANEJAMENTO
            </h2>
            <div className="text-right">
                <div className="text-sm font-bold uppercase tracking-widest" style={{ color: '#60a5fa' }}>Isometrico Manager</div>
                <div className="text-xs text-slate-500 font-mono" style={{ color: '#64748b' }}>Relatório de Performance v4.0</div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                    <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#60a5fa' }}>
                        <div className="w-3 h-3 rounded-full bg-blue-500" style={{ backgroundColor: '#3b82f6' }}></div>
                        Balanço de Tubulação
                    </h3>
                    <span className="text-blue-400 font-bold text-lg" style={{ color: '#60a5fa' }}>{reportStats.pipingTotalLength > 0 ? ((reportStats.pipingExecutedLength / reportStats.pipingTotalLength) * 100).toFixed(1) : 0}%</span>
                </div>
                <div className="grid grid-cols-3 gap-6">
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#94a3b8' }}>Total</span>
                        <span className="text-3xl font-bold text-white font-mono" style={{ color: '#ffffff' }}>{reportStats.pipingTotalLength?.toFixed(2) || '0.00'}<span className="text-sm text-slate-500 ml-1" style={{ color: '#64748b' }}>m</span></span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#94a3b8' }}>Executado</span>
                        <span className="text-3xl font-bold text-green-400 font-mono" style={{ color: '#4ade80' }}>{reportStats.pipingExecutedLength?.toFixed(2) || '0.00'}<span className="text-sm text-slate-500 ml-1" style={{ color: '#64748b' }}>m</span></span>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400" style={{ color: '#94a3b8' }}>
                                <span>Soldado:</span>
                                <span className="text-white" style={{ color: '#ffffff' }}>{((reportStats.pipeLengths?.['WELDED'] || 0) + (reportStats.pipeLengths?.['HYDROTEST'] || 0)).toFixed(2)}m</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-400" style={{ color: '#94a3b8' }}>
                                <span>Testado:</span>
                                <span className="text-white" style={{ color: '#ffffff' }}>{(reportStats.pipeLengths?.['HYDROTEST'] || 0).toFixed(2)}m</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#94a3b8' }}>A Executar</span>
                        <span className="text-3xl font-bold text-yellow-400 font-mono" style={{ color: '#facc15' }}>{reportStats.pipingRemainingLength?.toFixed(2) || '0.00'}<span className="text-sm text-slate-500 ml-1" style={{ color: '#64748b' }}>m</span></span>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400" style={{ color: '#94a3b8' }}>
                                <span>P/ Soldar:</span>
                                <span className="text-white" style={{ color: '#ffffff' }}>{((reportStats.pipeLengths?.['PENDING'] || 0) + (reportStats.pipeLengths?.['MOUNTED'] || 0)).toFixed(2)}m</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-mono text-slate-400" style={{ color: '#94a3b8' }}>
                                <span>P/ Testar:</span>
                                <span className="text-white" style={{ color: '#ffffff' }}>{(reportStats.pipingTotalLength - (reportStats.pipeLengths?.['HYDROTEST'] || 0)).toFixed(2)}m</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-2" style={{ backgroundColor: '#1e293b' }}>
                    <div className="h-full bg-blue-500" style={{ width: `${reportStats.pipingTotalLength > 0 ? (reportStats.pipingExecutedLength / reportStats.pipingTotalLength) * 100 : 0}%`, backgroundColor: '#3b82f6' }}></div>
                </div>
            </div>

            <div className="p-6 rounded-2xl flex flex-col gap-4" style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}>
                <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                    <h3 className="text-xl font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#c084fc' }}>
                        <div className="w-3 h-3 rounded-full bg-purple-500" style={{ backgroundColor: '#a855f7' }}></div>
                        Balanço de Proteção Térmica
                    </h3>
                    <span className="text-purple-400 font-bold text-lg" style={{ color: '#c084fc' }}>{reportStats.insulationTotalLength > 0 ? ((reportStats.insulationExecutedLength / reportStats.insulationTotalLength) * 100).toFixed(1) : 0}%</span>
                </div>
                <div className="grid grid-cols-3 gap-6">
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#94a3b8' }}>Total</span>
                        <span className="text-3xl font-bold text-white font-mono" style={{ color: '#ffffff' }}>{reportStats.insulationTotalLength?.toFixed(2) || '0.00'}<span className="text-sm text-slate-500 ml-1" style={{ color: '#64748b' }}>m</span></span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#94a3b8' }}>Executado</span>
                        <span className="text-3xl font-bold text-green-400 font-mono" style={{ color: '#4ade80' }}>{reportStats.insulationExecutedLength?.toFixed(2) || '0.00'}<span className="text-sm text-slate-500 ml-1" style={{ color: '#64748b' }}>m</span></span>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400" style={{ color: '#94a3b8' }}>
                                <span>Concluído:</span>
                                <span className="text-white" style={{ color: '#ffffff' }}>{reportStats.insulationLengths?.['FINISHED']?.toFixed(2) || '0.00'}m</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#94a3b8' }}>A Executar</span>
                        <span className="text-3xl font-bold text-yellow-400 font-mono" style={{ color: '#facc15' }}>{reportStats.insulationRemainingLength?.toFixed(2) || '0.00'}<span className="text-sm text-slate-500 ml-1" style={{ color: '#64748b' }}>m</span></span>
                        <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400" style={{ color: '#94a3b8' }}>
                                <span>P/ Concluir:</span>
                                <span className="text-white" style={{ color: '#ffffff' }}>{(reportStats.insulationTotalLength - (reportStats.insulationLengths?.['FINISHED'] || 0)).toFixed(2)}m</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-2" style={{ backgroundColor: '#1e293b' }}>
                    <div className="h-full bg-purple-500" style={{ width: `${reportStats.insulationTotalLength > 0 ? (reportStats.insulationExecutedLength / reportStats.insulationTotalLength) * 100 : 0}%`, backgroundColor: '#a855f7' }}></div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
            <div className="col-span-8 flex flex-col gap-6">
                <div className="rounded-2xl p-8 border flex flex-col gap-6 shadow-2xl" style={{ backgroundColor: '#0f172a80', borderColor: '#1e293b' }}>
                    <h3 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-3" style={{ color: '#60a5fa' }}>
                        <TrendingUp size={28}/> Curva S de Produção (Acumulado Metros)
                    </h3>
                    <div style={{ width: '1200px', height: '400px', backgroundColor: '#1e293b', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sCurveData && sCurveData.length > 1 ? (
                            <AreaChart data={sCurveData} width={1160} height={360} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#94a3b8" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    tick={{ fill: '#94a3b8' }}
                                />
                                <YAxis 
                                    stroke="#94a3b8" 
                                    fontSize={12} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    tickFormatter={(value) => `${value}%`} 
                                    domain={[0, 100]}
                                    tick={{ fill: '#94a3b8' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="planned" 
                                    stroke="#3b82f6" 
                                    strokeWidth={4} 
                                    fill="#3b82f6" 
                                    fillOpacity={0.1} 
                                    dot={false} 
                                    strokeDasharray="5 5" 
                                    isAnimationActive={false} 
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="actual" 
                                    stroke="#22c55e" 
                                    strokeWidth={4} 
                                    fill="#22c55e" 
                                    fillOpacity={0.1} 
                                    dot={{ r: 6, fill: '#22c55e', strokeWidth: 0 }} 
                                    isAnimationActive={false} 
                                />
                                
                                {(() => {
                                    const lastActual = sCurveData.find(d => d.isLastActual);
                                    if (lastActual) {
                                        return (
                                            <ReferenceDot 
                                                x={lastActual.date} 
                                                y={0} 
                                                r={0} 
                                                label={{ position: 'top', value: 'HOJE', fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }} 
                                            />
                                        );
                                    }
                                    return null;
                                })()}

                                {sCurveData.filter(d => d.milestone).map((d, idx) => (
                                    <ReferenceDot 
                                        key={idx} 
                                        x={d.date} 
                                        y={d.planned} 
                                        r={6} 
                                        fill="#3b82f6" 
                                        stroke="#fff" 
                                        label={{ value: d.milestone, position: 'top', fill: '#3b82f6', fontSize: 10, fontWeight: 'bold' }} 
                                    />
                                ))}
                            </AreaChart>
                        ) : (
                            <div className="text-slate-500 font-mono uppercase tracking-widest">Aguardando dados da curva...</div>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl p-8 border flex flex-col gap-6 shadow-2xl" style={{ backgroundColor: '#0f172a80', borderColor: '#1e293b' }}>
                    <h3 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-3" style={{ color: '#10b981' }}>
                        <Activity size={28}/> Dashboard de Performance (KPIs)
                    </h3>
                    <div className="grid grid-cols-5 gap-4">
                        <div className="p-6 rounded-xl border border-slate-700" style={{ backgroundColor: '#1e293b' }}>
                            <div className="text-xs font-bold text-slate-500 uppercase mb-1" style={{ color: '#64748b' }}>Avanço Real</div>
                            <div className="text-4xl font-bold text-emerald-400" style={{ color: '#10b981' }}>{(reportStats?.progress || 0).toFixed(1)}%</div>
                        </div>
                        <div className="p-6 rounded-xl border border-slate-700" style={{ backgroundColor: '#1e293b' }}>
                            <div className="text-xs font-bold text-slate-500 uppercase mb-1" style={{ color: '#64748b' }}>Desvio (Gap)</div>
                            {(() => {
                                const todayData = sCurveData.find(d => d.isLastActual);
                                const gap = (todayData?.actual || 0) - (todayData?.planned || 0);
                                return (
                                    <div className="text-4xl font-bold" style={{ color: gap >= 0 ? '#10b981' : '#f87171' }}>
                                        {gap > 0 ? '+' : ''}{gap.toFixed(1)}%
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="p-6 rounded-xl border border-slate-700" style={{ backgroundColor: '#1e293b' }}>
                            <div className="text-xs font-bold text-slate-500 uppercase mb-1" style={{ color: '#64748b' }}>H/H por Metro</div>
                            <div className="text-4xl font-bold text-white" style={{ color: '#ffffff' }}>{( (reportStats?.totalHH || 0) / Math.max(1, reportStats?.totalLength || 1)).toFixed(2)}</div>
                        </div>
                        <div className="p-6 rounded-xl border border-slate-700" style={{ backgroundColor: '#1e293b' }}>
                            <div className="text-xs font-bold text-slate-500 uppercase mb-1" style={{ color: '#64748b' }}>Dias p/ Término</div>
                            <div className="text-4xl font-bold text-amber-400" style={{ color: '#f59e0b' }}>{reportStats?.daysNeeded || 0}</div>
                        </div>
                        <div className="p-6 rounded-xl border border-slate-700" style={{ backgroundColor: '#1e293b' }}>
                            <div className="text-xs font-bold text-slate-500 uppercase mb-1" style={{ color: '#64748b' }}>Produção Total</div>
                            <div className="text-2xl font-bold text-white" style={{ color: '#ffffff' }}>{(reportStats?.pipingExecutedLength + reportStats?.insulationExecutedLength).toFixed(1)}m</div>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-6">
                        <div className="p-6 rounded-xl border border-slate-700" style={{ backgroundColor: '#1e293b' }}>
                            <h4 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2" style={{ color: '#94a3b8' }}>
                                <Activity size={16} /> Histórico Recente de Execução
                            </h4>
                            <div className="space-y-3">
                                {reportStats.sortedDailyProd && reportStats.sortedDailyProd.slice(-5).reverse().map((day: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center p-3 rounded border border-slate-800" style={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}>
                                        <div className="text-sm font-mono text-slate-300" style={{ color: '#cbd5e1' }}>{day.date.split('-').reverse().join('/')}</div>
                                        <div className="flex gap-6">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] text-blue-400 uppercase font-bold" style={{ color: '#60a5fa' }}>Tubo</span>
                                                <span className="text-sm font-bold text-white" style={{ color: '#ffffff' }}>{day.pipingMeters.toFixed(1)}m</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] text-amber-400 uppercase font-bold" style={{ color: '#f59e0b' }}>Isol.</span>
                                                <span className="text-sm font-bold text-white" style={{ color: '#ffffff' }}>{day.insulationMeters.toFixed(1)}m</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 rounded-xl border border-slate-700" style={{ backgroundColor: '#1e293b' }}>
                            <h4 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2" style={{ color: '#94a3b8' }}>
                                <TrendingUp size={16} /> Metas Diárias (Saldo)
                            </h4>
                            <div className="flex flex-col gap-6 justify-center h-full">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full flex items-center justify-center border border-blue-500/20" style={{ backgroundColor: '#1e293b', borderColor: '#3b82f6' }}>
                                        <Wrench size={24} className="text-blue-400" style={{ color: '#60a5fa' }} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-mono text-slate-400 uppercase" style={{ color: '#94a3b8' }}>Tubulação</div>
                                        <div className="text-2xl font-bold text-white" style={{ color: '#ffffff' }}>{(reportStats?.pipingRemainingLength || 0).toFixed(1)}m</div>
                                        <div className="text-xs font-bold text-blue-400 uppercase" style={{ color: '#60a5fa' }}>Meta: {(reportStats?.deadlineStats?.requiredDailyPiping || reportStats?.currentDailyPiping || 0).toFixed(1)}m/dia</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full flex items-center justify-center border border-amber-500/20" style={{ backgroundColor: '#1e293b', borderColor: '#f59e0b' }}>
                                        <Shield size={24} className="text-amber-400" style={{ color: '#f59e0b' }} />
                                    </div>
                                    <div>
                                        <div className="text-xs font-mono text-slate-400 uppercase" style={{ color: '#94a3b8' }}>Isolamento</div>
                                        <div className="text-2xl font-bold text-white" style={{ color: '#ffffff' }}>{(reportStats?.insulationRemainingLength || 0).toFixed(1)}m</div>
                                        <div className="text-xs font-bold text-amber-400 uppercase" style={{ color: '#f59e0b' }}>Meta: {(reportStats?.deadlineStats?.requiredDailyInsulation || reportStats?.currentDailyInsulation || 0).toFixed(1)}m/dia</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl p-8 border flex flex-col gap-6 shadow-2xl" style={{ backgroundColor: '#0f172a80', borderColor: '#1e293b' }}>
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
                <div className="rounded-2xl p-8 border flex flex-col gap-6 shadow-2xl" style={{ backgroundColor: '#0f172a80', borderColor: '#1e293b' }}>
                    <h3 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-3" style={{ color: '#eab308' }}>
                        <AlertCircle size={28}/> Alertas de Gestão
                    </h3>
                    <div className="flex flex-col gap-6">
                        {(reportStats?.totalHH || 0) > 500 && (
                            <div className="p-6 rounded-xl border" style={{ backgroundColor: '#450a0a', borderColor: '#ef444433' }}>
                                <p className="text-xl text-red-200 leading-relaxed font-medium">
                                    <span className="font-bold text-red-400">CRÍTICO:</span> Volume de saldo H/H elevado ({(reportStats?.totalHH || 0).toFixed(1)}h). Recomenda-se reforço de equipe imediato.
                                </p>
                            </div>
                        )}
                        {reportStats?.deadlineStats && !reportStats.deadlineStats.isFeasible && (
                            <div className="p-6 rounded-xl border" style={{ backgroundColor: '#450a0a', borderColor: '#ef444433' }}>
                                <p className="text-xl text-red-200 leading-relaxed font-medium">
                                    <span className="font-bold text-red-400">ALERTA DE PRAZO:</span> A meta de {deadlineDate?.split('-').reverse().join('/')} é inviável com a capacidade atual. Necessário aumento de {(reportStats.deadlineStats.ratio - 100).toFixed(0)}% na produtividade.
                                </p>
                            </div>
                        )}
                        <div className="p-6 rounded-xl border" style={{ backgroundColor: '#172554', borderColor: '#3b82f633' }}>
                            <p className="text-xl text-blue-200 leading-relaxed font-medium">
                                <span className="font-bold text-blue-400">INFO:</span> {reportStats?.deadlineStats ? (
                                    <>Produtividade diária necessária para o prazo ({reportStats.deadlineStats.daysUntilDeadline} dias úteis): <span className="text-white">{reportStats.deadlineStats.requiredDailyPiping.toFixed(2)}m (Tubo)</span> e <span className="text-white">{reportStats.deadlineStats.requiredDailyInsulation.toFixed(2)}m (Isolamento)</span>.</>
                                ) : (
                                    <>Produtividade média linear recomendada: <span className="text-white">{( (reportStats?.totalLength || 0) / Math.max(1, reportStats?.daysNeeded || 1)).toFixed(2)}m/dia</span>.</>
                                )}
                            </p>
                        </div>
                        <div className="p-6 rounded-xl border" style={{ backgroundColor: '#3b0764', borderColor: '#a855f733' }}>
                            <p className="text-xl text-purple-200 leading-relaxed font-medium">
                                <span className="font-bold text-purple-400">ESTRATÉGIA:</span> Foco em frentes de soldagem para liberação de frentes de isolamento térmico.
                            </p>
                        </div>
                    </div>
                </div>


            </div>
        </div>

        <div className="flex flex-col gap-8 flex-1 mt-8">
            <div className="rounded-2xl p-8 border flex flex-col gap-6 shadow-2xl" style={{ backgroundColor: '#0f172a80', borderColor: '#1e293b' }}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-3" style={{ color: '#f97316' }}>
                        <Users size={28}/> Histograma de Recursos (Equipes Necessárias)
                    </h3>
                </div>
                <div style={{ width: '1800px', height: '400px' }}>
                    <BarChart data={sCurveData} width={1800} height={400}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="date" stroke="#475569" fontSize={14} tickLine={false} axisLine={false} />
                        <YAxis stroke="#475569" fontSize={14} tickLine={false} axisLine={false} />
                        <Bar dataKey="planned" fill="#f97316" radius={[4, 4, 0, 0]} opacity={0.6} isAnimationActive={false}>
                            {sCurveData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={reportStats.deadlineStats?.isFeasible ? '#3b82f6' : '#ef4444'} />
                            ))}
                        </Bar>
                    </BarChart>
                </div>
            </div>

            <div className="rounded-2xl p-8 border flex flex-col gap-6 shadow-2xl flex-1" style={{ backgroundColor: '#0f172a80', borderColor: '#1e293b' }}>
                <h3 className="text-2xl font-bold uppercase tracking-widest flex items-center gap-3 border-b pb-6" style={{ color: '#22d3ee', borderColor: '#1e293b' }}>
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
                                <div className="w-48 text-lg font-mono text-slate-400 truncate" style={{ color: '#94a3b8' }}>{p.spoolId || p.name}</div>
                                <div className="flex-1 h-10 rounded relative overflow-hidden" style={{ backgroundColor: '#1e293b' }}>
                                    <div 
                                        className="absolute h-full transition-all duration-500"
                                        style={{ 
                                            left: `${(idx * 3) % 60}%`, 
                                            width: `${Math.max(10, progressPercent)}%`,
                                            opacity: isDone ? 1 : 0.6,
                                            backgroundColor: isDone ? '#22c55e66' : '#3b82f666'
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
