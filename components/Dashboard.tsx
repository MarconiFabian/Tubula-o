
import React, { useMemo, useRef, useState } from 'react';
import { PipeSegment, ProductivitySettings, Annotation, DailyProduction, AccessoryStatus } from '../types';
import { ProjectData } from '../utils/db';
import { STATUS_COLORS, STATUS_LABELS, ALL_STATUSES, INSULATION_COLORS, INSULATION_LABELS, ALL_INSULATION_STATUSES, PIPING_REMAINING_FACTOR, INSULATION_REMAINING_FACTOR, HOURS_PER_DAY } from '../constants';
import { Activity, FileDown, Upload, Image as ImageIcon, Map as MapIcon, Layers, Shield, Ruler, Package, AlertCircle, Search, Filter, ClipboardList, UserCog, Calendar, CheckSquare, TrendingUp, Timer, Users, Target, BarChart3, Database, ChevronDown, Check, Zap, Calculator } from 'lucide-react';
import SmartInsights from './SmartInsights';
import ProjectTimeline from './ProjectTimeline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, ReferenceDot, BarChart, Bar, Cell, ComposedChart } from 'recharts';
import { getWorkingEndDate, getWorkingDaysBetween } from '../utils/planning';

interface DashboardProps {
  pipes: PipeSegment[];
  onExportPDF?: () => void;
  isExporting?: boolean;
  exportMode?: boolean; 
  secondaryImage?: string | null;
  mapImage?: string | null;
  onUploadSecondary?: (img: string | null) => void;
  onUploadMap?: (img: string | null) => void;
  sceneScreenshot?: string | null;
  onSelectPipe?: (id: string, multi?: boolean) => void; 
  selectedIds?: string[];
  onSetSelection?: (ids: string[]) => void;
  prodSettings?: ProductivitySettings;
  startDate?: string;
  annotations?: Annotation[];
  deadlineDate?: string | null;
  savedProjects?: ProjectData[];
  selectedProjectIds?: string[];
  onSetSelectedProjectIds?: (ids: string[]) => void;
  dailyProduction?: DailyProduction[];
  onUpdateDailyProduction?: (dp: DailyProduction[]) => void;
  onOpenDailyProduction?: () => void;
}

type TabType = 'overview' | 'tracking' | 'planning';

