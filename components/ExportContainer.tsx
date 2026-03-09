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
  annotations?: Annotation[];
  deadlineDate?: string | null;
}

export const ExportContainer: React.FC<ExportContainerProps> = ({
  viewMode, reportStats, sceneScreenshot, secondaryImage, mapImage, projectClient, projectLocation, activityDate, pipes, prodSettings, startDate, annotations = [], deadlineDate
}) => {
  const sCurveData = useMemo(() => {
    const data: any[] = [];
    if (pipes.length === 0) return data;

    const totalLengthValue = pipes.reduce((acc, p) => acc + (p?.length || 0), 0);
    const startStr = (startDate || new Date().toISOString().split('T')[0]);
    const todayStr = new Date().toISOString().split('T')[0];
    
    let cumulativeActual = pipes
        .filter(p => {
            const d = p.welderInfo?.weldDate || todayStr;
            return d < startStr;
        })
        .reduce((acc, p) => {
            const pipingDone = 1 - (PIPING_REMAINING_FACTOR[p.status] ?? 1);
            return acc + (p.length * pipingDone);
        }, 0);

    const days = reportStats.daysNeeded || 30;
    const start = new Date(startStr + 'T12:00:00');
    
    const plotDays = Math.max(days, reportStats.daysNeeded || 0);

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

        const x = (i / days) * 12 - 6;
        const sigmoid = 1 / (1 + Math.exp(-x));
        const planned = sigmoid * totalLengthValue;

        let milestone = null;
        if (i === Math.round(plotDays * 0.25)) milestone = "25%";
        if (i === Math.round(plotDays * 0.50)) milestone = "50%";
        if (i === Math.round(plotDays * 0.75)) milestone = "75%";
        if (i === plotDays) milestone = "100%";

        const isFuture = dateStr > todayStr;

        data.push({
            date: dateStr.split('-').slice(1).join('/'),
            actual: !isFuture ? parseFloat(((cumulativeActual / totalLengthValue) * 100).toFixed(2)) : null,
            planned: parseFloat(((planned / totalLengthValue) * 100).toFixed(2)),
            actualMeters: parseFloat(cumulativeActual.toFixed(2)),
            plannedMeters: parseFloat(planned.toFixed(2)),
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
            <div className="text-4xl font-bold" style={{ color: '#ffffff' }}>{reportStats.totalLength.toFixed(2)}m</div>
            </div>
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
            <Wrench style={{ color: '#93c5fd', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Saldo Piping</span>
            <div className="text-4xl font-bold" style={{ color: '#ffffff' }}>{reportStats.totalPipingHH.toFixed(1)}h</div>
            </div>
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
            <Shield style={{ color: '#c084fc', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Saldo Isolamento</span>
            <div className="text-4xl font-bold" style={{ color: '#ffffff' }}>{reportStats.totalInsulationHH.toFixed(1)}h</div>
            </div>
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
            <Timer style={{ color: '#d8b4fe', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Total Saldo</span>
            <div className="text-4xl font-bold" style={{ color: '#ffffff' }}>{reportStats.totalHH.toFixed(1)}h</div>
            {reportStats.annotationHH > 0 && (
                <div className="text-[10px] font-bold mt-1" style={{ color: '#94a3b8' }}>Inclui {reportStats.annotationHH.toFixed(1)}h Apoio</div>
            )}
            </div>
            <div className="p-6 rounded-2xl flex flex-col items-center" style={{ backgroundColor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #334155' }}>
            <Calendar style={{ color: '#4ade80', marginBottom: '8px' }} size={32} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Término Projetado</span>
            <div className="text-3xl font-bold mt-1" style={{ color: '#4ade80' }}>{reportStats.totalHH > 0 ? reportStats.projectedEnd : 'CONCLUÍDO'}</div>
            {deadlineDate && (
                <div className="text-[10px] font-bold mt-2 uppercase px-2 py-1 rounded" style={{ 
                    color: reportStats.deadlineStats?.isFeasible ? '#4ade80' : '#f87171',
                    backgroundColor: reportStats.deadlineStats?.isFeasible ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                    border: `1px solid ${reportStats.deadlineStats?.isFeasible ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`
                }}>
                    Meta: {deadlineDate.split('-').reverse().join('/')}
                </div>
            )}
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
                        <td className="p-4 text-right font-mono" style={{ color: '#ffffff' }}>{(length as number).toFixed(2)}</td>
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
                        const h = (reportStats.pipeCounts[status] / Math.max(1, reportStats.total)) * 100;
                        return (
                        <div key={status} className="flex flex-col items-center flex-1 h-full justify-end">
                            <span className="font-bold text-[10px] mb-1" style={{ color: '#ffffff' }}>{reportStats.pipeCounts[status]}</span>
                            <div className="w-full rounded-t-sm opacity-80" style={{ height: `${Math.max(h, 5)}%`, backgroundColor: STATUS_COLORS[status] }}></div>
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
                        const h = (reportStats.insulationCounts[status] / Math.max(1, reportStats.total)) * 100;
                        const c = INSULATION_COLORS[status] === 'transparent' ? '#475569' : INSULATION_COLORS[status];
                        return (
                        <div key={status} className="flex flex-col items-center flex-1 h-full justify-end">
                            <span className="font-bold text-[10px] mb-1" style={{ color: '#ffffff' }}>{reportStats.insulationCounts[status]}</span>
                            <div className="w-full rounded-t-sm opacity-80" style={{ height: `${Math.max(h, 5)}%`, backgroundColor: c }}></div>
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
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="date" stroke="#475569" fontSize={14} tickLine={false} axisLine={false} />
                                <YAxis stroke="#475569" fontSize={14} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                                <Area type="monotone" dataKey="planned" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorPlannedExp)" dot={false} />
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
                            <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
                            <span className="text-xl font-bold uppercase tracking-wider text-slate-400">Planejado (Baseline)</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-green-500 rounded-full"></div>
                            <span className="text-xl font-bold uppercase tracking-wider text-slate-400">Realizado (Campo)</span>
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
                                    const count = reportStats.pipeCounts[status] || 0;
                                    const percentage = reportStats.total > 0 ? (count / reportStats.total) * 100 : 0;
                                    return (
                                        <div key={status} className="flex flex-col gap-1">
                                            <div className="flex justify-between text-xs font-bold uppercase">
                                                <span style={{ color: '#94a3b8' }}>{STATUS_LABELS[status]}</span>
                                                <span style={{ color: '#ffffff' }}>{percentage.toFixed(1)}%</span>
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
                                    const count = reportStats.insulationCounts[status] || 0;
                                    const percentage = reportStats.total > 0 ? (count / reportStats.total) * 100 : 0;
                                    return (
                                        <div key={status} className="flex flex-col gap-1">
                                            <div className="flex justify-between text-xs font-bold uppercase">
                                                <span style={{ color: '#94a3b8' }}>{INSULATION_LABELS[status]}</span>
                                                <span style={{ color: '#ffffff' }}>{percentage.toFixed(1)}%</span>
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
                        {reportStats.totalHH > 500 && (
                            <div className="p-6 rounded-xl border border-red-500/20" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                                <p className="text-xl text-red-200 leading-relaxed font-medium">
                                    <span className="font-bold text-red-400">CRÍTICO:</span> Volume de saldo H/H elevado ({reportStats.totalHH.toFixed(1)}h). Recomenda-se reforço de equipe imediato.
                                </p>
                            </div>
                        )}
                        {reportStats.deadlineStats && !reportStats.deadlineStats.isFeasible && (
                            <div className="p-6 rounded-xl border border-red-500/20" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                                <p className="text-xl text-red-200 leading-relaxed font-medium">
                                    <span className="font-bold text-red-400">ALERTA DE PRAZO:</span> A meta de {deadlineDate?.split('-').reverse().join('/')} é inviável com a capacidade atual. Necessário aumento de {(reportStats.deadlineStats.ratio - 100).toFixed(0)}% na produtividade.
                                </p>
                            </div>
                        )}
                        <div className="p-6 rounded-xl border border-blue-500/20" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                            <p className="text-xl text-blue-200 leading-relaxed font-medium">
                                <span className="font-bold text-blue-400">INFO:</span> Produtividade média linear necessária para conclusão no prazo: <span className="text-white">{(reportStats.totalLength / Math.max(1, reportStats.daysNeeded)).toFixed(2)}m/dia</span>.
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
                            <span className="text-xl font-bold text-slate-400 uppercase">Eficiência Atual</span>
                            <span className="text-4xl font-bold text-green-400 font-mono">{(reportStats.totalLength > 0 ? (1 - (reportStats.totalHH / (reportStats.totalLength * 2)) ) * 100 : 0).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                            <span className="text-xl font-bold text-slate-400 uppercase">H/H por Metro</span>
                            <span className="text-4xl font-bold text-white font-mono">{(reportStats.totalHH / Math.max(1, reportStats.totalLength)).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xl font-bold text-slate-400 uppercase">Dias para Término</span>
                            <span className="text-4xl font-bold text-yellow-400 font-mono">{reportStats.daysNeeded}</span>
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
