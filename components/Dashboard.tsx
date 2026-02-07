import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PipeSegment } from '../types';
import { STATUS_COLORS, STATUS_LABELS, ALL_STATUSES, INSULATION_COLORS, INSULATION_LABELS, ALL_INSULATION_STATUSES } from '../constants';
import { Activity, Ruler, Flame, Droplets, Shield, FileDown, FileText } from 'lucide-react';

interface DashboardProps {
  pipes: PipeSegment[];
  onExportPDF?: () => void; // Optional prop for the export function
  isExporting?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ pipes = [], onExportPDF, isExporting = false }) => {
  
  const stats = useMemo(() => {
    // Defensive check
    if (!Array.isArray(pipes)) {
        return { totalLength: 0, installedLength: 0, countByStatus: {}, countByInsulation: {} };
    }

    const totalLength = pipes.reduce((acc, p) => acc + (p?.length || 0), 0);
    
    // Calculate installed length (anything not PENDING)
    const installedLength = pipes
      .filter(p => p && p.status && p.status !== 'PENDING')
      .reduce((acc, p) => acc + (p?.length || 0), 0);
    
    // Initialize counters safely
    const countByStatus: Record<string, number> = {};
    ALL_STATUSES.forEach(status => countByStatus[status] = 0);

    const countByInsulation: Record<string, number> = {};
    ALL_INSULATION_STATUSES.forEach(status => countByInsulation[status] = 0);

    // Count
    pipes.forEach(p => {
      // Pipe Status
      if (p && p.status) {
        const current = countByStatus[p.status] || 0;
        countByStatus[p.status] = current + 1;
      }
      
      // Insulation Status
      const insStatus = p.insulationStatus || 'NONE';
      const currentIns = countByInsulation[insStatus] || 0;
      countByInsulation[insStatus] = currentIns + 1;
    });

    return { totalLength, installedLength, countByStatus, countByInsulation };
  }, [pipes]);

  // Construct chart data for Pipe Status
  const statusData = useMemo(() => {
     if (!stats || !stats.countByStatus) return [];
     return ALL_STATUSES.map(status => ({
        name: STATUS_LABELS[status] || status,
        count: stats.countByStatus[status] || 0,
        color: STATUS_COLORS[status] || '#94a3b8'
     }));
  }, [stats]);

  // Construct chart data for Insulation Status
  const insulationData = useMemo(() => {
    if (!stats || !stats.countByInsulation) return [];
    return ALL_INSULATION_STATUSES.map(status => {
       // Visual fix: If color is transparent (NONE), make it a visible dark grey for the chart so it can be seen in the legend
       let color = INSULATION_COLORS[status] || '#94a3b8';
       if (color === 'transparent') color = '#334155'; // Dark Slate for "None" in chart

       return {
           name: INSULATION_LABELS[status] || status,
           count: stats.countByInsulation[status] || 0,
           color: color
       };
    });
 }, [stats]);

  const completionPercentage = stats.totalLength > 0 
    ? Math.round((stats.installedLength / stats.totalLength) * 100) 
    : 0;

  // Safe counts
  const weldedCount = (stats.countByStatus['WELDED'] || 0) + (stats.countByStatus['HYDROTEST'] || 0);
  const hydroCount = stats.countByStatus['HYDROTEST'] || 0;

  return (
    <div className="flex flex-col gap-4 mb-6">
      
      {/* EXPORT HEADER - Always visible if function provided */}
      {onExportPDF && (
        <div className="bg-slate-800 rounded-xl p-4 shadow-lg border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <div className="bg-red-500/10 p-3 rounded-full">
                    <FileText className="text-red-500" size={32} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Relatório de Obra (PDF)</h2>
                    <p className="text-slate-400 text-sm">Gere um documento completo com visualização 3D, gráficos e listagem.</p>
                </div>
            </div>
            <button 
                onClick={onExportPDF}
                disabled={isExporting}
                className={`
                    px-6 py-3 rounded-lg font-bold text-white flex items-center gap-2 transition-all shadow-lg
                    ${isExporting 
                        ? 'bg-slate-600 cursor-wait' 
                        : 'bg-red-600 hover:bg-red-500 hover:scale-105 shadow-red-600/20'}
                `}
            >
                <FileDown size={20} />
                {isExporting ? 'Gerando Arquivo...' : 'BAIXAR RELATÓRIO PDF'}
            </button>
        </div>
      )}

      {/* Grid Layout for Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                {weldedCount} / {pipes.length}
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
                {hydroCount} Linhas
                </h3>
            </div>
            </div>
        </div>

        {/* Chart Section - Pipe Status */}
        <div className="col-span-1 md:col-span-1 lg:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700 h-64 flex flex-col">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <Activity size={16} /> Status Montagem/Solda
            </h4>
            <div className="flex-1 w-full">
                {statusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusData} layout="vertical" margin={{ left: 20 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} tick={{fill: '#94a3b8', fontSize: 11}} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                cursor={{fill: 'transparent'}}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                            {statusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        Sem dados
                    </div>
                )}
            </div>
        </div>

        {/* Chart Section - Insulation Status */}
        <div className="col-span-1 md:col-span-1 lg:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-700 h-64 flex flex-col">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <Shield size={16} /> Status Isolamento Térmico
            </h4>
            <div className="flex-1 w-full">
                {insulationData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={insulationData} layout="vertical" margin={{ left: 20 }}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" width={100} tick={{fill: '#94a3b8', fontSize: 11}} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                itemStyle={{ color: '#fff' }}
                                cursor={{fill: 'transparent'}}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                            {insulationData.map((entry, index) => (
                                <Cell key={`cell-ins-${index}`} fill={entry.color} />
                            ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                        Sem dados
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;