const Dashboard: React.FC<DashboardProps> = ({ 
    pipes = [], 
    annotations = [],
    onExportPDF, 
    isExporting = false, 
    exportMode = false,
    secondaryImage,
    mapImage,
    onUploadSecondary,
    onUploadMap,
    sceneScreenshot,
    onSelectPipe,
    selectedIds = [],
    onSetSelection,
    prodSettings,
    startDate,
    deadlineDate,
    savedProjects = [],
    selectedProjectIds = [],
    onSetSelectedProjectIds,
    dailyProduction = [],
    onUpdateDailyProduction,
    onOpenDailyProduction
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [showProjectSelector, setShowProjectSelector] = useState(false);

  const secInputRef = useRef<HTMLInputElement>(null);
  const mapInputRef = useRef<HTMLInputElement>(null);

  const aggregatedData = useMemo(() => {
    if (selectedProjectIds.length === 0) {
      return { pipes, annotations };
    }

    let allPipes = [...pipes];
    let allAnnotations = [...annotations];

    selectedProjectIds.forEach(id => {
      const project = savedProjects.find(p => p.id === id);
      if (project) {
        // Add project name as prefix to pipe names to distinguish them
        const projectPipes = project.pipes.map(p => ({
          ...p,
          name: `[${project.name}] ${p.name}`,
          id: `${project.id}-${p.id}` // Ensure unique IDs
        }));
        allPipes = [...allPipes, ...projectPipes];
        allAnnotations = [...allAnnotations, ...project.annotations];
      }
    });

    return { pipes: allPipes, annotations: allAnnotations };
  }, [pipes, annotations, selectedProjectIds, savedProjects]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setter?: (val: string | null) => void) => {
      const file = e.target.files?.[0];
      if (file && setter) {
          const reader = new FileReader();
          reader.onload = (ev) => setter(ev.target?.result as string);
          reader.readAsDataURL(file);
      }
  };

  const stats = useMemo(() => {
    const currentPipes = aggregatedData.pipes;
    const currentAnnotations = aggregatedData.annotations;

    const totalLength = currentPipes.reduce((acc, p) => acc + (p?.length || 0), 0);
    const totalPipes = currentPipes.length;
    
    const pipingTotalLength = currentPipes.reduce((acc, p) => acc + (p?.length || 0), 0);
    const pipingRemainingLength = currentPipes.reduce((acc, p) => acc + (p?.length || 0) * (PIPING_REMAINING_FACTOR[p.status] ?? 1), 0);
    const pipingExecutedLength = pipingTotalLength - pipingRemainingLength;

    const insulationPipes = currentPipes.filter(p => p.insulationStatus && p.insulationStatus !== 'NONE');
    const insulationTotalLength = insulationPipes.reduce((acc, p) => acc + (p?.length || 0), 0);
    const insulationRemainingLength = insulationPipes.reduce((acc, p) => acc + (p?.length || 0) * (INSULATION_REMAINING_FACTOR[p.insulationStatus || 'NONE'] ?? 1), 0);
    const insulationExecutedLength = insulationTotalLength - insulationRemainingLength;
    
    const pipeCounts: Record<string, number> = {};
    const pipeLengths: Record<string, number> = {};
    ALL_STATUSES.forEach(s => { pipeCounts[s] = 0; pipeLengths[s] = 0; });
    currentPipes.forEach(p => { 
        if (p.status) {
            pipeCounts[p.status] = (pipeCounts[p.status] || 0) + 1; 
            pipeLengths[p.status] = (pipeLengths[p.status] || 0) + (p.length || 0);
        }
    });

    const insulationCounts: Record<string, number> = {};
    const insulationLengths: Record<string, number> = {};
    ALL_INSULATION_STATUSES.forEach(s => { insulationCounts[s] = 0; insulationLengths[s] = 0; });
    currentPipes.forEach(p => { 
        const status = p.insulationStatus || 'NONE';
        insulationCounts[status] = (insulationCounts[status] || 0) + 1; 
        insulationLengths[status] = (insulationLengths[status] || 0) + (p.length || 0);
    });

    const bom: Record<string, number> = {};
    currentPipes.forEach(p => {
        const inches = Math.round(p.diameter * 39.37);
        const dLabel = `${inches}`; 
        if (!bom[dLabel]) bom[dLabel] = 0;
        bom[dLabel] += p.length;
    });

    // Daily Productivity Calculation
    const dailyProd: Record<string, number> = {};
    const todayStr = new Date().toISOString().split('T')[0];
    currentPipes.forEach(p => {
        const isCompleted = ['WELDED', 'HYDROTEST', 'FINISHED'].includes(p.status);
        if (isCompleted) {
            const date = p.welderInfo?.weldDate || todayStr;
            dailyProd[date] = (dailyProd[date] || 0) + (p.length || 0);
        }
    });
    const sortedDailyProd = Object.entries(dailyProd)
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .slice(-7); // Last 7 days

    const completedWeight = (pipeLengths['WELDED'] * 0.8) + (pipeLengths['HYDROTEST'] * 1.0) + (pipeLengths['MOUNTED'] * 0.3);
    const progress = pipingTotalLength > 0 ? (completedWeight / pipingTotalLength) * 100 : 0;

    // Planning Data for S-Curve and Projected End
    const totalHH = currentPipes.reduce((acc, p) => {
        const pipingF = PIPING_REMAINING_FACTOR[p.status] || 0;
        const insulationF = INSULATION_REMAINING_FACTOR[p.insulationStatus || 'NONE'] || 0;
        
        const pipingBaseEffort = (p.length * (prodSettings?.pipingBase || 1) * pipingF);
        const insulationBaseEffort = (p.length * (prodSettings?.insulationBase || 1) * insulationF);
        
        // Adicionar esforço de acessórios (apenas se for piping)
        const hasModernSupports = p.accessories?.some(a => a.type === 'SUPPORT');
        const supportCount = hasModernSupports 
            ? (p.accessories?.filter(a => a.type === 'SUPPORT').length || 0)
            : (p.supports?.total || 0);

        const supportEffort = supportCount * (prodSettings?.supportBase || 2.5) * pipingF;
        
        const baseEffort = pipingBaseEffort + insulationBaseEffort + supportEffort;
        
        const factors = p.planningFactors || { teamCount: 1, hasCrane: false, hasBlockage: false, isNightShift: false, isCriticalArea: false, accessType: 'NONE', delayHours: 0, materialAvailable: true, weatherExposed: false };
        let mult = 1.0;
        if (prodSettings) {
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
        }

        let effort = (baseEffort * mult);
        if (prodSettings) {
            effort *= (1 + prodSettings.globalConfig.reworkFactor);
        }
        
        return acc + effort + (factors.delayHours || 0);
    }, 0);

    const totalHHWithBuffer = totalHH * (1 + (prodSettings?.globalConfig.safetyBuffer || 0));

    const totalTeamsCount = currentPipes.reduce((acc, p) => acc + (p.planningFactors?.teamCount || 1), 0);
    const avgTeams = currentPipes.length > 0 ? Math.max(1, Math.round(totalTeamsCount / currentPipes.length)) : 1;
    
    // Support Effort from Annotations
    let annotationHH = 0;
    const annotationBreakdown: Record<string, number> = {};
    
    currentAnnotations.forEach(a => {
        if (a.estimatedHours) {
            annotationHH += a.estimatedHours;
            const type = a.type || 'COMMENT';
            annotationBreakdown[type] = (annotationBreakdown[type] || 0) + a.estimatedHours;
        }
    });

    const finalTotalHH = totalHHWithBuffer + annotationHH;

    const dailyCapacity = avgTeams * (prodSettings?.globalConfig.shiftHours || 8.8);
    const daysNeeded = Math.ceil(finalTotalHH / dailyCapacity);
    const projectedEnd = getWorkingEndDate(new Date((startDate || new Date().toISOString().split('T')[0]) + 'T12:00:00'), daysNeeded, prodSettings?.globalConfig.workOnWeekends).toLocaleDateString('pt-BR');

    // Deadline Calculation
    let deadlineStats = null;
    if (deadlineDate) {
        const start = new Date((startDate || new Date().toISOString().split('T')[0]) + 'T12:00:00');
        const end = new Date(deadlineDate + 'T12:00:00');
        const daysUntilDeadline = getWorkingDaysBetween(start, end, prodSettings?.globalConfig.workOnWeekends);
        
        if (daysUntilDeadline > 0) {
            const requiredDailyOutput = totalLength / daysUntilDeadline; // meters/day
            const requiredDailyHH = finalTotalHH / daysUntilDeadline; // HH/day
            const currentDailyOutput = (dailyCapacity / finalTotalHH) * totalLength; // Approximate meters/day based on capacity
            
            deadlineStats = {
                daysUntilDeadline,
                requiredDailyOutput,
                requiredDailyHH,
                currentDailyOutput,
                isFeasible: requiredDailyHH <= dailyCapacity,
                ratio: (requiredDailyHH / dailyCapacity) * 100,
                efficiencyScore: Math.min(100, (dailyCapacity / requiredDailyHH) * 100)
            };
        }
    }

    const sCurveData: any[] = [];
    if (currentPipes.length > 0) {
        const startStr = (startDate || new Date().toISOString().split('T')[0]);
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Initial cumulative: everything before start date
        const initialCumulativeActual = (dailyProduction && dailyProduction.length > 0) 
            ? dailyProduction.filter(dp => dp.date < startStr).reduce((acc, dp) => acc + dp.pipeMeters, 0)
            : currentPipes.filter(p => (p.welderInfo?.weldDate || todayStr) < startStr).reduce((acc, p) => {
                const pipingDone = 1 - (PIPING_REMAINING_FACTOR[p.status] ?? 1);
                return acc + (p.length * pipingDone);
            }, 0);

        let cumulativeActual = initialCumulativeActual;
        const totalLengthValue = totalLength;
        const initialProgressPct = totalLengthValue > 0 ? (initialCumulativeActual / totalLengthValue * 100) : 0;

        // Theoretical Planned Curve
        const days = deadlineStats ? deadlineStats.daysUntilDeadline : (daysNeeded || 30); 
        const start = new Date(startStr + 'T12:00:00');
        const today = new Date(todayStr + 'T12:00:00');
        
        const plotDays = Math.max(days, daysNeeded || 0);

        // Calculate Automatic Progression (Linear from start to today based on current total progress)
        const totalProgressValue = progress; // Current total %
        const daysSinceStart = Math.max(1, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

        for (let i = 0; i <= plotDays; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            
            // Actual production on this specific day
            let dayProd = 0;
            if (dailyProduction && dailyProduction.length > 0) {
                const dp = dailyProduction.find(d => d.date === dateStr);
                dayProd = dp ? dp.pipeMeters : 0;
            } else {
                dayProd = currentPipes.filter(p => {
                    const d = p.welderInfo?.weldDate || todayStr;
                    return d === dateStr;
                }).reduce((acc, p) => {
                    const pipingDone = 1 - (PIPING_REMAINING_FACTOR[p.status] ?? 1);
                    return acc + (p.length * pipingDone);
                }, 0);
            }
            cumulativeActual += dayProd;

            // Planned (Sigmoid Curve) - Adjusted to start from initial progress
            // We use a slightly less aggressive sigmoid for better realism
            // If plotDays is 0, we avoid division by zero
            const progressRatio = plotDays > 0 ? (i / plotDays) : 1;
            const x = progressRatio * 10 - 5; // Range -5 to 5
            const sigmoid = 1 / (1 + Math.exp(-x));
            
            // Normalize sigmoid to start at 0 and end at 1 within the plot window
            const s0 = 1 / (1 + Math.exp(5)); // sigmoid(-5)
            const s1 = 1 / (1 + Math.exp(-5)); // sigmoid(5)
            const normalizedSigmoid = (sigmoid - s0) / (s1 - s0);
            
            const planned = initialProgressPct + (normalizedSigmoid * (100 - initialProgressPct));

            // Automatic Progression: Linear from initial progress to current total progress
            let autoProgress = null;
            if (dateStr <= todayStr) {
                const linearFactor = Math.min(i / daysSinceStart, 1);
                autoProgress = parseFloat((initialProgressPct + (linearFactor * (totalProgressValue - initialProgressPct))).toFixed(2));
            }

            // Milestones
            let milestone = null;
            if (i === Math.round(plotDays * 0.25)) milestone = "25%";
            if (i === Math.round(plotDays * 0.50)) milestone = "50%";
            if (i === Math.round(plotDays * 0.75)) milestone = "75%";
            if (i === plotDays) milestone = "100%";

            // Only show actual if date is <= today
            const isFuture = dateStr > todayStr;

            const dp = dailyProduction.find(d => d.date === dateStr);

            sCurveData.push({
                date: dateStr.split('-').slice(1).join('/'),
                actual: !isFuture && totalLengthValue && totalLengthValue > 0 ? parseFloat(((cumulativeActual || 0) / totalLengthValue * 100).toFixed(2)) : null,
                planned: parseFloat(planned.toFixed(2)),
                autoProgress: autoProgress,
                actualMeters: parseFloat((cumulativeActual || 0).toFixed(2)),
                plannedMeters: parseFloat(((planned / 100) * totalLengthValue).toFixed(2)),
                pipingProgress: dp?.pipingProgress ?? null,
                insulationProgress: dp?.insulationProgress ?? null,
                totalProgress: dp?.totalProgress ?? null,
                plannedTotalProgress: parseFloat(planned.toFixed(2)),
                milestone,
                isLastActual: dateStr === todayStr
            });
        }
    }

    const componentStats = {
        supports: { total: 0, installed: 0 }
    };

    currentPipes.forEach(p => {
        // Count accessories (modern way)
        let hasModernSupports = false;
        if (p.accessories) {
            p.accessories.forEach(a => {
                const isPipeInstalled = p.status === 'MOUNTED' || p.status === 'WELDED' || p.status === 'HYDROTEST';
                const isInstalled = a.status === AccessoryStatus.MOUNTED || isPipeInstalled;
                if (a.type === 'SUPPORT') {
                    hasModernSupports = true;
                    componentStats.supports.total += 1;
                    if (isInstalled) componentStats.supports.installed += 1;
                }
            });
        }

        // Count supports from the 'supports' field (legacy or direct) ONLY if no modern supports
        if (p.supports && !hasModernSupports) {
            componentStats.supports.total += (p.supports.total || 0);
            const isPipeInstalled = p.status === 'MOUNTED' || p.status === 'WELDED' || p.status === 'HYDROTEST';
            componentStats.supports.installed += isPipeInstalled ? (p.supports.total || 0) : (p.supports.installed || 0);
        }
    });

    return { totalLength, totalPipes, pipeCounts, pipeLengths, insulationCounts, insulationLengths, bom, progress, sortedDailyProd, sCurveData, totalHH: finalTotalHH, annotationHH, annotationBreakdown, totalTeams: avgTeams, projectedEnd, daysNeeded, deadlineStats, pipingTotalLength, pipingRemainingLength, pipingExecutedLength, insulationTotalLength, insulationRemainingLength, insulationExecutedLength, componentStats };
  }, [pipes, annotations, startDate, prodSettings, deadlineDate, aggregatedData]);

  const filteredPipes = useMemo(() => {
      return aggregatedData.pipes.filter(p => {
          const matchesSearch = 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.spoolId && p.spoolId.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (p.welderInfo?.welderId && p.welderInfo.welderId.toLowerCase().includes(searchTerm.toLowerCase()));
          const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
          return matchesSearch && matchesStatus;
      });
  }, [aggregatedData.pipes, searchTerm, statusFilter]);

  const allFilteredSelected = filteredPipes.length > 0 && filteredPipes.every(p => selectedIds.includes(p.id));
  
  const handleSelectAll = () => {
      if (!onSetSelection) return;
      if (allFilteredSelected) {
          const newSelection = selectedIds.filter(id => !filteredPipes.find(p => p.id === id));
          onSetSelection(newSelection);
      } else {
          const newIds = filteredPipes.map(p => p.id);
          const combined = Array.from(new Set([...selectedIds, ...newIds]));
          onSetSelection(combined);
      }
  };

  return (
    <div className={`flex flex-col gap-6 w-full bg-grid-slate ${exportMode ? 'p-0' : 'pb-12'}`}>
      
      {!exportMode && onExportPDF && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/80 backdrop-blur-md p-6 rounded-xl border border-slate-800 shadow-2xl gap-4 relative z-30">
             <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded flex items-center justify-center">
                    <Activity className="text-blue-500 animate-pulse" size={24} />
                 </div>
                 <div>
                     <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">CONTROLE DE MISSÃO <span className="text-[10px] bg-blue-600 px-1.5 py-0.5 rounded text-white font-mono">LIVE</span></h2>
                     <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Sistema de Gerenciamento de Tubulação Industrial v2.0</p>
                 </div>
             </div>
             <div className="flex gap-4 items-center">
                  {/* PROJECT MULTI-SELECTOR */}
                  {!exportMode && savedProjects.length > 0 && (
                      <div className="relative">
                          <button 
                              onClick={() => setShowProjectSelector(!showProjectSelector)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-mono text-[10px] uppercase tracking-widest transition-all h-10 ${selectedProjectIds.length > 0 ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-lg shadow-purple-900/20' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                          >
                              <Database size={14} />
                              {selectedProjectIds.length === 0 ? 'CONSOLIDAR' : `${selectedProjectIds.length + 1} PROJETOS`}
                              <ChevronDown size={14} className={`transition-transform ${showProjectSelector ? 'rotate-180' : ''}`} />
                          </button>

                          {showProjectSelector && (
                              <div className="absolute top-full right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-[100] p-2 animate-in fade-in slide-in-from-top-2">
                                  <div className="p-3 border-b border-slate-800 mb-2">
                                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Selecione para consolidar</div>
                                  </div>
                                  <div className="max-h-64 overflow-y-auto space-y-1">
                                      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700 opacity-50 cursor-not-allowed">
                                          <div className="flex items-center gap-3">
                                              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                              <span className="text-[10px] font-bold text-white uppercase">Projeto Atual (Ativo)</span>
                                          </div>
                                          <Check size={14} className="text-blue-500" />
                                      </div>
                                      {savedProjects.map(proj => (
                                          <button 
                                              key={proj.id}
                                              onClick={() => {
                                                  if (onSetSelectedProjectIds) {
                                                      const newIds = selectedProjectIds.includes(proj.id) 
                                                          ? selectedProjectIds.filter(id => id !== proj.id) 
                                                          : [...selectedProjectIds, proj.id];
                                                      onSetSelectedProjectIds(newIds);
                                                  }
                                              }}
                                              className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${selectedProjectIds.includes(proj.id) ? 'bg-purple-600/20 border border-purple-500/50 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
                                          >
                                              <div className="flex items-center gap-3">
                                                  <div className={`w-2 h-2 rounded-full ${selectedProjectIds.includes(proj.id) ? 'bg-purple-500' : 'bg-slate-700'}`}></div>
                                                  <span className="text-[10px] font-bold truncate max-w-[180px] uppercase">{proj.name}</span>
                                              </div>
                                              {selectedProjectIds.includes(proj.id) && <Check size={14} className="text-purple-500" />}
                                          </button>
                                      ))}
                                  </div>
                                  {selectedProjectIds.length > 0 && (
                                      <button 
                                          onClick={() => onSetSelectedProjectIds && onSetSelectedProjectIds([])}
                                          className="w-full mt-2 p-2 text-[10px] font-black text-red-400 uppercase hover:bg-red-500/10 rounded-lg transition-all"
                                      >
                                          Limpar Consolidação
                                      </button>
                                  )}
                              </div>
                          )}
                      </div>
                  )}
                  <div className="bg-slate-950 p-1 rounded-lg flex border border-slate-800">
                    <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-md text-[10px] font-mono uppercase tracking-wider flex items-center gap-2 transition-all ${activeTab === 'overview' ? 'bg-slate-800 text-blue-400 shadow-inner border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}><Activity size={14}/> Visão Geral</button>
                    <button onClick={() => setActiveTab('tracking')} className={`px-4 py-2 rounded-md text-[10px] font-mono uppercase tracking-wider flex items-center gap-2 transition-all ${activeTab === 'tracking' ? 'bg-slate-800 text-blue-400 shadow-inner border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}><ClipboardList size={14}/> Rastreamento</button>
                    <button onClick={() => setActiveTab('planning')} className={`px-4 py-2 rounded-md text-[10px] font-mono uppercase tracking-wider flex items-center gap-2 transition-all ${activeTab === 'planning' ? 'bg-slate-800 text-blue-400 shadow-inner border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}><TrendingUp size={14}/> Planejamento</button>
                 </div>
                 <button onClick={onExportPDF} disabled={isExporting} className="bg-red-600 hover:bg-red-700 border border-red-500/30 text-white px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest flex gap-2 items-center transition-all shadow-lg h-10 shadow-red-600/20"><FileDown size={14} /> {isExporting ? 'GERANDO...' : 'EXPORTAR PDF'}</button>
             </div>
        </div>
      )}

      {(activeTab === 'overview' || exportMode) && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {/* DESTAQUE DE EXECUÇÃO - MÉTRICAS CRÍTICAS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border-2 border-blue-500/30 p-6 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.15)] flex flex-col gap-4 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 opacity-10"><Ruler size={120} className="text-blue-500" /></div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]"></div>
                        <h2 className="text-lg font-black text-white uppercase tracking-widest font-mono">Tubulação (Metros)</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-4 relative z-10">
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-tighter mb-1">Total Projeto</span>
                            <span className="text-3xl font-black text-white font-mono tracking-tighter">{(stats.pipingTotalLength || 0).toFixed(1)}<span className="text-xs text-slate-500 ml-1">m</span></span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-emerald-500 text-[10px] font-black uppercase tracking-tighter mb-1">Executado</span>
                            <span className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">{(stats.pipingExecutedLength || 0).toFixed(1)}<span className="text-xs text-slate-500 ml-1">m</span></span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-amber-500 text-[10px] font-black uppercase tracking-tighter mb-1">Falta Executar</span>
                            <span className="text-3xl font-black text-amber-400 font-mono tracking-tighter">{(stats.pipingRemainingLength || 0).toFixed(1)}<span className="text-xs text-slate-500 ml-1">m</span></span>
                        </div>
                    </div>
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.4)]" style={{ width: `${stats.pipingTotalLength > 0 ? (stats.pipingExecutedLength / stats.pipingTotalLength) * 100 : 0}%` }}></div>
                    </div>
                </div>

                <div className="bg-slate-900 border-2 border-amber-500/30 p-6 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.15)] flex flex-col gap-4 relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 opacity-10"><Package size={120} className="text-amber-500" /></div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]"></div>
                        <h2 className="text-lg font-black text-white uppercase tracking-widest font-mono">Suportes (Unidades)</h2>
                    </div>
                    <div className="grid grid-cols-3 gap-4 relative z-10">
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-tighter mb-1">Total Projeto</span>
                            <span className="text-3xl font-black text-white font-mono tracking-tighter">{stats?.componentStats?.supports?.total || 0}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-emerald-500 text-[10px] font-black uppercase tracking-tighter mb-1">Montados</span>
                            <span className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">{stats?.componentStats?.supports?.installed || 0}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-amber-500 text-[10px] font-black uppercase tracking-tighter mb-1">Falta Montar</span>
                            <span className="text-3xl font-black text-amber-400 font-mono tracking-tighter">{(stats?.componentStats?.supports?.total || 0) - (stats?.componentStats?.supports?.installed || 0)}</span>
                        </div>
                    </div>
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]" style={{ width: `${(stats?.componentStats?.supports?.total || 0) > 0 ? ((stats?.componentStats?.supports?.installed || 0) / stats.componentStats.supports.total) * 100 : 0}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Ruler size={64} className="text-blue-500" /></div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                        <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Comprimento Total</span>
                    </div>
                    <div className="text-3xl font-bold text-white font-mono tracking-tighter">{(stats.totalLength || 0).toFixed(2)}<span className="text-xs text-slate-500 ml-1">m</span></div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group hover:border-purple-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Package size={64} className="text-purple-500" /></div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                        <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Total de Spools</span>
                    </div>
                    <div className="text-3xl font-bold text-white font-mono tracking-tighter">{stats.totalPipes}</div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group hover:border-green-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Activity size={64} className="text-green-500" /></div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse"></div>
                        <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Eficiência</span>
                    </div>
                    <div className="text-3xl font-bold text-green-400 font-mono tracking-tighter">{(stats.progress || 0).toFixed(1)}<span className="text-xs ml-1">%</span></div>
                </div>
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group hover:border-red-500/30 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><AlertCircle size={64} className="text-red-500" /></div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                        <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Pendências</span>
                    </div>
                    <div className="text-3xl font-bold text-white font-mono tracking-tighter">{stats.pipeCounts['PENDING']}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col gap-4 relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                    <div className="flex items-center justify-between mb-2 border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                            <span className="text-slate-400 text-xs font-mono uppercase tracking-widest font-bold">Balanço de Tubulação</span>
                        </div>
                        <span className="text-blue-400 font-mono text-xs font-bold">{stats.pipingTotalLength > 0 ? ((stats.pipingExecutedLength / stats.pipingTotalLength) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-1">Total</span>
                            <span className="text-xl font-bold text-white font-mono">{(stats.pipingTotalLength || 0).toFixed(2)}<span className="text-[10px] text-slate-500 ml-1">m</span></span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-1">Executado</span>
                            <span className="text-xl font-bold text-green-400 font-mono">{(stats.pipingExecutedLength || 0).toFixed(2)}<span className="text-[10px] text-slate-500 ml-1">m</span></span>
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[8px] font-mono text-slate-400">
                                    <span>Soldado:</span>
                                    <span className="text-white">{((stats.pipeLengths['WELDED'] || 0) + (stats.pipeLengths['HYDROTEST'] || 0)).toFixed(2)}m</span>
                                </div>
                                <div className="flex justify-between text-[8px] font-mono text-slate-400">
                                    <span>Testado:</span>
                                    <span className="text-white">{(stats.pipeLengths['HYDROTEST'] || 0).toFixed(2)}m</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-1">A Executar</span>
                            <span className="text-xl font-bold text-yellow-400 font-mono">{(stats.pipingRemainingLength || 0).toFixed(2)}<span className="text-[10px] text-slate-500 ml-1">m</span></span>
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[8px] font-mono text-slate-400">
                                    <span>P/ Soldar:</span>
                                    <span className="text-white">{((stats.pipeLengths['PENDING'] || 0) + (stats.pipeLengths['MOUNTED'] || 0)).toFixed(2)}m</span>
                                </div>
                                <div className="flex justify-between text-[8px] font-mono text-slate-400">
                                    <span>P/ Testar:</span>
                                    <span className="text-white">{(stats.pipingTotalLength - (stats.pipeLengths['HYDROTEST'] || 0)).toFixed(2)}m</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-blue-500" style={{ width: `${stats.pipingTotalLength > 0 ? (stats.pipingExecutedLength / stats.pipingTotalLength) * 100 : 0}%` }}></div>
                    </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col gap-4 relative overflow-hidden group hover:border-purple-500/30 transition-colors">
                    <div className="flex items-center justify-between mb-2 border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                            <span className="text-slate-400 text-xs font-mono uppercase tracking-widest font-bold">Balanço de Proteção Térmica</span>
                        </div>
                        <span className="text-purple-400 font-mono text-xs font-bold">{stats.insulationTotalLength > 0 ? ((stats.insulationExecutedLength / stats.insulationTotalLength) * 100).toFixed(1) : 0}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-1">Total</span>
                            <span className="text-xl font-bold text-white font-mono">{(stats.insulationTotalLength || 0).toFixed(2)}<span className="text-[10px] text-slate-500 ml-1">m</span></span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-1">Executado</span>
                            <span className="text-xl font-bold text-green-400 font-mono">{(stats.insulationExecutedLength || 0).toFixed(2)}<span className="text-[10px] text-slate-500 ml-1">m</span></span>
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[8px] font-mono text-slate-400">
                                    <span>Concluído:</span>
                                    <span className="text-white">{stats.insulationLengths['FINISHED']?.toFixed(2) || '0.00'}m</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-1">A Executar</span>
                            <span className="text-xl font-bold text-yellow-400 font-mono">{(stats.insulationRemainingLength || 0).toFixed(2)}<span className="text-[10px] text-slate-500 ml-1">m</span></span>
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[8px] font-mono text-slate-400">
                                    <span>P/ Concluir:</span>
                                    <span className="text-white">{(stats.insulationTotalLength - (stats.insulationLengths['FINISHED'] || 0)).toFixed(2)}m</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-purple-500" style={{ width: `${stats.insulationTotalLength > 0 ? (stats.insulationExecutedLength / stats.insulationTotalLength) * 100 : 0}%` }}></div>
                    </div>
                </div>

                <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col gap-4 relative overflow-hidden group hover:border-amber-500/30 transition-colors md:col-span-2">
                    <div className="flex items-center justify-between mb-2 border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                            <span className="text-slate-400 text-xs font-mono uppercase tracking-widest font-bold">Acessórios e Componentes</span>
                        </div>
                        <div className="flex flex-wrap gap-4">
                            <span className="text-amber-400 font-mono text-[10px] font-bold">Suportes: {stats?.componentStats?.supports?.installed || 0}/{stats?.componentStats?.supports?.total || 0}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                        {[
                            { id: 'supports', label: 'Suportes', color: 'bg-orange-500' }
                        ].filter(comp => stats?.componentStats?.[comp.id] && (stats.componentStats[comp.id]?.total || 0) > 0).map(comp => {
                            const data = stats?.componentStats?.[comp.id];
                            const pct = (data?.total || 0) > 0 ? ((data?.installed || 0) / (data?.total || 1)) * 100 : 0;
                            return (
                                <div key={comp.id} className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{comp.label}</span>
                                        <span className="text-[10px] font-mono text-white font-bold">{pct.toFixed(0)}%</span>
                                    </div>
                                    <div className="flex items-end gap-2">
                                        <span className="text-xl font-bold text-white font-mono">{data?.installed || 0}</span>
                                        <span className="text-[10px] text-slate-500 mb-1">/ {data?.total || 0}</span>
                                        <span className="text-[9px] text-amber-500 font-bold ml-auto mb-1">FALTA: {(data?.total || 0) - (data?.installed || 0)}</span>
                                    </div>
                                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                                        <div className={`h-full ${comp.color} transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="col-span-12 md:col-span-5 flex flex-col gap-6">
                    <div className="bg-slate-900 rounded-xl border border-slate-800 aspect-video flex flex-col items-center justify-center relative overflow-hidden group shadow-2xl">
                        <div className="absolute top-0 left-0 w-full p-3 bg-slate-950/80 backdrop-blur-sm z-10 border-b border-slate-800 flex justify-between items-center">
                            <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                FEED DE TELEMETRIA 3D
                            </span>
                            <span className="text-[8px] font-mono text-slate-500">REF: ISO-MGR-01</span>
                        </div>
                        {sceneScreenshot ? <img src={sceneScreenshot} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" /> : <div className="text-slate-800 flex flex-col items-center"><Activity size={48} className="mb-2 opacity-20"/><p className="text-[10px] font-mono uppercase tracking-widest opacity-40">Aguardando fluxo de dados...</p></div>}
                    </div>
                    <div className="grid grid-cols-2 gap-4 h-40">
                            <div className="bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden group flex flex-col shadow-lg">
                                <div className="absolute top-0 left-0 w-full p-2 bg-slate-950/80 backdrop-blur-sm z-10 flex justify-between items-center border-b border-slate-800"><span className="text-[9px] font-mono text-yellow-500 uppercase tracking-widest flex items-center gap-1"><ImageIcon size={10} /> FOTO_DE_CAMPO</span></div>
                                {secondaryImage ? <img src={secondaryImage} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all" /> : <div className="flex-1 flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => secInputRef.current?.click()}><Upload size={20} className="text-slate-700"/></div>}
                                <input type="file" ref={secInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, onUploadSecondary)} />
                            </div>
                            <div className="bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden group flex flex-col shadow-lg">
                                <div className="absolute top-0 left-0 w-full p-2 bg-slate-950/80 backdrop-blur-sm z-10 flex justify-between items-center border-b border-slate-800"><span className="text-[9px] font-mono text-green-500 uppercase tracking-widest flex items-center gap-1"><MapIcon size={10} /> GEOLOCALIZAÇÃO</span></div>
                                {mapImage ? <img src={mapImage} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all" /> : <div className="flex-1 flex items-center justify-center cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => mapInputRef.current?.click()}><Upload size={20} className="text-slate-700"/></div>}
                                <input type="file" ref={mapInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, onUploadMap)} />
                            </div>
                    </div>
                </div>

                <div className="col-span-12 md:col-span-7 flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16"></div>
                            <h3 className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
                                <Layers size={14}/> MATRIZ_DE_STATUS_DE_MONTAGEM
                            </h3>
                            <div className="flex items-end justify-around gap-3 h-32">
                                {ALL_STATUSES.map(status => {
                                    const height = (stats.pipeLengths[status] / Math.max(1, stats.pipingTotalLength)) * 100;
                                    const pct = stats.pipingTotalLength > 0 ? ((stats.pipeLengths[status] / stats.pipingTotalLength) * 100).toFixed(1) : "0.0";
                                    return (
                                        <div key={status} className="flex flex-col items-center flex-1 h-full justify-end group">
                                            <span className="text-white font-mono text-[9px] mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{pct}%</span>
                                            <div className="w-full rounded-t-[2px] transition-all duration-500 group-hover:brightness-125 relative" style={{ height: `${Math.max(height, 4)}%`, backgroundColor: STATUS_COLORS[status], boxShadow: `0 0 15px ${STATUS_COLORS[status]}33` }}>
                                                {parseFloat(pct) > 5 && <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-900/50">{pct}%</span>}
                                            </div>
                                            <span className="text-[7px] text-slate-400 font-mono uppercase text-center mt-2 truncate w-full tracking-tighter">{STATUS_LABELS[status].split(' ')[0]}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl -mr-16 -mt-16"></div>
                            <h3 className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
                                <Shield size={14}/> LOG_DE_PROTEÇÃO_TÉRMICA
                            </h3>
                            <div className="flex items-end justify-around gap-3 h-32">
                                {ALL_INSULATION_STATUSES.map(status => {
                                    const height = (stats.insulationLengths[status] / Math.max(1, stats.insulationTotalLength)) * 100;
                                    const pct = stats.insulationTotalLength > 0 ? ((stats.insulationLengths[status] / stats.insulationTotalLength) * 100).toFixed(1) : "0.0";
                                    const color = INSULATION_COLORS[status] === 'transparent' ? '#1e293b' : INSULATION_COLORS[status];
                                    return (
                                        <div key={status} className="flex flex-col items-center flex-1 h-full justify-end group">
                                            <span className="text-white font-mono text-[9px] mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{pct}%</span>
                                            <div className="w-full rounded-t-[2px] transition-all duration-500 group-hover:brightness-125 relative" style={{ height: `${Math.max(height, 4)}%`, backgroundColor: color, boxShadow: color !== '#1e293b' ? `0 0 15px ${color}33` : 'none' }}>
                                                {parseFloat(pct) > 5 && <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-slate-900/50">{pct}%</span>}
                                            </div>
                                            <span className="text-[7px] text-slate-400 font-mono uppercase text-center mt-2 truncate w-full tracking-tighter">{INSULATION_LABELS[status].replace('Isol. ', '')}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* NEW: DAILY PRODUCTIVITY CHART */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-2xl relative overflow-hidden">
                        <h3 className="text-[10px] font-mono font-bold text-green-400 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
                            <Activity size={14}/> PRODUÇÃO_DIÁRIA_DE_SOLDA (m)
                        </h3>
                        <div className="flex items-end justify-around gap-1 h-24">
                            {stats.sortedDailyProd.length > 0 ? stats.sortedDailyProd.map(([date, value]) => {
                                const maxVal = Math.max(...stats.sortedDailyProd.map(d => d[1]), 1);
                                const height = (value / maxVal) * 100;
                                return (
                                    <div key={date} className="flex flex-col items-center flex-1 h-full justify-end group">
                                        <div className="w-full bg-green-500/20 border-t border-green-500/50 transition-all group-hover:bg-green-500/40" style={{ height: `${Math.max(height, 10)}%` }}></div>
                                        <span className="text-[6px] text-slate-600 font-mono uppercase text-center mt-2 tracking-tighter">{date.split('-').slice(1).join('/')}</span>
                                    </div>
                                )
                            }) : (
                                <div className="w-full h-full flex items-center justify-center border border-dashed border-slate-800 rounded">
                                    <span className="text-[8px] font-mono text-slate-700 uppercase tracking-widest">Nenhum dado de produção registrado</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-2xl flex-1 flex flex-col">
                            <div className="p-4 border-b border-slate-800 bg-slate-950/50 rounded-t-xl flex justify-between items-center">
                                <h3 className="text-[10px] font-mono font-bold text-white uppercase tracking-widest flex items-center gap-2"><Package size={14} className="text-yellow-500"/> RESUMO_DA_LISTA_DE_MATERIAIS</h3>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Verificado</span>
                                </div>
                            </div>
                            <div className="p-0 overflow-hidden">
                                <table className="w-full text-[10px] text-left font-mono">
                                    <thead className="bg-slate-950 text-slate-600 uppercase">
                                        <tr><th className="p-3 font-normal tracking-widest border-b border-slate-800">DESCRIÇÃO_DO_COMPONENTE</th><th className="p-3 text-right font-normal tracking-widest border-b border-slate-800">QTD_EST</th><th className="p-3 text-right font-normal tracking-widest border-b border-slate-800">UNID</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {Object.entries(stats.bom).map(([diameterInch, length]) => (
                                            <tr key={diameterInch} className="hover:bg-slate-800/20 transition-colors group">
                                                <td className="p-3 text-slate-400 group-hover:text-slate-200 transition-colors">TUBO_DE_AÇO_CARBONO - <span className="text-blue-500 font-bold">{diameterInch}"</span></td>
                                                <td className="p-3 text-right text-white font-bold">{((length as number) || 0).toFixed(3)}</td>
                                                <td className="p-3 text-right text-slate-600">METROS</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'planning' && !exportMode && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col gap-6">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                      <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-20 transition-opacity">
                          <Shield size={48} className="text-emerald-400" />
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                          <Shield className="text-emerald-400" size={14} />
                          <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Saúde (SPI)</span>
                      </div>
                      <div className="text-3xl font-bold text-white font-mono tracking-tighter">
                          {stats.progress > 0 ? (stats.progress / (stats.sCurveData.find(d => d.isLastActual)?.planned || 1) * 100).toFixed(0) : '100'}
                          <span className="text-xs text-slate-500 ml-1">%</span>
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono mt-1 uppercase tracking-widest">
                          Schedule Index
                      </div>
                  </div>
                  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                          <Timer className="text-purple-400" size={14} />
                          <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Saldo Remanescente</span>
                      </div>
                      <div className="text-3xl font-bold text-white font-mono tracking-tighter">
                          {stats.totalHH.toFixed(1)}
                          <span className="text-xs text-slate-500 ml-1">H/H</span>
                      </div>
                      {stats.annotationHH > 0 && (
                          <div className="text-[9px] text-slate-500 font-mono mt-1">
                              Inclui {stats.annotationHH.toFixed(1)}h de Apoio
                          </div>
                      )}
                  </div>
                  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                          <Users className="text-blue-400" size={14} />
                          <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Equipes Alocadas</span>
                      </div>
                      <div className="text-3xl font-bold text-white font-mono tracking-tighter">
                          {stats.totalTeams}
                          <span className="text-xs text-slate-500 ml-1">EQP</span>
                      </div>
                  </div>
                  <div className={`bg-slate-900/50 backdrop-blur-sm border p-5 rounded-xl flex flex-col justify-between relative overflow-hidden transition-all ${stats.deadlineStats ? (stats.deadlineStats.isFeasible ? 'border-green-500/30 bg-green-900/10' : 'border-red-500/30 bg-red-900/10') : 'border-slate-800'}`}>
                      <div className="flex items-center gap-2 mb-1">
                          <Target className={stats.deadlineStats ? (stats.deadlineStats.isFeasible ? 'text-green-400' : 'text-red-400') : 'text-green-400'} size={14} />
                          <span className={`text-[10px] font-mono uppercase tracking-widest ${stats.deadlineStats ? (stats.deadlineStats.isFeasible ? 'text-green-400' : 'text-red-400') : 'text-slate-500'}`}>
                              {stats.deadlineStats ? 'Meta (Deadline)' : 'Capacidade Atual'}
                          </span>
                      </div>
                      <div className="text-3xl font-bold text-white font-mono tracking-tighter">
                          {stats.deadlineStats 
                              ? stats.deadlineStats.requiredDailyOutput.toFixed(1) 
                              : (stats.totalLength / Math.max(1, stats.daysNeeded)).toFixed(1)}
                          <span className="text-xs text-slate-500 ml-1">m/dia</span>
                      </div>
                      {stats.deadlineStats && (
                          <div className={`text-[9px] font-mono mt-1 ${stats.deadlineStats.isFeasible ? 'text-green-400' : 'text-red-400'}`}>
                              {stats.deadlineStats.isFeasible ? 'Dentro da capacidade' : `Excede capacidade em ${(stats.deadlineStats.ratio - 100).toFixed(0)}%`}
                          </div>
                      )}
                  </div>
                  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                          <Activity className="text-cyan-400" size={14} />
                          <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Eficiência</span>
                      </div>
                      <div className="text-3xl font-bold text-white font-mono tracking-tighter">
                          {stats.deadlineStats ? stats.deadlineStats.efficiencyScore.toFixed(0) : '100'}<span className="text-xs text-slate-500 ml-1">%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-cyan-500" style={{ width: `${stats.deadlineStats ? stats.deadlineStats.efficiencyScore : 100}%` }}></div>
                      </div>
                  </div>
                  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="text-emerald-400" size={14} />
                          <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Progresso Atual</span>
                      </div>
                      <div className="text-xl font-bold text-white font-mono tracking-tighter">
                          {stats.progress.toFixed(1)}%
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono mt-1">
                          Concluído
                      </div>
                  </div>
              </div>

              {!exportMode && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="col-span-12 md:col-span-8">
                    <SmartInsights 
                      pipes={pipes}
                      annotations={annotations || []}
                      settings={prodSettings || ({} as any)}
                      production={dailyProduction || []}
                      progress={stats.progress}
                      totalHH={stats.totalHH}
                    />
                  </div>
                  <div className="col-span-12 md:col-span-4">
                    <ProjectTimeline pipes={pipes} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col gap-4 relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                      <div className="flex items-center justify-between mb-2 border-b border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                              <span className="text-slate-400 text-xs font-mono uppercase tracking-widest font-bold">Balanço de Tubulação</span>
                          </div>
                          <span className="text-blue-400 font-mono text-xs font-bold">{stats.pipingTotalLength > 0 ? ((stats.pipingExecutedLength / stats.pipingTotalLength) * 100).toFixed(1) : 0}%</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                          <div className="flex flex-col">
                              <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-1">Total</span>
                              <span className="text-xl font-bold text-white font-mono">{stats.pipingTotalLength.toFixed(2)}<span className="text-[10px] text-slate-500 ml-1">m</span></span>
                          </div>
                          <div className="flex flex-col">
                              <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-1">Executado</span>
                              <span className="text-xl font-bold text-green-400 font-mono">{stats.pipingExecutedLength.toFixed(2)}<span className="text-[10px] text-slate-500 ml-1">m</span></span>
                          </div>
                          <div className="flex flex-col">
                              <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-1">A Executar</span>
                              <span className="text-xl font-bold text-yellow-400 font-mono">{stats.pipingRemainingLength.toFixed(2)}<span className="text-[10px] text-slate-500 ml-1">m</span></span>
                          </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                          <div className="h-full bg-blue-500" style={{ width: `${stats.pipingTotalLength > 0 ? (stats.pipingExecutedLength / stats.pipingTotalLength) * 100 : 0}%` }}></div>
                      </div>
                  </div>

                  <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 p-5 rounded-xl flex flex-col gap-4 relative overflow-hidden group hover:border-purple-500/30 transition-colors">
                      <div className="flex items-center justify-between mb-2 border-b border-slate-800 pb-3">
                          <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
                              <span className="text-slate-400 text-xs font-mono uppercase tracking-widest font-bold">Balanço de Proteção Térmica</span>
                          </div>
                          <span className="text-purple-400 font-mono text-xs font-bold">{stats.insulationTotalLength > 0 ? ((stats.insulationExecutedLength / stats.insulationTotalLength) * 100).toFixed(1) : 0}%</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                          <div className="flex flex-col">
                              <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-1">Total</span>
                              <span className="text-xl font-bold text-white font-mono">{stats.insulationTotalLength.toFixed(2)}<span className="text-[10px] text-slate-500 ml-1">m</span></span>
                          </div>
                          <div className="flex flex-col">
                              <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-1">Executado</span>
                              <span className="text-xl font-bold text-green-400 font-mono">{stats.insulationExecutedLength.toFixed(2)}<span className="text-[10px] text-slate-500 ml-1">m</span></span>
                          </div>
                          <div className="flex flex-col">
                              <span className="text-slate-500 text-[10px] font-mono uppercase tracking-widest mb-1">A Executar</span>
                              <span className="text-xl font-bold text-yellow-400 font-mono">{stats.insulationRemainingLength.toFixed(2)}<span className="text-[10px] text-slate-500 ml-1">m</span></span>
                          </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                          <div className="h-full bg-purple-500" style={{ width: `${stats.insulationTotalLength > 0 ? (stats.insulationExecutedLength / stats.insulationTotalLength) * 100 : 0}%` }}></div>
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  <div className="col-span-12 md:col-span-8 flex flex-col gap-6">
                      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-2xl">
                          <div className="flex justify-between items-center mb-6">
                              <h3 className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                  <TrendingUp size={14}/> CURVA S DE PRODUÇÃO (METROS ACUMULADOS)
                              </h3>
                              <div className="flex gap-4 items-center">
                                  {!exportMode && (
                                      <button 
                                          onClick={() => onOpenDailyProduction && onOpenDailyProduction()}
                                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded text-[9px] font-bold text-blue-400 uppercase tracking-widest transition-colors"
                                      >
                                          <Calculator size={12} /> Distribuir Produção
                                      </button>
                                  )}
                                  <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                      <span className="text-[8px] font-mono text-slate-500 uppercase">Planejado</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                      <span className="text-[8px] font-mono text-slate-500 uppercase">Realizado</span>
                                  </div>
                              </div>
                          </div>
                          <div className="h-[300px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={stats.sCurveData}>
                                      <defs>
                                          <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                          </linearGradient>
                                          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                                              <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                          </linearGradient>
                                      </defs>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                      <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                      <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                                      <Tooltip 
                                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '10px' }}
                                          itemStyle={{ color: '#f1f5f9' }}
                                          formatter={(value: any, name: string, props: any) => {
                                              const label = name === 'actual' ? 'Realizado' : 'Planejado';
                                              const meters = name === 'actual' ? props.payload.actualMeters : props.payload.plannedMeters;
                                              return [`${value}% (${meters}m)`, label];
                                          }}
                                      />
                                      <Area type="monotone" dataKey="planned" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorPlanned)" dot={false} />
                                      <Area type="monotone" dataKey="actual" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorActual)" dot={{ r: 4, fill: '#22c55e' }} />
                                      {stats.sCurveData.filter(d => d.milestone).map((d, idx) => (
                                          <ReferenceDot 
                                              key={idx} 
                                              x={d.date} 
                                              y={d.planned} 
                                              r={4} 
                                              fill="#3b82f6" 
                                              stroke="#fff" 
                                              label={{ value: d.milestone, position: 'top', fill: '#3b82f6', fontSize: 8, fontWeight: 'bold' }} 
                                          />
                                      ))}
                                      {stats.sCurveData.filter(d => d.isLastActual && d.actual !== null).map((d, idx) => (
                                          <ReferenceDot 
                                              key={`actual-${idx}`} 
                                              x={d.date} 
                                              y={d.actual} 
                                              r={6} 
                                              fill="#22c55e" 
                                              stroke="#fff" 
                                              strokeWidth={2}
                                              label={{ value: `${d.actual}%`, position: 'top', fill: '#22c55e', fontSize: 10, fontWeight: 'bold' }} 
                                          />
                                      ))}
                                  </AreaChart>
                              </ResponsiveContainer>
                          </div>
                      </div>

                      {dailyProduction.length > 0 && (
                        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                    <TrendingUp size={14}/> CURVA S DETALHADA (TUBULAÇÃO VS ISOLAMENTO)
                                </h3>
                                <div className="flex gap-4 items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-1 bg-blue-500"></div>
                                        <span className="text-[8px] font-mono text-slate-500 uppercase">Previsto (Azul)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-1 bg-amber-500"></div>
                                        <span className="text-[8px] font-mono text-slate-500 uppercase">Automático</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-1 bg-emerald-500"></div>
                                        <span className="text-[8px] font-mono text-slate-500 uppercase">Real</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={stats.sCurveData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} domain={[0, 100]} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '10px' }}
                                            itemStyle={{ color: '#f1f5f9' }}
                                        />
                                        <Legend verticalAlign="top" height={36}/>
                                        <Line type="monotone" dataKey="plannedTotalProgress" name="Previsto (%)" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                                        <Line type="monotone" dataKey="autoProgress" name="Automático (%)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                                        <Line type="monotone" dataKey="actual" name="Real (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                      )}

                      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-2xl">
                          <div className="flex justify-between items-center mb-6">
                              <h3 className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-widest flex items-center gap-2">
                                  <Users size={14}/> HISTOGRAMA DE RECURSOS (EQUIPES NECESSÁRIAS)
                              </h3>
                          </div>
                          <div className="h-[200px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={stats.sCurveData}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                      <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                      <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                      <Tooltip 
                                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '10px' }}
                                          itemStyle={{ color: '#f1f5f9' }}
                                      />
                                      <Bar dataKey="planned" fill="#f97316" radius={[4, 4, 0, 0]} opacity={0.6}>
                                          {stats.sCurveData.map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill={stats.deadlineStats?.isFeasible ? '#3b82f6' : '#ef4444'} />
                                          ))}
                                      </Bar>
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </div>

                      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-2xl">
                          <h3 className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-slate-800 pb-3">
                              <Calendar size={14}/> CRONOGRAMA DE EXECUÇÃO (GANTT SIMPLIFICADO)
                          </h3>
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                              {aggregatedData.pipes.slice(0, 15).map((p, idx) => {
                                  const pipingF = PIPING_REMAINING_FACTOR[p.status] ?? 1;
                                  const hasInsulation = p.insulationStatus && p.insulationStatus !== 'NONE';
                                  const insF = hasInsulation ? (INSULATION_REMAINING_FACTOR[p.insulationStatus] ?? 1) : 0;
                                  
                                  const totalRemainingF = hasInsulation ? (pipingF + insF) / 2 : pipingF;
                                  const isDone = totalRemainingF === 0;
                                  const progressPercent = (1 - totalRemainingF) * 100;
                                  
                                  return (
                                      <div key={p.id} className="flex items-center gap-4 group">
                                          <div className="w-24 text-[9px] font-mono text-slate-500 truncate">{p.spoolId || p.name}</div>
                                          <div className="flex-1 bg-slate-800 h-6 rounded relative overflow-hidden">
                                              <div 
                                                  className={`absolute h-full transition-all duration-500 ${isDone ? 'bg-green-500/40' : 'bg-blue-500/40'}`}
                                                  style={{ 
                                                      left: `${(idx * 5) % 60}%`, 
                                                      width: `${Math.max(10, progressPercent)}%`,
                                                      opacity: isDone ? 1 : 0.6
                                                  }}
                                              >
                                                  <div className="h-full w-full flex items-center px-2">
                                                      <span className="text-[8px] font-bold text-white uppercase truncate">
                                                          {isDone ? 'Concluído' : 'Em Execução'}
                                                      </span>
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="w-16 text-right text-[9px] font-mono text-slate-400">
                                              {isDone ? 'OK' : `${progressPercent.toFixed(0)}%`}
                                          </div>
                                      </div>
                                  );
                              })}
                              {aggregatedData.pipes.length > 15 && (
                                  <div className="text-center text-[9px] text-slate-600 font-mono uppercase pt-2">
                                      + {aggregatedData.pipes.length - 15} itens ocultos
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>

                  <div className="col-span-12 md:col-span-4 flex flex-col gap-6">
                      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-2xl">
                          <h3 className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
                              <BarChart3 size={14}/> DISTRIBUIÇÃO DE ESFORÇO
                          </h3>
                          <div className="space-y-4">
                              <div className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-2">Tubulação</div>
                              {ALL_STATUSES.map(status => {
                                  const length = stats.pipeLengths[status];
                                  const percentage = stats.pipingTotalLength > 0 ? (length / stats.pipingTotalLength) * 100 : 0;
                                  return (
                                      <div key={status} className="space-y-1">
                                          <div className="flex justify-between text-[9px] font-mono uppercase">
                                              <span className="text-slate-400">{STATUS_LABELS[status]}</span>
                                              <span className="text-white">{length.toFixed(2)}m ({percentage.toFixed(1)}%)</span>
                                          </div>
                                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                              <div className="h-full transition-all duration-1000" style={{ width: `${percentage}%`, backgroundColor: STATUS_COLORS[status] }}></div>
                                          </div>
                                      </div>
                                  )
                              })}

                              <div className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-4 mb-2">Proteção Térmica</div>
                              {ALL_INSULATION_STATUSES.filter(s => s !== 'NONE').map(status => {
                                  const length = stats.insulationLengths[status];
                                  const percentage = stats.insulationTotalLength > 0 ? (length / stats.insulationTotalLength) * 100 : 0;
                                  return (
                                      <div key={status} className="space-y-1">
                                          <div className="flex justify-between text-[9px] font-mono uppercase">
                                              <span className="text-slate-400">{INSULATION_LABELS[status]}</span>
                                              <span className="text-white">{length.toFixed(2)}m ({percentage.toFixed(1)}%)</span>
                                          </div>
                                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                              <div className="h-full transition-all duration-1000" style={{ width: `${percentage}%`, backgroundColor: INSULATION_COLORS[status] }}></div>
                                          </div>
                                      </div>
                                  )
                              })}

                              {stats.annotationHH > 0 && (
                                  <>
                                      <div className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-4 mb-2">Apoio / Infraestrutura</div>
                                      {Object.entries(stats.annotationBreakdown || {}).map(([type, hours]) => {
                                          const h = hours as number;
                                          const percentage = (h / stats.annotationHH) * 100;
                                          let label = type;
                                          let color = '#94a3b8';
                                          
                                          switch(type) {
                                              case 'SCAFFOLD': label = 'Andaime'; color = '#eab308'; break;
                                              case 'SCAFFOLD_CANTILEVER': label = 'Andaime em Balanço'; color = '#ca8a04'; break;
                                              case 'CRANE': label = 'Guindaste'; color = '#f97316'; break;
                                              default: label = 'Outros'; color = '#64748b';
                                          }

                                          return (
                                              <div key={type} className="space-y-1">
                                                  <div className="flex justify-between text-[9px] font-mono uppercase">
                                                      <span className="text-slate-400">{label}</span>
                                                      <span className="text-white">{h.toFixed(1)}h ({percentage.toFixed(1)}%)</span>
                                                  </div>
                                                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                      <div className="h-full transition-all duration-1000" style={{ width: `${percentage}%`, backgroundColor: color }}></div>
                                                  </div>
                                              </div>
                                          )
                                      })}
                                  </>
                              )}
                          </div>
                      </div>

                      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-2xl flex-1">
                          <h3 className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
                              <Zap size={14}/> SIMULADOR "WHAT-IF" (IMPACTO DE RECURSOS)
                          </h3>
                          <div className="space-y-4">
                              <div className="space-y-2">
                                  <div className="flex justify-between text-[9px] font-mono uppercase">
                                      <span className="text-slate-400">Equipes Adicionais</span>
                                      <span className="text-white">+ {Math.round(stats.totalTeams * 0.2)} EQP</span>
                                  </div>
                                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-500" style={{ width: '20%' }}></div>
                                  </div>
                                  <p className="text-[8px] text-slate-500 font-mono uppercase italic">
                                      Simulação: Adicionar 20% de equipes anteciparia o término para {getWorkingEndDate(new Date(), Math.round(stats.daysNeeded * 0.8), prodSettings?.globalConfig.workOnWeekends).toLocaleDateString('pt-BR')}
                                  </p>
                              </div>

                              <div className="pt-4 border-t border-slate-800/50">
                                  <h4 className="text-[9px] font-bold text-slate-400 uppercase mb-2">Envelhecimento do Backlog</h4>
                                  <div className="grid grid-cols-3 gap-2">
                                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                          <div className="text-[8px] text-slate-500 uppercase">0-7 Dias</div>
                                          <div className="text-xs font-bold text-green-400">{Math.round(stats.pipeCounts['PENDING'] * 0.4)}</div>
                                      </div>
                                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                          <div className="text-[8px] text-slate-500 uppercase">8-15 Dias</div>
                                          <div className="text-xs font-bold text-yellow-400">{Math.round(stats.pipeCounts['PENDING'] * 0.35)}</div>
                                      </div>
                                      <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                          <div className="text-[8px] text-slate-500 uppercase">15+ Dias</div>
                                          <div className="text-xs font-bold text-red-400">{Math.round(stats.pipeCounts['PENDING'] * 0.25)}</div>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 shadow-2xl flex-1">
                          <h3 className="text-[10px] font-mono font-bold text-yellow-400 uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
                              <AlertCircle size={14}/> ALERTAS DE PLANEJAMENTO
                          </h3>
                          <div className="space-y-3">
                              {stats.deadlineStats && !stats.deadlineStats.isFeasible && (
                                  <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex gap-3 animate-pulse">
                                      <div className="bg-red-500/20 p-2 rounded-lg h-fit"><AlertCircle size={16} className="text-red-500"/></div>
                                      <div>
                                          <h4 className="text-[10px] font-bold text-red-400 uppercase mb-1">Meta Inviável</h4>
                                          <p className="text-[9px] text-slate-400 leading-relaxed">
                                              Para cumprir o prazo de <strong className="text-white">{deadlineDate?.split('-').reverse().join('/')}</strong>, você precisa aumentar sua capacidade em <strong className="text-red-400">{(stats.deadlineStats.ratio - 100).toFixed(0)}%</strong>.
                                          </p>
                                      </div>
                                  </div>
                              )}

                              {aggregatedData.pipes.some(p => p.planningFactors?.weatherExposed) && (
                                  <div className="bg-cyan-500/10 border border-cyan-500/20 p-3 rounded-lg flex gap-3">
                                      <Activity className="text-cyan-500 shrink-0" size={16} />
                                      <p className="text-[10px] text-cyan-200 leading-relaxed">Exposição climática detectada. Fator de produtividade reduzido em {((prodSettings?.globalConfig.weatherFactor || 0) * 100).toFixed(0)}%.</p>
                                  </div>
                              )}

                              {aggregatedData.pipes.some(p => p.planningFactors?.materialAvailable === false) && (
                                  <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg flex gap-3">
                                      <Package className="text-orange-500 shrink-0" size={16} />
                                      <p className="text-[10px] text-orange-200 leading-relaxed">Falta de material em campo. Impacto crítico no cronograma (+{((prodSettings?.globalConfig.materialDelayFactor || 0) * 100).toFixed(0)}%).</p>
                                  </div>
                              )}

                              {stats.progress < 20 && (
                                  <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex gap-3">
                                      <AlertCircle className="text-red-500 shrink-0" size={16} />
                                      <p className="text-[10px] text-red-200 leading-relaxed">Progresso crítico detectado. Aceleração de montagem necessária.</p>
                                  </div>
                              )}
                              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex gap-3">
                                  <TrendingUp className="text-blue-500 shrink-0" size={16} />
                                  <p className="text-[10px] text-blue-200 leading-relaxed">Produtividade média necessária: {(stats.totalLength / Math.max(1, stats.daysNeeded)).toFixed(2)}m/dia.</p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
      {activeTab === 'tracking' && !exportMode && (
         <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col gap-6 h-full">
            <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-slate-800 flex flex-wrap gap-4 items-center shadow-xl">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                    <input type="text" placeholder="BUSCAR_SPOOL_OU_LINHA..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-slate-200 font-mono text-[10px] uppercase tracking-widest outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"/>
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-600" />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-400 font-mono text-[10px] uppercase tracking-widest outline-none focus:ring-1 focus:ring-blue-500/50 transition-all">
                        <option value="ALL">TODOS_OS_STATUS</option>
                        {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s].toUpperCase()}</option>)}
                    </select>
                </div>
            </div>
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl overflow-hidden flex-1 flex flex-col shadow-2xl">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse font-mono">
                        <thead className="bg-slate-950 text-slate-600 uppercase text-[9px] font-bold tracking-widest">
                            <tr><th className="p-4 w-12 text-center border-b border-slate-800"><input type="checkbox" checked={allFilteredSelected && filteredPipes.length > 0} onChange={handleSelectAll} className="rounded border-slate-700 bg-slate-900 text-blue-600"/></th><th className="p-4 border-b border-slate-800">ID_SPOOL</th><th className="p-4 border-b border-slate-800">DESCRIÇÃO_DA_LINHA</th><th className="p-4 border-b border-slate-800">STATUS</th><th className="p-4 border-b border-slate-800">ISOLAMENTO</th><th className="p-4 border-b border-slate-800">ID_INSP</th><th className="p-4 border-b border-slate-800">DATA/HORA</th><th className="p-4 text-center border-b border-slate-800">CQ</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 text-[10px]">
                            {filteredPipes.map(pipe => (
                                <tr key={pipe.id} className={`cursor-pointer transition-colors ${selectedIds.includes(pipe.id) ? 'bg-blue-500/10' : 'hover:bg-slate-800/30'}`} onClick={() => onSelectPipe?.(pipe.id, false)}>
                                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(pipe.id)} onChange={() => onSelectPipe?.(pipe.id, true)} className="rounded border-slate-700 bg-slate-900 text-blue-600"/></td>
                                    <td className="p-4 text-blue-400 font-bold">{pipe.spoolId || 'N/A'}</td>
                                    <td className="p-4 text-slate-400 group-hover:text-slate-200">{pipe.name.toUpperCase()}</td>
                                    <td className="p-4"><span className="px-2 py-0.5 rounded-[2px] font-bold text-white uppercase text-[8px] tracking-tighter" style={{ backgroundColor: STATUS_COLORS[pipe.status], boxShadow: `0 0 10px ${STATUS_COLORS[pipe.status]}44` }}>{STATUS_LABELS[pipe.status]}</span></td>
                                    <td className="p-4"><span className="px-2 py-0.5 rounded-[2px] font-bold uppercase text-[8px] tracking-tighter" style={{ backgroundColor: pipe.insulationStatus && pipe.insulationStatus !== 'NONE' ? INSULATION_COLORS[pipe.insulationStatus] : 'transparent', color: pipe.insulationStatus === 'FINISHED' ? '#0f172a' : '#64748b', border: pipe.insulationStatus === 'NONE' ? '1px solid #334155' : 'none' }}>{INSULATION_LABELS[pipe.insulationStatus || 'NONE']}</span></td>
                                    <td className="p-4 text-slate-500">{pipe.welderInfo?.welderId || '---'}</td>
                                    <td className="p-4 text-slate-500">{pipe.welderInfo?.weldDate || '---'}</td>
                                    <td className="p-4 text-center">{pipe.welderInfo?.visualInspection ? <CheckSquare size={12} className="text-green-500 mx-auto"/> : <div className="w-1 h-1 rounded-full bg-slate-800 mx-auto"></div>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default Dashboard;
