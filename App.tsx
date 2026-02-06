import React, { useState, useEffect, useCallback } from 'react';
import Scene from './components/3d/Scene';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import { INITIAL_PIPES } from './constants';
import { PipeSegment, PipeStatus } from './types';
import { LayoutDashboard, Cuboid, PenTool, XCircle } from 'lucide-react';

export default function App() {
  const [pipes, setPipes] = useState<PipeSegment[]>(INITIAL_PIPES);
  const [selectedPipeId, setSelectedPipeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | 'dashboard'>('3d');
  const [isDrawing, setIsDrawing] = useState(false);

  const selectedPipe = pipes.find(p => p.id === selectedPipeId) || null;

  const handleUpdatePipe = (updatedPipe: PipeSegment) => {
    // Recalculate length if geometry changes
    const length = Math.sqrt(
        Math.pow(updatedPipe.end.x - updatedPipe.start.x, 2) + 
        Math.pow(updatedPipe.end.y - updatedPipe.start.y, 2) + 
        Math.pow(updatedPipe.end.z - updatedPipe.start.z, 2)
    );
    const finalPipe = { ...updatedPipe, length };
    
    setPipes(prev => prev.map(p => p.id === finalPipe.id ? finalPipe : p));
  };

  const handleAddPipe = (start: {x:number, y:number, z:number}, end: {x:number, y:number, z:number}) => {
    const length = Math.sqrt(
        Math.pow(end.x - start.x, 2) + 
        Math.pow(end.y - start.y, 2) + 
        Math.pow(end.z - start.z, 2)
    );
    
    const newPipe: PipeSegment = {
        id: `P-${Math.floor(Math.random() * 10000)}`,
        name: `New Line ${pipes.length + 1}`,
        start,
        end,
        diameter: 0.3, // Default diameter
        status: PipeStatus.PENDING,
        length: length
    };

    setPipes(prev => [...prev, newPipe]);
  };

  const handleDeletePipe = useCallback((id: string) => {
      setPipes(prev => prev.filter(p => p.id !== id));
      if (selectedPipeId === id) {
          setSelectedPipeId(null);
      }
  }, [selectedPipeId]);

  // Global Key listeners for actions like Delete
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
        if (!selectedPipeId || viewMode !== '3d') return;
        
        if (e.key === 'Delete' || e.key === 'Backspace') {
            handleDeletePipe(selectedPipeId);
        }
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [selectedPipeId, viewMode, handleDeletePipe]);

  const toggleDrawing = () => {
    setIsDrawing(!isDrawing);
    if (!isDrawing) {
        setViewMode('3d');
        setSelectedPipeId(null); // Deselect when starting to draw
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      
      {/* Header */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Cuboid className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">PipeFlow Manager</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Visual Database & Tracking System</p>
          </div>
        </div>

        <nav className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button 
            onClick={() => { setViewMode('3d'); setIsDrawing(false); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${viewMode === '3d' && !isDrawing ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <Cuboid size={16} /> 3D View
          </button>
          <button 
            onClick={() => { setViewMode('dashboard'); setIsDrawing(false); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${viewMode === 'dashboard' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex">
        
        {/* Left/Center Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden p-4 gap-4 relative">
            
            {/* View Switching */}
            {viewMode === 'dashboard' ? (
                <div className="h-full overflow-y-auto">
                    <Dashboard pipes={pipes} />
                    
                    {/* Detailed List View for Dashboard */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                <tr>
                                    <th className="p-3">ID</th>
                                    <th className="p-3">Name</th>
                                    <th className="p-3">Length</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Welder</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pipes.map(pipe => (
                                    <tr key={pipe.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer" onClick={() => { setSelectedPipeId(pipe.id); setViewMode('3d'); }}>
                                        <td className="p-3 font-mono">{pipe.id}</td>
                                        <td className="p-3">{pipe.name}</td>
                                        <td className="p-3">{pipe.length.toFixed(2)}m</td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 rounded-full text-xs font-bold text-white" 
                                                  style={{backgroundColor: {PENDING: '#ef4444', MOUNTED: '#eab308', WELDED: '#22c55e', HYDROTEST: '#3b82f6'}[pipe.status]}}>
                                                {pipe.status}
                                            </span>
                                        </td>
                                        <td className="p-3">{pipe.welderInfo?.welderId || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="w-full h-full flex flex-col relative">
                   {/* Draw Mode Toggle - Floating or Top Bar */}
                   <div className="flex justify-between items-center mb-4 shrink-0">
                        <div className="flex items-center gap-2">
                             <button 
                                onClick={toggleDrawing}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow transition-all
                                    ${isDrawing 
                                        ? 'bg-red-500 text-white hover:bg-red-600' 
                                        : 'bg-blue-600 text-white hover:bg-blue-700'}
                                `}
                             >
                                {isDrawing ? (
                                    <><XCircle size={18} /> Stop Drawing</>
                                ) : (
                                    <><PenTool size={18} /> Draw Piping</>
                                )}
                             </button>
                             {isDrawing && (
                                <span className="text-sm text-slate-500 animate-pulse">
                                    Click points on grid. Hold SHIFT for vertical.
                                </span>
                             )}
                        </div>
                   </div>

                    {/* 3D Canvas */}
                    <div className="flex-1 min-h-0 relative">
                         <Scene 
                            pipes={pipes} 
                            selectedId={selectedPipeId} 
                            onSelectPipe={setSelectedPipeId} 
                            isDrawing={isDrawing}
                            onAddPipe={handleAddPipe}
                            onUpdatePipe={handleUpdatePipe}
                            onCancelDraw={() => setIsDrawing(false)}
                        />
                    </div>
                    
                    {/* Mini Stats (Only visible in 3D mode if not drawing, to save space) */}
                    {!isDrawing && (
                        <div className="absolute bottom-4 left-4 right-4 h-24 pointer-events-none opacity-90 hover:opacity-100 transition-opacity">
                            <div className="pointer-events-auto h-full">
                                <Dashboard pipes={pipes} />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Right Sidebar (Slide-over) */}
        {selectedPipe && !isDrawing && (
            <div className="w-96 shrink-0 h-full relative">
                 <Sidebar 
                    pipe={selectedPipe} 
                    onUpdate={handleUpdatePipe} 
                    onDelete={handleDeletePipe}
                    onClose={() => setSelectedPipeId(null)} 
                />
            </div>
        )}
      </main>
    </div>
  );
}