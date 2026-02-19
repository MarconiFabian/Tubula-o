
import React, { useState } from 'react';
import { Save, FolderOpen, Trash2, X, Database, Calendar, Cloud } from 'lucide-react';

export const DatabaseModal = ({ isOpen, onClose, projects, onSave, onLoad, onDelete }: any) => {
    const [name, setName] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg"><Cloud className="text-white" /></div>
                        <div><h2 className="text-xl font-bold text-white">Projetos em Nuvem</h2><p className="text-slate-400 text-sm">Sincronizado via Supabase</p></div>
                    </div>
                    <button onClick={onClose} className="text-slate-400"><X /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex gap-2 bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <input value={name} onChange={e=>setName(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-white" placeholder="Nome do Projeto"/>
                        <button onClick={()=>{onSave(name); setName('');}} className="bg-blue-600 px-4 py-2 rounded font-bold">Salvar</button>
                    </div>
                    <div className="space-y-2">
                        {projects.map((p: any) => (
                            <div key={p.id} className="bg-slate-800 p-4 rounded-xl flex justify-between items-center border border-slate-700">
                                <div><p className="font-bold text-white">{p.name}</p><p className="text-[10px] text-slate-500">{new Date(p.updatedAt).toLocaleString()}</p></div>
                                <div className="flex gap-2">
                                    <button onClick={()=>onLoad(p)} className="bg-blue-600/20 text-blue-400 px-4 py-1 rounded font-bold">Abrir</button>
                                    <button onClick={()=>onDelete(p.id)} className="p-2 text-red-500"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
