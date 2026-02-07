import React, { useState, useEffect } from 'react';
import { PipeSegment, PipeStatus, InsulationStatus } from '../types';
import { STATUS_LABELS, STATUS_COLORS, ALL_STATUSES, INSULATION_LABELS, INSULATION_COLORS, ALL_INSULATION_STATUSES } from '../constants';
import { X, CheckCircle, AlertCircle, FileText, Ruler, User, Trash2, Shield, Thermometer } from 'lucide-react';

interface SidebarProps {
  pipe: PipeSegment | null;
  onUpdate: (updatedPipe: PipeSegment) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ pipe, onUpdate, onDelete, onClose }) => {
  const [formData, setFormData] = useState<PipeSegment | null>(null);

  useEffect(() => {
    // Only update if pipe exists and is different to prevent cycles
    if (pipe) {
        setFormData(JSON.parse(JSON.stringify(pipe))); // Deep clone to avoid ref issues
    } else {
        setFormData(null);
    }
  }, [pipe]);

  // Extreme Guard: Ensure formData matches the currently selected pipe ID before rendering
  // This prevents rendering stale data during rapid switching
  if (!formData || !pipe || formData.id !== pipe.id) return null;

  const handleStatusChange = (newStatus: string) => {
    const status = newStatus as PipeStatus;
    
    const updated = { ...formData, status };
    // Clear welder info if moving back to pending
    if (status === 'PENDING' || status === 'MOUNTED') {
      updated.welderInfo = undefined;
    }
    setFormData(updated);
    onUpdate(updated);
  };

  const handleInsulationChange = (newStatus: string) => {
      const insulationStatus = newStatus as InsulationStatus;
      const updated = { ...formData, insulationStatus };
      setFormData(updated);
      onUpdate(updated);
  }

  const handleWelderChange = (field: string, value: any) => {
    // Create default object safely
    const baseWelderInfo = formData.welderInfo ? { ...formData.welderInfo } : {
        welderId: '',
        weldDate: new Date().toISOString().split('T')[0],
        electrodeBatch: '',
        visualInspection: false
    };

    const updated = { 
      ...formData, 
      welderInfo: { 
        ...baseWelderInfo, 
        [field]: value 
      } 
    };
    
    setFormData(updated);
    onUpdate(updated);
  };

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
          
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Ruler size={12} /> Comprimento Calculado (3D)
            </label>
            <div className="text-slate-900 dark:text-white font-mono text-lg font-bold">
              {(formData.length || 0).toFixed(3)} metros
            </div>
          </div>
        </div>

        {/* Status Control */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Status Tubulação</label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_STATUSES.map((statusKey) => {
              return (
              <button
                key={statusKey}
                onClick={() => handleStatusChange(statusKey)}
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
                            onClick={() => handleInsulationChange(insKey)}
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
              <User size={16} /> DataBook / Registro de Solda
            </h3>
            <div>
              <label className="block text-xs text-slate-500 mb-1">ID do Soldador / Sinete</label>
              <input 
                type="text" 
                value={formData.welderInfo?.welderId || ''}
                onChange={(e) => handleWelderChange('welderId', e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-sm text-slate-900 dark:text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Data da Solda</label>
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

        {/* Hydro Info */}
        {formData.status === 'HYDROTEST' && (
           <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 flex items-start gap-3">
             <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={18} />
             <div>
               <h4 className="text-sm font-bold text-blue-700 dark:text-blue-300">Pronto para Test Pack</h4>
               <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                 Esta linha está incluída no Test Pack <strong>{formData.testPackId || 'TP-PENDENTE'}</strong>.
               </p>
             </div>
           </div>
        )}

      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
         <button 
            onClick={() => onDelete(formData.id)}
            className="w-full flex items-center justify-center gap-2 p-3 rounded bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 transition-colors font-semibold"
         >
            <Trash2 size={18} /> Excluir Segmento de Tubo
         </button>
      </div>
    </div>
  );
};

export default Sidebar;