import React from 'react';
import { Ruler, Wrench, Shield, Timer, Calendar, Cuboid, Image as ImageIcon, Package, MapPin } from 'lucide-react';
import { PipeSegment, Annotation, PipeStatus, InsulationStatus } from '../types';
import { STATUS_LABELS, STATUS_COLORS, INSULATION_LABELS, INSULATION_COLORS, ALL_STATUSES, ALL_INSULATION_STATUSES } from '../constants';

interface ExportContainerProps {
  viewMode: string;
  reportStats: any;
  sceneScreenshot: string | null;
  secondaryImage: string | null;
  mapImage: string | null;
  projectClient: string;
  projectLocation: string;
  activityDate: string;
}

export const ExportContainer: React.FC<ExportContainerProps> = ({
  viewMode, reportStats, sceneScreenshot, secondaryImage, mapImage, projectClient, projectLocation, activityDate
}) => {
  return (
    <div id="composed-dashboard-export" style={{ position: 'absolute', top: '-10000px', left: 0, width: '1920px', backgroundColor: '#0f172a', padding: '60px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '40px', color: '#f1f5f9' }}>
      <div className="flex justify-between items-start pb-6" style={{ borderBottom: '1px solid #334155' }}>
        <div>
          <h1 className="text-6xl font-bold tracking-tight leading-none mb-2 uppercase" style={{ color: '#ffffff' }}>
            {viewMode === 'planning' ? 'CRONOGRAMA DE ATAQUE (SALDO)' : 'RASTREABILIDADE FÍSICA'}
          </h1>
          <p className="text-xl font-medium tracking-widest uppercase" style={{ color: '#94a3b8' }}>Trabalho Pendente e Prazos de Execução</p>
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
  );
};
