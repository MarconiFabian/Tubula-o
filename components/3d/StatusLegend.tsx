import React from 'react';
import { STATUS_LABELS, STATUS_COLORS, ALL_STATUSES } from '../../constants';

export const StatusLegend: React.FC = () => {
  return (
    <div className="absolute bottom-4 left-4 z-10 bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-slate-700 shadow-xl pointer-events-none">
      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Legenda de Status</h4>
      <div className="flex flex-col gap-1.5">
        {ALL_STATUSES.map(status => (
          <div key={status} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full border border-white/20" 
              style={{ backgroundColor: STATUS_COLORS[status] }} 
            />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">
              {STATUS_LABELS[status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
