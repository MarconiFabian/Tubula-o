import React, { useState, useEffect, useCallback } from 'react';
import Scene from './components/3d/Scene';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import { INITIAL_PIPES, STATUS_LABELS, STATUS_COLORS } from './constants';
import { PipeSegment, PipeStatus } from './types';
import { LayoutDashboard, Cuboid, PenTool, XCircle, Ruler, MousePointer2, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function App() {
  const [pipes, setPipes] = useState<PipeSegment[]>(INITIAL_PIPES);
  const [selectedPipeId, setSelectedPipeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'3d' | 'dashboard'>('3d');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFixedLength, setIsFixedLength] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
        name: `Nova Linha ${pipes.length + 1}`,
        start,
        end,
        diameter: 0.3, // Default diameter
        status: 'PENDING' as PipeStatus, // Use string literal cast to avoid runtime enum usage
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

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 10;
        let currentY = 20;

        // Title
        pdf.setFontSize(18);
        pdf.text('Relatório de Progresso - PipeFlow Manager', margin, currentY);
        currentY += 10;
        pdf.setFontSize(10);
        pdf.text(`Data: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin, currentY);
        currentY += 10;

        // 1. Capture 3D Scene (if visible)
        if (viewMode === '3d') {
             const sceneContainer = document.getElementById('scene-canvas-container');
             if (sceneContainer) {
                 const canvas = sceneContainer.querySelector('canvas');
                 if (canvas) {
                     const imgData = canvas.toDataURL('image/png');
                     const imgProps = pdf.getImageProperties(imgData);
                     const pdfImgWidth = pageWidth - (margin * 2);
                     const pdfImgHeight = (imgProps.height * pdfImgWidth) / imgProps.width;

                     pdf.setFontSize(14);
                     pdf.text('1. Visualização do Modelo 3D', margin, currentY);
                     currentY += 8;
                     pdf.addImage(imgData, 'PNG', margin, currentY, pdfImgWidth, pdfImgHeight);
                     currentY += pdfImgHeight + 10;
                 }
             }
        }

        // 2. Capture Full Dashboard Stats
        // We use the hidden export container to ensure we get the full charts even if in 3D mode
        const dashboardEl = document.getElementById('dashboard-export-container');
        if (dashboardEl) {
            const canvas = await html2canvas(dashboardEl, {
                backgroundColor: '#1e293b', 
                scale: 2 
            });
            const imgData = canvas.toDataURL('image/png');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfImgWidth = pageWidth - (margin * 2);
            const pdfImgHeight = (imgProps.height * pdfImgWidth) / imgProps.width;
            
            if (currentY + pdfImgHeight > 280) {
                pdf.addPage();
                currentY = 20;
            }

            pdf.setFontSize(14);
            pdf.text('2. Indicadores de Performance (KPIs)', margin, currentY);
            currentY += 8;
            pdf.addImage(imgData, 'PNG', margin, currentY, pdfImgWidth, pdfImgHeight);
            currentY += pdfImgHeight + 10;
        }

        // 3. Pipe Status Table (Text)
        if (currentY + 40 > 280) {
             pdf.addPage();
             currentY = 20;
        }
        
        pdf.setFontSize(14);
        pdf.text('3. Detalhamento de Linhas', margin, currentY);
        currentY += 10;

        pdf.setFontSize(10);
        pdf.setFillColor(200, 200, 200);
        pdf.rect(margin, currentY, pageWidth - (margin * 2), 8, 'F');
        pdf.font = "helvetica";
        pdf.setFont(undefined, 'bold');
        pdf.text("ID", margin + 2, currentY + 5);
        pdf.text("Nome", margin + 30, currentY + 5);
        pdf.text("Status", margin + 90, currentY + 5);
        pdf.text("Comp. (m)", margin + 140, currentY + 5);
        pdf.setFont(undefined, 'normal');
        currentY += 12;

        pipes.forEach((pipe, index) => {
            if (currentY > 280) {
                pdf.addPage();
                currentY = 20;
            }
            
            const statusLabel = STATUS_LABELS[pipe.status] || pipe.status;
            
            pdf.text(pipe.id, margin + 2, currentY);
            pdf.text(pipe.name.substring(0, 30), margin + 30, currentY);
            pdf.text(statusLabel, margin + 90, currentY);
            pdf.text(pipe.length.toFixed(2), margin + 140, currentY);
            
            pdf.setDrawColor(220, 220, 220);
            pdf.line(margin, currentY + 2, pageWidth - margin, currentY + 2);

            currentY += 8;
        });

        pdf.save('relatorio-pipeflow.pdf');

    } catch (err) {
        console.error("Erro ao gerar PDF:", err);
        alert("Erro ao gerar PDF. Verifique o console.");
    } finally {
        setIsExporting(false);
    }
  };

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
        setIsFixedLength(false); // Reset to free drawing by default
    }
  };

  const getStatusColor = (status: string) => {
      return STATUS_COLORS[status] || '#94a3b8';
  };

  const getStatusLabel = (status: string) => {
      return STATUS_LABELS[status] || status;
  };

  return (
    <div className="h-screen w-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100 overflow-hidden font-sans relative">
      
      {/* HEADER */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="bg-blue-600 p-2 rounded-lg shadow-blue-500/20 shadow-lg">
            <Cuboid className="text-white" size={24} />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-bold tracking-tight leading-none">PipeFlow</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Gestor de Tubulação</p>
          </div>
        </div>

        {/* COMBINED TOOLBAR: View Toggles AND Export Button together to prevent hiding */}
        <div className="flex items-center gap-3">
             <nav className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <button 
                    onClick={() => { setViewMode('3d'); setIsDrawing(false); }}
                    className={`px-3 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${viewMode === '3d' && !isDrawing ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <Cuboid size={16} /> 3D
                </button>
                <button 
                    onClick={() => { setViewMode('dashboard'); setIsDrawing(false); }}
                    className={`px-3 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${viewMode === 'dashboard' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <LayoutDashboard size={16} /> Painel
                </button>
            </nav>

            <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className={`hidden md:flex px-4 py-2 text-sm font-bold rounded-lg transition-all items-center gap-2 shadow-lg 
                    ${isExporting 
                        ? 'bg-slate-700 text-slate-400 cursor-wait' 
                        : 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20'}`}
                title="Exportar Relatório PDF"
            >
                <FileDown size={18} /> <span className="hidden lg:inline">Exportar PDF</span>
            </button>
        </div>
      </header>

      {/* FLOATING ACTION BUTTON (Always Visible) */}
      <button
        onClick={handleExportPDF}
        disabled={isExporting}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110
            ${isExporting ? 'bg-slate-700' : 'bg-red-600 hover:bg-red-500 ring-4 ring-red-900/30'}`}
        title="Gerar PDF Agora"
      >
         <FileDown size={28} className="text-white" />
      </button>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex">
        
        {/* Hidden Container for PDF Generation */}
        <div className="fixed top-0 left-0 w-[1200px] pointer-events-none opacity-0 -z-50 overflow-hidden">
             <div id="dashboard-export-container" className="p-4 bg-slate-900 text-slate-100">
                 {/* Pass default props without onExportPDF to avoid button inside export image */}
                 <Dashboard pipes={pipes} />
             </div>
        </div>

        {/* Left/Center Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden p-4 gap-4 relative">
            
            {/* View Switching */}
            {viewMode === 'dashboard' ? (
                <div className="h-full overflow-y-auto">
                    <div id="dashboard-container">
                       <Dashboard pipes={pipes} onExportPDF={handleExportPDF} isExporting={isExporting} />
                    </div>
                    
                    {/* Detailed List View for Dashboard */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700 overflow-hidden mt-4 mb-20">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                <tr>
                                    <th className="p-3">ID</th>
                                    <th className="p-3">Nome da Linha</th>
                                    <th className="p-3">Comprimento</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Soldador</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pipes.map(pipe => (
                                    <tr key={pipe.id} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer" onClick={() => { setSelectedPipeId(pipe.id); setViewMode('3d'); }}>
                                        <td className="p-3 font-mono">{pipe.id}</td>
                                        <td className="p-3">{pipe.name}</td>
                                        <td className="p-3">{pipe.length.toFixed(2)}m</td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 rounded-full text-xs font-bold text-white shadow-sm" 
                                                  style={{backgroundColor: getStatusColor(pipe.status)}}>
                                                {getStatusLabel(pipe.status)}
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
                   {/* Draw Mode Toolbar - ALWAYS VISIBLE WHEN DRAWING */}
                   <div className="flex justify-between items-center mb-4 shrink-0 min-h-[48px]">
                        <div className="flex items-center gap-4 flex-wrap w-full">
                             <button 
                                onClick={toggleDrawing}
                                className={`
                                    flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold shadow-lg transition-all text-sm shrink-0
                                    ${isDrawing 
                                        ? 'bg-red-500 text-white hover:bg-red-600 ring-2 ring-red-300 dark:ring-red-900' 
                                        : 'bg-blue-600 text-white hover:bg-blue-700'}
                                `}
                             >
                                {isDrawing ? (
                                    <><XCircle size={20} /> PARAR DESENHO</>
                                ) : (
                                    <><PenTool size={20} /> MODO DESENHO</>
                                )}
                             </button>
                             
                             {isDrawing && (
                                <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-300 dark:border-slate-600 shadow-lg animate-in fade-in slide-in-from-left-4 duration-300 ml-auto">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2 hidden sm:inline-block">
                                        Modo:
                                    </span>
                                    
                                    <div className="flex bg-slate-200 dark:bg-slate-950 rounded-lg p-1">
                                        <button
                                            onClick={() => setIsFixedLength(false)}
                                            className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${
                                                !isFixedLength 
                                                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-slate-300 dark:ring-slate-500' 
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            <MousePointer2 size={16} /> Modo Livre
                                        </button>
                                        <button
                                            onClick={() => setIsFixedLength(true)}
                                            className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 transition-all ${
                                                isFixedLength 
                                                ? 'bg-purple-600 text-white shadow-md ring-1 ring-purple-500' 
                                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                            }`}
                                        >
                                            <Ruler size={16} /> Tubo 6m
                                        </button>
                                    </div>
                                </div>
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
                            fixedLength={isFixedLength}
                        />
                    </div>
                </div>
            )}
        </div>

        {/* Right Sidebar */}
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