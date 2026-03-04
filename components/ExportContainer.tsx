import React, { useMemo } from 'react';
import { Ruler, Wrench, Shield, Timer, Calendar, Cuboid, Image as ImageIcon, Package, MapPin, TrendingUp, BarChart3, AlertCircle } from 'lucide-react';
import { PipeSegment, Annotation, PipeStatus, InsulationStatus, ProductivitySettings } from '../types';
import { STATUS_LABELS, STATUS_COLORS, INSULATION_LABELS, INSULATION_COLORS, ALL_STATUSES, ALL_INSULATION_STATUSES } from '../constants';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

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
}

export const ExportContainer: React.FC<ExportContainerProps> = ({
  viewMode, reportStats, sceneScreenshot, secondaryImage, mapImage, projectClient, projectLocation, activityDate, pipes, prodSettings, startDate, annotations = []
}) => {
  const sCurveData = useMemo(() => {
    const data: any[] = [];
    if (pipes.length === 0) return data;

    const totalLength = pipes.reduce((acc, p) => acc + (p?.length || 0), 0);
    const start = new Date(startDate || new Date().toISOString().split('T')[0]);
    const days = reportStats.daysNeeded || 30;
    
    let cumulativeActual = 0;

    for (let i = 0; i <= days; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        
        const dayProd = pipes.filter(p => p.welderInfo?.weldDate === dateStr).reduce((acc, p) => acc + p.length, 0);
        cumulativeActual += dayProd;
        const planned = (i / days) * totalLength;

        data.push({
            date: dateStr.split('-').slice(1).join('/'),
            actual: cumulativeActual > 0 ? parseFloat(cumulativeActual.toFixed(2)) : null,
            planned: parseFloat(planned.toFixed(2))
        });
    }
    return data;
  }, [pipes, startDate]);

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

      {/* PAGE 2: PLANNING & S-CURVE */}
      <div id="export-page-2" style={{ padding: '60px', minHeight: '1350px', display: 'flex', flexDirection: 'column', gap: '40px', backgroundColor: '#0f172a', width: '1920px' }}>
        <div className="flex justify-between items-start pb-6" style={{ borderBottom: '1px solid #334155' }}>
            <div>
            <h1 className="text-6xl font-bold tracking-tight leading-none mb-2 uppercase" style={{ color: '#ffffff' }}>
                CRONOGRAMA E PLANEJAMENTO 4D
            </h1>
            <p className="text-xl font-medium tracking-widest uppercase" style={{ color: '#94a3b8' }}>Análise de Produtividade e Curva de Avanço</p>
            </div>
            <div className="text-right text-2xl font-light tracking-[0.2em] uppercase" style={{ color: '#94a3b8' }}>Marconi Fabian - Isometrico Manager</div>
        </div>

        <div className="grid grid-cols-12 gap-8 flex-1">
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
                                <YAxis stroke="#475569" fontSize={14} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}m`} />
                                <Area type="monotone" dataKey="planned" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorPlannedExp)" dot={false} />
                                <Area type="monotone" dataKey="actual" stroke="#22c55e" strokeWidth={4} fillOpacity={1} fill="url(#colorActualExp)" dot={{ r: 6, fill: '#22c55e' }} />
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
                    <div style={{ width: '100%', height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={effortData} layout="vertical" margin={{ left: 40, right: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={14} width={150} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                                    {effortData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
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

        <div className="mt-4 pt-4 flex justify-between font-mono text-lg" style={{ borderTop: '1px solid #1e293b', color: '#64748b' }}>
            <span>Relatório Automático Isometrico Manager - Marconi Fabian</span>
            <span>Página 2 de 2</span>
        </div>
      </div>
    </div>
  );
};
