import React, { useState, useEffect, useMemo } from 'react';
import { X, Calculator, Calendar as CalendarIcon, Save, Trash2, Clock, Users, ChevronLeft, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { DailyProduction, PipeSegment, ProjectCalendar, CalendarException, ProductivitySettings, Annotation } from '../types';
import { PIPING_REMAINING_FACTOR, INSULATION_REMAINING_FACTOR } from '../constants';
import { calculatePipeHH, calculateTotalHH } from '../utils/planning';

interface DailyProductionModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPipes: PipeSegment[];
    dailyProduction: DailyProduction[];
    projectCalendar: ProjectCalendar | null;
    prodSettings: ProductivitySettings;
    annotations: Annotation[];
    onSave: (production: DailyProduction[], calendar: ProjectCalendar) => void;
    projectStartDate: string;
    projectEndDate: string;
}

const DAYS_OF_WEEK = [
    { value: '1', label: 'Seg' },
    { value: '2', label: 'Ter' },
    { value: '3', label: 'Qua' },
    { value: '4', label: 'Qui' },
    { value: '5', label: 'Sex' },
    { value: '6', label: 'Sáb' },
    { value: '0', label: 'Dom' },
];

const DailyProductionModal: React.FC<DailyProductionModalProps> = ({ 
    isOpen, 
    onClose, 
    currentPipes, 
    dailyProduction, 
    projectCalendar,
    prodSettings,
    annotations,
    onSave, 
    projectStartDate,
    projectEndDate
}) => {
    const [activeTab, setActiveTab] = useState<'SHIFT' | 'EXCEPTIONS' | 'PREVIEW'>('SHIFT');
    
    // Calendar State
    const [calendar, setCalendar] = useState<ProjectCalendar>(() => {
        if (projectCalendar) return projectCalendar;
        return {
            startDate: projectStartDate || new Date().toISOString().split('T')[0],
            endDate: projectEndDate || new Date().toISOString().split('T')[0],
            startTime: '07:00',
            endTime: '17:48',
            workDays: ['1', '2', '3', '4', '5'],
            teamCount: 1,
            exceptions: []
        };
    });

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [editedProduction, setEditedProduction] = useState<DailyProduction[]>([]);

    useEffect(() => {
        if (isOpen) {
            setEditedProduction(dailyProduction || []);
            if (projectCalendar) {
                setCalendar(projectCalendar);
            }
        }
    }, [isOpen, dailyProduction, projectCalendar]);

    // Helper to calculate net hours per day
    const netHoursPerDay = useMemo(() => {
        const [startH, startM] = calendar.startTime.split(':').map(Number);
        const [endH, endM] = calendar.endTime.split(':').map(Number);
        const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        // Assuming 1 hour lunch break if shift is > 5 hours
        const lunchBreak = totalMinutes > 300 ? 60 : 0;
        return Math.max(0, (totalMinutes - lunchBreak) / 60);
    }, [calendar.startTime, calendar.endTime]);

    const workedDaysList = useMemo(() => {
        const days: string[] = [];
        let curr = new Date(calendar.startDate + 'T12:00:00');
        const end = new Date(calendar.endDate + 'T12:00:00');
        
        while (curr <= end) {
            const dateStr = curr.toISOString().split('T')[0];
            const dow = curr.getDay().toString();
            const exception = calendar.exceptions.find(e => e.date === dateStr);
            
            let isWorkDay = false;
            if (exception) {
                isWorkDay = exception.type === 'WORK';
            } else {
                isWorkDay = calendar.workDays.includes(dow);
            }
            
            if (isWorkDay) days.push(dateStr);
            curr.setDate(curr.getDate() + 1);
        }
        return days;
    }, [calendar]);

    const handleCalculate = () => {
        if (workedDaysList.length === 0) {
            alert("Nenhum dia de trabalho selecionado no período.");
            return;
        }

        // Paso A: Calcular esforço total (HH) REMANESCENTE
        // Usamos o calculateTotalHH que já considera o que falta fazer
        const totalStats = calculateTotalHH(currentPipes, annotations, prodSettings);
        let totalPipingHH = totalStats.totalPipingHH;
        let totalInsulationHH = totalStats.totalInsulationHH;

        // Paso B: Capacidade Diária
        const maxDailyCapacityHH = calendar.teamCount * netHoursPerDay;
        
        // Calcular a capacidade necessária para distribuir uniformemente pelo período
        const totalNeededHH = totalPipingHH + totalInsulationHH;
        const requiredDailyHH = workedDaysList.length > 0 ? totalNeededHH / workedDaysList.length : 0;
        
        // Usamos o menor entre a capacidade máxima e a necessária para espalhar
        // Se a necessária for maior que a máxima, usamos a máxima (vai terminar o quanto antes, mas dentro do limite físico)
        // Se a necessária for menor que a máxima, usamos a necessária para ocupar todo o tempo (reorganizar)
        const dailyCapacityHH = (requiredDailyHH > 0 && requiredDailyHH < maxDailyCapacityHH) 
            ? requiredDailyHH 
            : maxDailyCapacityHH;
        
        // Paso C: Distribuir
        // Lógica: Primeiro Piping, depois Insulation.
        
        let remainingPipingHH = totalPipingHH;
        let remainingInsulationHH = totalInsulationHH;
        
        const newData: DailyProduction[] = workedDaysList.map(date => {
            let dayPipingHH = Math.min(remainingPipingHH, dailyCapacityHH);
            remainingPipingHH -= dayPipingHH;
            
            let dayInsulationHH = 0;
            let remainingCapacity = dailyCapacityHH - dayPipingHH;
            
            if (remainingCapacity > 0 && remainingPipingHH <= 0) {
                dayInsulationHH = Math.min(remainingInsulationHH, remainingCapacity);
                remainingInsulationHH -= dayInsulationHH;
            }
            
            // Converter HH de volta para metros proporcionais (do que falta fazer)
            const totalPipeMeters = currentPipes.reduce((acc, p) => acc + (p.length * (PIPING_REMAINING_FACTOR[p.status] ?? 1)), 0);
            const totalInsMeters = currentPipes.reduce((acc, p) => acc + (p.length * (INSULATION_REMAINING_FACTOR[p.insulationStatus || 'NONE'] ?? 1)), 0);
            
            const pipeMeters = totalPipingHH > 0 ? (dayPipingHH / totalPipingHH) * totalPipeMeters : 0;
            const insulationMeters = totalInsulationHH > 0 ? (dayInsulationHH / totalInsulationHH) * totalInsMeters : 0;

            return {
                date,
                pipeMeters: parseFloat(((pipeMeters || 0).toFixed(2))),
                insulationMeters: parseFloat(((insulationMeters || 0).toFixed(2)))
            };
        });

        setEditedProduction(newData);
        setActiveTab('PREVIEW');
    };

    const toggleException = (dateStr: string) => {
        const existing = calendar.exceptions.find(e => e.date === dateStr);
        const dow = new Date(dateStr + 'T12:00:00').getDay().toString();
        const isDefaultWorkDay = calendar.workDays.includes(dow);

        let newExceptions = [...calendar.exceptions];
        if (existing) {
            newExceptions = newExceptions.filter(e => e.date !== dateStr);
        } else {
            newExceptions.push({
                date: dateStr,
                type: isDefaultWorkDay ? 'NON_WORK' : 'WORK'
            });
        }
        setCalendar({ ...calendar, exceptions: newExceptions });
    };

    const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

        return (
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <button onClick={() => setCurrentMonth(new Date(year, month - 1))} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <h3 className="font-bold text-white uppercase tracking-widest text-sm">
                        {currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button onClick={() => setCurrentMonth(new Date(year, month + 1))} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                        <div key={i} className="text-center text-[10px] font-bold text-slate-500 py-2">{d}</div>
                    ))}
                    {days.map((date, i) => {
                        if (!date) return <div key={i} />;
                        const dateStr = date.toISOString().split('T')[0];
                        const dow = date.getDay().toString();
                        const isDefaultWorkDay = calendar.workDays.includes(dow);
                        const exception = calendar.exceptions.find(e => e.date === dateStr);
                        
                        let status: 'WORK' | 'NON_WORK' | 'HOLIDAY' = isDefaultWorkDay ? 'WORK' : 'NON_WORK';
                        if (exception) status = exception.type;

                        const isToday = new Date().toISOString().split('T')[0] === dateStr;
                        const isInRange = dateStr >= calendar.startDate && dateStr <= calendar.endDate;

                        return (
                            <button
                                key={i}
                                onClick={() => toggleException(dateStr)}
                                className={`
                                    aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-mono transition-all border
                                    ${status === 'WORK' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' : 
                                      status === 'NON_WORK' ? 'bg-slate-800/50 border-slate-700 text-slate-500 hover:bg-slate-800' : 
                                      'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'}
                                    ${isToday ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900' : ''}
                                    ${!isInRange ? 'opacity-30 grayscale' : ''}
                                `}
                            >
                                <span>{date.getDate()}</span>
                                {exception && <div className="w-1 h-1 rounded-full bg-current mt-1" />}
                            </button>
                        );
                    })}
                </div>
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest mt-2">
                    <div className="flex items-center gap-2 text-emerald-400"><div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" /> Trabalhado</div>
                    <div className="flex items-center gap-2 text-slate-500"><div className="w-3 h-3 rounded bg-slate-800 border border-slate-700" /> Folga</div>
                    <div className="flex items-center gap-2 text-red-400"><div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" /> Feriado/Parada</div>
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                            <Calculator className="text-blue-400" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white uppercase tracking-widest">Cálculo de Montagem Diária</h2>
                            <p className="text-slate-400 text-xs font-mono">Distribuição automática baseada em HH</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-800 bg-slate-950/50 px-6">
                    <button 
                        onClick={() => setActiveTab('SHIFT')}
                        className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'SHIFT' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        1. Configuração do Turno
                    </button>
                    <button 
                        onClick={() => setActiveTab('EXCEPTIONS')}
                        className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'EXCEPTIONS' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        2. Exceções no Calendário
                    </button>
                    <button 
                        onClick={() => setActiveTab('PREVIEW')}
                        className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'PREVIEW' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        3. Visualizar Distribuição
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
                    {activeTab === 'SHIFT' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <CalendarIcon size={12} /> Data Inicial
                                        </label>
                                        <input 
                                            type="date" 
                                            value={calendar.startDate} 
                                            onChange={(e) => setCalendar({ ...calendar, startDate: e.target.value })}
                                            className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-300 font-mono text-sm outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <CalendarIcon size={12} /> Data Final
                                        </label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="date" 
                                                value={calendar.endDate} 
                                                onChange={(e) => setCalendar({ ...calendar, endDate: e.target.value })}
                                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-300 font-mono text-sm outline-none focus:border-blue-500 transition-colors"
                                            />
                                            <button 
                                                onClick={() => setCalendar({ ...calendar, endDate: new Date().toISOString().split('T')[0] })}
                                                className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-[10px] font-bold uppercase transition-colors"
                                            >
                                                Hoje
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Clock size={12} /> Início Turno
                                        </label>
                                        <input 
                                            type="time" 
                                            value={calendar.startTime} 
                                            onChange={(e) => setCalendar({ ...calendar, startTime: e.target.value })}
                                            className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-300 font-mono text-sm outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Clock size={12} /> Fim Turno
                                        </label>
                                        <input 
                                            type="time" 
                                            value={calendar.endTime} 
                                            onChange={(e) => setCalendar({ ...calendar, endTime: e.target.value })}
                                            className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-300 font-mono text-sm outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <Users size={12} /> Número de Equipes
                                    </label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        value={calendar.teamCount} 
                                        onChange={(e) => setCalendar({ ...calendar, teamCount: parseInt(e.target.value) || 1 })}
                                        className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-300 font-mono text-sm outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dias da Semana Trabalhados</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {DAYS_OF_WEEK.map(day => (
                                        <button
                                            key={day.value}
                                            onClick={() => {
                                                const newDays = calendar.workDays.includes(day.value)
                                                    ? calendar.workDays.filter(d => d !== day.value)
                                                    : [...calendar.workDays, day.value];
                                                setCalendar({ ...calendar, workDays: newDays });
                                            }}
                                            className={`
                                                flex items-center justify-between px-4 py-3 rounded-xl border transition-all
                                                ${calendar.workDays.includes(day.value) 
                                                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' 
                                                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}
                                            `}
                                        >
                                            <span className="text-xs font-bold uppercase tracking-widest">{day.label}</span>
                                            {calendar.workDays.includes(day.value) && <Check size={14} />}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                                    <div className="flex items-center gap-2 text-blue-400 mb-1">
                                        <Clock size={14} />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Resumo do Turno</span>
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        Horas líquidas por dia: <span className="text-white font-mono">{((netHoursPerDay || 0).toFixed(1))}h</span>
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        Capacidade total diária: <span className="text-white font-mono">{(((netHoursPerDay || 0) * (calendar.teamCount || 0)).toFixed(1))} HH</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'EXCEPTIONS' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex flex-col gap-4">
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Calendário de Exceções</h3>
                                <p className="text-xs text-slate-400">
                                    Clique nos dias para marcar feriados, paradas ou dias extras de trabalho.
                                </p>
                                {renderCalendar()}
                            </div>
                            <div className="flex flex-col gap-4">
                                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Lista de Exceções ({calendar.exceptions.length})</h3>
                                <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl overflow-y-auto max-h-[300px]">
                                    {calendar.exceptions.length === 0 ? (
                                        <div className="p-8 text-center text-slate-600 text-xs italic">Nenhuma exceção cadastrada</div>
                                    ) : (
                                        <div className="divide-y divide-slate-800">
                                            {calendar.exceptions.sort((a,b) => a.date.localeCompare(b.date)).map(ex => (
                                                <div key={ex.date} className="p-3 flex justify-between items-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-mono text-slate-300">{ex.date.split('-').reverse().join('/')}</span>
                                                        <span className={`text-[10px] font-bold uppercase ${ex.type === 'WORK' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                            {ex.type === 'WORK' ? 'Trabalho Extra' : 'Feriado/Parada'}
                                                        </span>
                                                    </div>
                                                    <button 
                                                        onClick={() => toggleException(ex.date)}
                                                        className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'PREVIEW' && (
                        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Dias Trabalhados</span>
                                    <span className="text-xl font-mono font-bold text-white">{workedDaysList.length} dias</span>
                                </div>
                                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Capacidade Total Período</span>
                                    <span className="text-xl font-mono font-bold text-blue-400">{((workedDaysList.length * (netHoursPerDay || 0) * (calendar.teamCount || 0)).toFixed(1))} HH</span>
                                </div>
                                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Esforço Pendente (Saldo)</span>
                                    <span className="text-xl font-mono font-bold text-emerald-400">
                                        {((calculateTotalHH(currentPipes, annotations, prodSettings).totalHH || 0).toFixed(1))} HH
                                    </span>
                                </div>
                            </div>

                            {editedProduction.length > 0 ? (
                                <div className="border border-slate-800 rounded-xl overflow-hidden">
                                    <table className="w-full text-left border-collapse font-mono">
                                        <thead className="bg-slate-950 text-slate-500 uppercase text-[10px] font-bold tracking-widest">
                                            <tr>
                                                <th className="p-3 border-b border-slate-800">Data</th>
                                                <th className="p-3 border-b border-slate-800">Tubulação (m)</th>
                                                <th className="p-3 border-b border-slate-800">Isolamento (m)</th>
                                                <th className="p-3 border-b border-slate-800">Avanço Diário</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50 text-sm">
                                            {editedProduction.map((data, idx) => (
                                                <tr key={data.date} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="p-3 text-slate-300">{data.date.split('-').reverse().join('/')}</td>
                                                    <td className="p-3 text-blue-400">{((data.pipeMeters || 0).toFixed(2))}m</td>
                                                    <td className="p-3 text-purple-400">{((data.insulationMeters || 0).toFixed(2))}m</td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                                <div 
                                                                    className="h-full bg-emerald-500" 
                                                                    style={{ width: `${Math.min(100, (data.pipeMeters + data.insulationMeters) * 5)}%` }} 
                                                                />
                                                            </div>
                                                            <span className="text-[10px] text-slate-500">{(((data.pipeMeters || 0) + (data.insulationMeters || 0)).toFixed(1))}m</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-12 bg-slate-950 border border-dashed border-slate-800 rounded-2xl gap-4">
                                    <AlertCircle className="text-slate-600" size={48} />
                                    <div className="text-center">
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum cálculo realizado</p>
                                        <p className="text-slate-600 text-[10px]">Configure o turno e clique em "Distribuir Automaticamente"</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-between items-center">
                    <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                        {activeTab === 'PREVIEW' ? `Total: ${editedProduction.length} dias de produção` : 'Preencha as configurações para calcular'}
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-6 py-2 rounded-lg font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors uppercase text-xs tracking-widest">
                            Cancelar
                        </button>
                        {activeTab !== 'PREVIEW' ? (
                            <button 
                                onClick={handleCalculate}
                                className="px-6 py-2 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-2 uppercase text-xs tracking-widest shadow-lg shadow-blue-900/20"
                            >
                                <Calculator size={16} /> Calcular Distribuição
                            </button>
                        ) : (
                            <button 
                                onClick={() => { onSave(editedProduction, calendar); onClose(); }}
                                className="px-6 py-2 rounded-lg font-bold text-white bg-green-600 hover:bg-green-500 transition-colors flex items-center gap-2 uppercase text-xs tracking-widest shadow-lg shadow-green-900/20"
                            >
                                <Save size={16} /> Salvar e Gerar Curva S
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyProductionModal;
