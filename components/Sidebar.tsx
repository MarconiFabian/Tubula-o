import React, { useState, useEffect } from 'react';
import { PipeSegment, PipeStatus, InsulationStatus } from '../types';
import { STATUS_LABELS, STATUS_COLORS, ALL_STATUSES, INSULATION_LABELS, INSULATION_COLORS, ALL_INSULATION_STATUSES, AVAILABLE_DIAMETERS, PIPE_DIAMETERS } from '../constants';
import { X, CheckCircle, AlertCircle, FileText, Ruler, MessageSquare, Trash2, Shield, Wrench, Layers, MapPin, Hash, CircleDashed } from 'lucide-react';

interface SidebarProps {
  selectedPipes: PipeSegment[]; // Array of selected pipes
  onUpdateSingle: (updatedPipe: PipeSegment) => void;
  onUpdateBatch: (updates: Partial<PipeSegment>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedPipes, onUpdateSingle, onUpdateBatch, onDelete, onClose }) => {
  const [formData, setFormData] = useState<PipeSegment | null>(null);

  // Determine mode
  const isBatch = selectedPipes.length > 1;
  const singlePipe = selectedPipes.length === 1 ? selectedPipes[0] : null;

  useEffect(() => {
    if (singlePipe) {
        setFormData(JSON.parse(JSON.stringify(singlePipe))); 
    } else {
        setFormData(null);
    }
  }, [singlePipe]);

  // SINGLE MODE HANDLERS
  const handleSingleChange = (field: keyof PipeSegment, value: any) => {
    if (!formData) return;
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdateSingle(updated);
  };

  const handleWelderChange = (field: string, value: any) => {
    if (!formData) return;
    const baseWelderInfo = formData.welderInfo ? { ...formData.welderInfo } : {
        weldDate: new Date().toISOString().split('T')[0],
        electrodeBatch: '',
        visualInspection: false,
        welderId: ''
    };
    const updated = { 
      ...formData, 
      welderInfo: { ...baseWelderInfo, [field]: value } 
    };
    setFormData(updated);
    onUpdateSingle(updated);
  };

  // Helper para encontrar label do diametro pelo valor
  const getDiameterLabel = (val: number) => {
    const entry = Object.entries(PIPE_DIAMETERS).find(([_, v]) => Math.abs(v - val) < 0.001);
    return entry ? entry[0] : 'Custom';
  };

  // --- RENDER BATCH MODE ---
  if (isBatch) {
      return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-xl overflow-y-auto w-full md:w-96 absolute right-0 top-0 z-20 transition-transform">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-blue-50 dark:bg-slate-900">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Layers size={18} className="text-blue-600" />
                Edição em Lote
                </h2>
                <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500">
                <X size={20} />
                </button>
            </div>

            <div className="p-6 space-y-8 flex-1">
                <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 p-4 rounded-lg flex items-center gap-3">
                    <CheckCircle size={24} />
                    <div>
                        <p className="font-bold text-lg">{selectedPipes.length} Tubos Selecionados</p>
                        <p className="text-sm opacity-80">As alterações abaixo serão aplicadas a todos os itens.</p>
                    </div>
                </div>

                {/* Batch Diameter */}
                <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <CircleDashed size={12} /> Definir Diâmetro (Bitola)
                     </label>
                     <select 
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => {
                            if (e.target.value) {
                                onUpdateBatch({ diameter: parseFloat(e.target.value) });
                            }
                        }}
                        defaultValue=""
                     >
                        <option value="" disabled>Selecione para alterar todos...</option>
                        {AVAILABLE_DIAMETERS.map(label => (
                            <option key={label} value={PIPE_DIAMETERS[label]}>{label}</option>
                        ))}
                     </select>
                </div>

                {/* Batch Spool */}
                <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Hash size={12} /> Spool ID (Fabricação)
                     </label>
                     <input
                        type="text"
                        onChange={(e) => onUpdateBatch({ spoolId: e.target.value })}
                        placeholder="Ex: SP-01-A (Define grupo)"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Batch Location */}
                <div>
                     <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <MapPin size={12} /> Local da Atividade (Todos)
                     </label>
                     <input
                        type="text"
                        onChange={(e) => onUpdateBatch({ location: e.target.value })}
                        placeholder="Ex: Galpão A, Setor 2..."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Batch Status */}
                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Definir Status (Todos)</label>
                    <div className="grid grid-cols-2 gap-2">
                        {ALL_STATUSES.map((statusKey) => (
                            <button
                                key={statusKey}
                                onClick={() => onUpdateBatch({ status: statusKey as PipeStatus })}
                                className="p-2 rounded text-xs font-bold transition-all border border-slate-200 hover:scale-105 active:scale-95 shadow-sm"
                                style={{
                                    backgroundColor: STATUS_COLORS[statusKey] || '#ccc',
                                    color: '#fff',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                                }}
                            >
                                {STATUS_LABELS[statusKey]}
                            </button>
                        ))}
                    </div>
                </div>

                 {/* Batch Note */}
                 <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <MessageSquare size={12} /> Adicionar Observação (Todos)
                    </label>
                    <textarea
                        onChange={(e) => onUpdateBatch({ generalInfo: e.target.value })}
                        placeholder="Escrever aqui substituirá a observação de TODOS os selecionados..."
                        className="w-full h-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <button 
                    onClick={onDelete}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded bg-red-600 hover:bg-red-700 text-white shadow-red-500/20 shadow-lg transition-all font-bold"
                >
                    <Trash2 size={18} /> Excluir {selectedPipes.length} Itens
                </button>
            </div>
        </div>
      )
  }

  // --- SINGLE PIPE RENDER ---
  if (!formData) return null;

  const isWeldedOrLater = ['WELDED', 'HYDROTEST'].includes(formData.status || '');

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-xl overflow-y-auto w-full md:w-96 absolute right-0 top-0 z-20 transition-transform">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <FileText size={18} />
          {formData.name || 'Sem Nome'}
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500">
          <X size={20} />
        </button>
      </div>

      <div className="p-6 space-y-6 flex-1">
        
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ID da Linha</label>
            <div className="text-slate-900 dark:text-white font-mono">{formData.id}</div>
          </div>

          {/* SPOOL ID */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Hash size={12} /> Spool ID (Fabricação)
            </label>
            <input
                type="text"
                value={formData.spoolId || ''}
                onChange={(e) => handleSingleChange('spoolId', e.target.value)}
                placeholder="Ex: SP-01-A"
                className="w-full bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-600 rounded p-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-[10px] text-slate-500 mt-1">Define o agrupamento para fabricação.</p>
          </div>
          
          {/* Location Input */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <MapPin size={12} /> Local da Atividade
            </label>
            <input
                type="text"
                value={formData.location || ''}
                onChange={(e) => handleSingleChange('location', e.target.value)}
                placeholder="Ex: Pipe Rack Norte"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <Ruler size={12} /> Comprimento (m)
                </label>
                <div className="text-slate-900 dark:text-white font-mono text-lg font-bold">
                  {(formData.length || 0).toFixed(3)} m
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                  <CircleDashed size={12} /> Bitola
                </label>
                 <select 
                        className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-sm text-slate-900 dark:text-white outline-none font-bold"
                        value={getDiameterLabel(formData.diameter)}
                        onChange={(e) => handleSingleChange('diameter', PIPE_DIAMETERS[e.target.value])}
                     >
                        {AVAILABLE_DIAMETERS.map(label => (
                            <option key={label} value={label}>{label}</option>
                        ))}
                 </select>
              </div>
          </div>
        </div>

        {/* General Info / Observations */}
        <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <MessageSquare size={12} /> Observações / Informações Gerais
            </label>
            <textarea
                value={formData.generalInfo || ''}
                onChange={(e) => handleSingleChange('generalInfo', e.target.value)}
                placeholder="Ex: Área de difícil acesso, prioridade alta..."
                className="w-full h-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
        </div>

        {/* Status Control */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Status Tubulação</label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_STATUSES.map((statusKey) => {
              return (
              <button
                key={statusKey}
                onClick={() => handleSingleChange('status', statusKey)}
                className={`
                  p-2 rounded text-xs font-bold transition-all border
                  ${formData.status === statusKey 
                    ? 'ring-2 ring-offset-1 ring-offset-slate-800' 
                    : 'opacity-50 hover:opacity-100'}
                `}
                style={{
                  backgroundColor: formData.status === statusKey ? (STATUS_COLORS[statusKey] || '#ccc') : 'transparent',
                  borderColor: STATUS_COLORS[statusKey] || '#ccc',
                  color: formData.status === statusKey ? '#fff' : (STATUS_COLORS[statusKey] || '#ccc')
                }}
              >
                {STATUS_LABELS[statusKey] || statusKey}
              </button>
            )})}
          </div>
        </div>

        {/* Thermal Protection Status */}
        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
                <Shield size={16} className="text-slate-500" />
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Proteção Térmica</label>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
                {ALL_INSULATION_STATUSES.map((insKey) => {
                    const isActive = (formData.insulationStatus || 'NONE') === insKey;
                    const color = INSULATION_COLORS[insKey];
                    const isNone = insKey === 'NONE';

                    return (
                        <button
                            key={insKey}
                            onClick={() => handleSingleChange('insulationStatus', insKey)}
                            className={`
                                flex items-center gap-3 px-3 py-2 rounded-md text-sm font-bold transition-all border
                                ${isActive 
                                    ? 'bg-white dark:bg-slate-800 shadow-sm border-slate-300 dark:border-slate-500' 
                                    : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}
                            `}
                        >
                            <div 
                                className={`w-3 h-3 rounded-full border border-black/10`}
                                style={{ backgroundColor: isNone ? 'transparent' : color, border: isNone ? '1px solid #94a3b8' : 'none' }} 
                            />
                            <span className={`${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                                {INSULATION_LABELS[insKey]}
                            </span>
                            {isActive && <CheckCircle size={14} className="ml-auto text-blue-500" />}
                        </button>
                    )
                })}
            </div>
        </div>

        {/* DataBook / Welding Log */}
        {isWeldedOrLater && (
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 border-b pb-2 dark:border-slate-700">
              <Wrench size={16} /> Dados Técnicos Solda
            </h3>
            
            <div>
              <label className="block text-xs text-slate-500 mb-1">Inspetor de Solda</label>
              <input 
                type="text" 
                value={formData.welderInfo?.welderId || ''}
                onChange={(e) => handleWelderChange('welderId', e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm text-slate-900 dark:text-white outline-none"
                placeholder="Nome do Inspetor"
              />
            </div>
            
            <div>
              <label className="block text-xs text-slate-500 mb-1">Data da Solda / Inspeção</label>
              <input 
                type="date" 
                value={formData.welderInfo?.weldDate || ''}
                onChange={(e) => handleWelderChange('weldDate', e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm text-slate-900 dark:text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Lote do Eletrodo/Corrida</label>
              <input 
                type="text" 
                value={formData.welderInfo?.electrodeBatch || ''}
                onChange={(e) => handleWelderChange('electrodeBatch', e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm text-slate-900 dark:text-white outline-none"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input 
                type="checkbox" 
                id="visualOk"
                checked={formData.welderInfo?.visualInspection || false}
                onChange={(e) => handleWelderChange('visualInspection', e.target.checked)}
                className="rounded text-blue-500 focus:ring-blue-500 h-4 w-4"
              />
              <label htmlFor="visualOk" className="text-sm text-slate-700 dark:text-slate-300 select-none cursor-pointer flex items-center gap-1">
                Inspeção Visual Aprovada <CheckCircle size={14} className="text-green-500"/>
              </label>
            </div>
          </div>
        )}

      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
         <button 
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-2 p-3 rounded bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 transition-colors font-semibold"
         >
            <Trash2 size={18} /> Excluir Segmento de Tubo
         </button>
      </div>
    </div>
  );
};

export default Sidebar;