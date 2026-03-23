
import React from 'react';
import { Clock, CheckCircle2, AlertCircle, Wrench, Thermometer, ShieldCheck, ArrowRight } from 'lucide-react';
import { PipeSegment } from '../types';
import { STATUS_LABELS, STATUS_COLORS, INSULATION_LABELS, INSULATION_COLORS } from '../constants';

interface ProjectTimelineProps {
  pipes: PipeSegment[];
}

const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ pipes }) => {
  // Sort pipes by some criteria to simulate "recent" activity
  // Since we don't have a real timestamp for status changes, we'll just show the last 5 pipes that are not PENDING
  const recentActivity = [...pipes]
    .filter(p => p.status !== 'PENDING' || (p.insulationStatus && p.insulationStatus !== 'NONE'))
    .slice(-6)
    .reverse();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'WELDED': return <ShieldCheck className="text-emerald-400" size={14} />;
      case 'MOUNTED': return <Wrench className="text-amber-400" size={14} />;
      case 'HYDROTEST': return <CheckCircle2 className="text-blue-400" size={14} />;
      default: return <Clock className="text-slate-500" size={14} />;
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-2xl flex-1">
      <h3 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
        <Clock size={14}/> ATIVIDADES RECENTES (LOG DE CAMPO)
      </h3>
      <div className="space-y-4">
        {recentActivity.length > 0 ? (
          recentActivity.map((pipe, idx) => (
            <div key={pipe.id} className="flex gap-3 group relative">
              {idx !== recentActivity.length - 1 && (
                <div className="absolute left-[7px] top-5 bottom-[-16px] w-px bg-slate-800 group-hover:bg-slate-700 transition-colors"></div>
              )}
              <div className="mt-1 z-10 bg-slate-900 ring-4 ring-slate-900">
                {getStatusIcon(pipe.status)}
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-200 uppercase tracking-tight">{pipe.name}</span>
                  <span className="text-[8px] font-mono text-slate-500 uppercase">SPOOL: {pipe.spoolId || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest"
                    style={{ backgroundColor: `${STATUS_COLORS[pipe.status]}20`, color: STATUS_COLORS[pipe.status], border: `1px solid ${STATUS_COLORS[pipe.status]}40` }}
                  >
                    {STATUS_LABELS[pipe.status]}
                  </div>
                  {pipe.insulationStatus && pipe.insulationStatus !== 'NONE' && (
                    <>
                      <ArrowRight size={10} className="text-slate-600" />
                      <div 
                        className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest"
                        style={{ backgroundColor: `${INSULATION_COLORS[pipe.insulationStatus]}20`, color: INSULATION_COLORS[pipe.insulationStatus], border: `1px solid ${INSULATION_COLORS[pipe.insulationStatus]}40` }}
                      >
                        {INSULATION_LABELS[pipe.insulationStatus]}
                      </div>
                    </>
                  )}
                </div>
                {pipe.welderInfo?.weldDate && (
                  <span className="text-[8px] font-mono text-slate-600 uppercase mt-1">
                    Soldado em: {new Date(pipe.welderInfo.weldDate).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-slate-600 text-[10px] font-mono uppercase tracking-widest">
            Nenhuma atividade registrada recentemente.
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectTimeline;
