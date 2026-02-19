import React, { useState } from 'react';
import { Save, FolderOpen, Trash2, X, Database, Clock, Calendar } from 'lucide-react';

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
  onSave: (name: string) => void;
  onLoad: (project: any) => void;
  onDelete: (id: string) => void;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({ 
    isOpen, onClose, projects, onSave, onLoad, onDelete 
}) => {
    const [newProjectName, setNewProjectName] = useState('');
    const [mode, setMode] = useState<'LIST' | 'SAVE'>('LIST');

    if (!isOpen) return null;

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' });
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg"><Database className="text-white" size={24} /></div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Banco de Dados de Projetos</h2>
                            <p className="text-slate-400 text-sm">Gerenciamento Local (IndexedDB)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

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
                    </div>

                    {mode === 'SAVE' && (
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-4">
                            <label className="block text-sm font-bold text-slate-400 mb-2 uppercase">Nome do Projeto</label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    placeholder="Ex: Ampliação Área 51 - Rev.02"
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    autoFocus
                                />
                                <button 
                                    disabled={!newProjectName.trim()}
                                    onClick={() => { onSave(newProjectName); setNewProjectName(''); setMode('LIST'); }}
                                    className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-lg font-bold flex items-center gap-2"
                                >
                                    <Save size={18} /> Salvar
                                </button>
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
                                projects.sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map((proj) => (
                                    <div key={proj.id} className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/50 rounded-xl p-4 flex items-center justify-between group transition-all">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{proj.name}</h3>
                                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                                <span className="flex items-center gap-1"><Calendar size={12}/> {formatDate(proj.updatedAt)}</span>
                                                <span className="flex items-center gap-1"><Database size={12}/> {proj.pipes?.length || 0} tubos</span>
                                                <span className="bg-slate-900 px-2 py-0.5 rounded text-slate-300">{proj.location || 'Sem local'}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => { if(confirm('Carregar este projeto substituirá o atual. Continuar?')) onLoad(proj); }}
                                                className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg font-bold text-sm transition-colors"
                                            >
                                                Abrir
                                            </button>
                                            <button 
                                                onClick={() => { if(confirm('Tem certeza que deseja excluir este projeto?')) onDelete(proj.id); }}
                                                className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
