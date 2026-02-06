import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { PipeSegment, PipeStatus } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import { Activity, Ruler, Flame, Droplets } from 'lucide-react';

interface DashboardProps {
  pipes: PipeSegment[];
}

const Dashboard: React.FC<DashboardProps> = ({ pipes = [] }) => {
  
  // High-level guard: If imports are failing or enums are undefined
  if (!PipeStatus || !STATUS_LABELS || !STATUS_COLORS) return null;

  const stats = useMemo(() => {
    // Check if PipeStatus is actually iterable
    if (!PipeStatus) return { totalLength: 0, installedLength: 0, countByStatus: {} as Record<string, number> };

    const totalLength = pipes.reduce((acc, p) => acc + (p?.length || 0), 0);
    const installedLength = pipes
      .filter(p => p && p.status !== PipeStatus.PENDING)
      .reduce((acc, p) => acc + (p?.length || 0), 0);
    
    // Safely initialize counters
    const countByStatus: Record<string, number> = {};
    
    // Defensive iteration over enum values
    try {
        Object.values(PipeStatus).forEach(status => {
            countByStatus[status] = 0;
        });
    } catch (e) {
        console.warn("Failed to iterate PipeStatus values", e);
    }

    pipes.forEach(p => {
      if (p && p.status && countByStatus[p.status] !== undefined) {
        countByStatus[p.status]++;
      }
    });

    return { totalLength, installedLength, countByStatus };
  }, [pipes]);

  // Construct chart data safely
  const barData = useMemo(() => {
     if (!PipeStatus) return [];
     try {
         return Object.values(PipeStatus).map(status => ({
            name: STATUS_LABELS[status] || status,
            count: (stats.countByStatus && stats.countByStatus[status]) || 0,
            color: STATUS_COLORS[status] || '#888888',
            status: status
         }));
     } catch(e) {
         return [];
     }
  }, [stats]);

  const completionPercentage = stats.totalLength > 0 
    ? Math.round((stats.installedLength / stats.totalLength) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* KPI Cards */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full text-blue-600 dark:text-blue-300">
            <Ruler size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tubulação Total (m)</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{stats.totalLength.toFixed(2)} m</h3>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full text-green-600 dark:text-green-300">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Progresso (Linear)</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{completionPercentage}%</h3>
            <p className="text-xs text-slate-500">Realizado: {stats.installedLength.toFixed(2)}m</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-full text-yellow-600 dark:text-yellow-300">
            <Flame size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Soldas Concluídas</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {(stats.countByStatus[PipeStatus.WELDED] || 0) + (stats.countByStatus[PipeStatus.HYDROTEST] || 0)} / {pipes.length}
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-full text-indigo-600 dark:text-indigo-300">
            <Droplets size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Teste Hidrostático</p>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              {stats.countByStatus[PipeStatus.HYDROTEST] || 0} Linhas
            </h3>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700 h-64 flex flex-col">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Distribuição de Status (Spools/Linhas)</h4>
        <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={120} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{fill: 'transparent'}}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                </Bar>
            </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;