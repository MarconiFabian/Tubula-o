import React, { useState } from 'react';
import { Save, FolderOpen, Trash2, X, Database, Clock, Calendar, Cloud, CloudOff, Info, Download, Upload } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: Date;
  location: string;
  pipeCount: number;
}

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: any[];
  onSave: (name: string, overwriteId?: string, overrides?: any) => void;
  onLoad: (project: any) => void;
  onDelete: (id: string) => void;
  onExport: (project: any) => void;
  selectedProjectIds: string[];
  onToggleProjectSelection: (id: string) => void;
  currentProjectId?: string | null;
  currentProjectName?: string | null;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({ 
    isOpen, onClose, projects, onSave, onLoad, onDelete, onExport,
    selectedProjectIds, onToggleProjectSelection,
    currentProjectId, currentProjectName
}) => {
    const [newProjectName, setNewProjectName] = useState('');
    const [mode, setMode] = useState<'LIST' | 'SAVE'>('LIST');
    const [confirmAction, setConfirmAction] = useState<{type: 'LOAD' | 'DELETE' | 'OVERWRITE', project: any} | null>(null);

    if (!isOpen) return null;

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const project = JSON.parse(event.target?.result as string);
                if (project && project.name && project.pipes) {
                    // Import as a new project
                    onSave(project.name + " (Importado)", undefined, project);
                } else {
                    alert("Arquivo JSON inválido.");
                }
            } catch (err) {
                console.error("Erro ao importar projeto:", err);
                alert("Erro ao ler o arquivo JSON.");
            }
        };
        reader.readAsText(file);
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' });
    };

    const isCloudEnabled = isSupabaseConfigured();

    const handleConfirm = () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'LOAD') {
            onLoad(confirmAction.project);
        } else if (confirmAction.type === 'DELETE') {
            onDelete(confirmAction.project.id);
        } else if (confirmAction.type === 'OVERWRITE') {
            onSave(confirmAction.project.name, confirmAction.project.id);
            setMode('LIST');
        }
        setConfirmAction(null);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            {confirmAction && (
                <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-2xl max-w-md w-full">
                        <h3 className="text-xl font-bold text-white mb-2">Confirmação</h3>
                        <p className="text-slate-300 mb-6">
                            {confirmAction.type === 'LOAD' && 'Carregar este projeto substituirá o atual. Continuar?'}
                            {confirmAction.type === 'DELETE' && 'Tem certeza que deseja excluir este projeto?'}
                            {confirmAction.type === 'OVERWRITE' && `Deseja salvar o projeto atual por cima de "${confirmAction.project.name}"? Isso apagará os dados anteriores deste projeto.`}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setConfirmAction(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">Cancelar</button>
                            <button onClick={handleConfirm} className={`px-4 py-2 rounded-lg font-bold transition-colors ${confirmAction.type === 'DELETE' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg"><Database className="text-white" size={24} /></div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Banco de Dados de Projetos</h2>
                            <div className="flex items-center gap-2">
                                <p className="text-slate-400 text-sm">Gerenciamento Local (IndexedDB)</p>
                                <span className="text-slate-600">|</span>
                                {isCloudEnabled ? (
                                    <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                                        <Cloud size={12} /> Nuvem Ativa (Supabase)
                                    </span>
                                ) : (
                                    <span className="text-amber-500 text-xs font-bold flex items-center gap-1">
                                        <CloudOff size={12} /> Apenas Local
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Info Alert if not cloud */}
                {!isCloudEnabled && (
                    <div className="mx-6 mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3 items-start">
                        <Info className="text-amber-500 shrink-0" size={18} />
                        <p className="text-xs text-amber-200/70">
                            <strong>Atenção:</strong> A sincronização em nuvem não está configurada. Seus projetos ficam salvos apenas neste navegador/computador. Configure as variáveis do Supabase no Vercel para habilitar o acesso em outros dispositivos.
                        </p>
                    </div>
                )}

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                    
                    {/* Actions Toolbar */}
                    <div className="flex gap-4 mb-6">
                        <button 
                            onClick={() => setMode('LIST')}
                            className={`flex-1 py-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-all ${mode === 'LIST' ? 'bg-slate-700 text-white ring-2 ring-blue-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                            <FolderOpen size={18} /> Meus Projetos Salvos
                        </button>
                        <button 
                            onClick={() => setMode('SAVE')}
                            className={`flex-1 py-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-all ${mode === 'SAVE' ? 'bg-blue-600 text-white ring-2 ring-blue-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-blue-400'}`}
                        >
                            <Save size={18} /> Salvar Projeto Atual
                        </button>
                        <div className="relative">
                            <input 
                                type="file" 
                                accept=".json" 
                                onChange={handleImport} 
                                className="hidden" 
                                id="import-project" 
                            />
                            <label 
                                htmlFor="import-project"
                                className="h-full px-4 py-3 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-emerald-400 rounded-lg font-bold flex items-center gap-2 cursor-pointer transition-all"
                                title="Importar projeto do computador (.json)"
                            >
                                <Upload size={18} /> Importar
                            </label>
                        </div>
                    </div>

                    {mode === 'SAVE' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                            {currentProjectId && currentProjectName && (
                                <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-500/30">
                                    <h3 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                                        <Save size={18} /> Atualizar Projeto Atual
                                    </h3>
                                    <p className="text-slate-300 text-sm mb-4">
                                        Você está editando o projeto <strong className="text-white">"{currentProjectName}"</strong>. Deseja salvar as alterações neste mesmo projeto?
                                    </p>
                                    <button 
                                        onClick={() => { onSave(currentProjectName, currentProjectId); setMode('LIST'); }}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors"
                                    >
                                        <Save size={18} /> Salvar Alterações em "{currentProjectName}"
                                    </button>
                                </div>
                            )}

                            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                                <h3 className="text-slate-300 font-bold mb-4 flex items-center gap-2">
                                    <FolderOpen size={18} /> Salvar como Novo Projeto
                                </h3>
                                <label className="block text-sm font-bold text-slate-400 mb-2 uppercase">Nome do Novo Projeto</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={newProjectName}
                                        onChange={(e) => setNewProjectName(e.target.value)}
                                        placeholder="Ex: Ampliação Área 51 - Rev.02"
                                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        autoFocus={!currentProjectId}
                                    />
                                    <button 
                                        disabled={!newProjectName.trim()}
                                        onClick={() => { onSave(newProjectName); setNewProjectName(''); setMode('LIST'); }}
                                        className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-lg font-bold flex items-center gap-2"
                                    >
                                        <Save size={18} /> Salvar Novo
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {mode === 'LIST' && (
                        <div className="space-y-3">
                            {projects.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <Database size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="font-bold">Nenhum projeto salvo encontrado.</p>
                                    <p className="text-sm">Vá para a aba "Salvar" para guardar seu trabalho atual.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            {selectedProjectIds.length > 0 ? `${selectedProjectIds.length} Projetos Selecionados para Consolidação` : 'Lista de Projetos'}
                                        </div>
                                        {selectedProjectIds.length > 0 && (
                                            <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest animate-pulse">
                                                Consolidando no Dashboard
                                            </div>
                                        )}
                                    </div>
                                    {projects.sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map((proj) => (
                                        <div key={proj.id} className={`bg-slate-800 hover:bg-slate-750 border rounded-xl p-4 flex items-center justify-between group transition-all ${selectedProjectIds.includes(proj.id) ? 'border-blue-500 ring-1 ring-blue-500/30 shadow-lg shadow-blue-900/20' : 'border-slate-700 hover:border-blue-500/50'}`}>
                                            <div className="flex items-center gap-4 flex-1">
                                                {/* Checkbox for consolidation */}
                                                <div 
                                                    onClick={() => onToggleProjectSelection(proj.id)}
                                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${selectedProjectIds.includes(proj.id) ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 hover:border-slate-400'}`}
                                                >
                                                    {selectedProjectIds.includes(proj.id) && <Database size={14} />}
                                                </div>

                                                <div className="flex-1">
                                                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{proj.name}</h3>
                                                    <div className="flex items-center gap-4 text-xs text-slate-400">
                                                        <span className="flex items-center gap-1"><Calendar size={12}/> {formatDate(proj.updatedAt)}</span>
                                                        <span className="flex items-center gap-1"><Database size={12}/> {proj.pipes?.length || 0} tubos</span>
                                                        <span className="bg-slate-900 px-2 py-0.5 rounded text-slate-300">{proj.location || 'Sem local'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => onExport(proj)}
                                                    className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-500 hover:text-white rounded-lg font-bold text-sm transition-colors flex items-center gap-1"
                                                    title="Baixar projeto para o computador (.json)"
                                                >
                                                    <Download size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => setConfirmAction({ type: 'OVERWRITE', project: proj })}
                                                    className="px-3 py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-500 hover:text-white rounded-lg font-bold text-sm transition-colors flex items-center gap-1"
                                                    title="Salvar projeto atual por cima deste"
                                                >
                                                    <Save size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => setConfirmAction({ type: 'LOAD', project: proj })}
                                                    className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg font-bold text-sm transition-colors"
                                                >
                                                    Abrir
                                                </button>
                                                <button 
                                                    onClick={() => setConfirmAction({ type: 'DELETE', project: proj })}
                                                    className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
