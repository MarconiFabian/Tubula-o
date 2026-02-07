import React, { useEffect, useState, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, TransformControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import PipeMesh from './PipeMesh';
import { PipeDrawer } from './PipeDrawer';
import { Fittings, ConnectionNode } from './Fittings';
import { PipeSegment, PipeStatus } from '../../types';
import { 
  STATUS_COLORS, 
  INSULATION_COLORS, 
  STATUS_LABELS, 
  INSULATION_LABELS, 
  ALL_STATUSES, 
  ALL_INSULATION_STATUSES 
} from '../../constants';
import { 
  MoveHorizontal, 
  MoveVertical, 
  MoveDiagonal, 
  X as XIcon,
  Shield
} from 'lucide-react';

interface SceneProps {
  pipes: PipeSegment[];
  selectedId: string | null;
  onSelectPipe: (id: string | null) => void;
  isDrawing: boolean;
  onAddPipe: (start: {x:number, y:number, z:number}, end: {x:number, y:number, z:number}) => void;
  onUpdatePipe: (pipe: PipeSegment) => void;
  onCancelDraw: () => void;
  fixedLength?: boolean;
}

// Inverted Logic for more natural isometric feel
const KeyboardManager = ({ selectedId, pipes, onUpdatePipe }: { selectedId: string | null, pipes: PipeSegment[], onUpdatePipe: (p: PipeSegment) => void }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedId) return;
            const pipe = pipes.find(p => p.id === selectedId);
            if (!pipe) return;

            const step = e.shiftKey ? 1.0 : 0.1; 
            const delta = { x: 0, y: 0, z: 0 };
            let moved = false;

            // INVERTED CONTROLS for intuitive isometric movement
            if (e.key === 'ArrowUp') { delta.z = -step; moved = true; }   // Moves "Into" the screen (North)
            if (e.key === 'ArrowDown') { delta.z = step; moved = true; }  // Moves "Out" of the screen (South)
            if (e.key === 'ArrowLeft') { delta.x = -step; moved = true; } // Moves Left
            if (e.key === 'ArrowRight') { delta.x = step; moved = true; } // Moves Right
            
            // Vertical movement
            if (e.key === 'PageUp') { delta.y = step; moved = true; }
            if (e.key === 'PageDown') { delta.y = -step; moved = true; }

            if (moved) {
                e.preventDefault();
                onUpdatePipe({
                    ...pipe,
                    start: { x: pipe.start.x + delta.x, y: pipe.start.y + delta.y, z: pipe.start.z + delta.z },
                    end: { x: pipe.end.x + delta.x, y: pipe.end.y + delta.y, z: pipe.end.z + delta.z }
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedId, pipes, onUpdatePipe]);

    return null;
};

const SceneContent: React.FC<SceneProps & { lockedAxis: 'x'|'y'|'z'|null }> = ({ 
  pipes, selectedId, onSelectPipe, isDrawing, onAddPipe, onUpdatePipe, onCancelDraw, lockedAxis, fixedLength
}) => {
    const { camera, gl } = useThree();
    const [isDragging, setIsDragging] = useState(false);
    
    // --- TOPOLOGY CALCULATION ---
    const { connections, trims } = useMemo(() => {
        const map: Record<string, ConnectionNode> = {};
        const pipeTrims: Record<string, { start: number, end: number }> = {};
        
        if (!pipes) return { connections: map, trims: pipeTrims };

        const getKey = (v: {x:number, y:number, z:number}) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;

        // 1. Build Node Map
        pipes.forEach(pipe => {
            const startKey = getKey(pipe.start);
            const endKey = getKey(pipe.end);
            
            const startVec = new THREE.Vector3(pipe.start.x, pipe.start.y, pipe.start.z);
            const endVec = new THREE.Vector3(pipe.end.x, pipe.end.y, pipe.end.z);

            // Vector pointing OUT from start node (towards end)
            const dirFromStart = new THREE.Vector3().subVectors(endVec, startVec).normalize();
            // Vector pointing OUT from end node (towards start)
            const dirFromEnd = new THREE.Vector3().subVectors(startVec, endVec).normalize();

            if (!map[startKey]) map[startKey] = { point: startVec, connectedPipes: [] };
            map[startKey].connectedPipes.push({ pipe, vector: dirFromStart, isStart: true });

            if (!map[endKey]) map[endKey] = { point: endVec, connectedPipes: [] };
            map[endKey].connectedPipes.push({ pipe, vector: dirFromEnd, isStart: false });
        });

        // 2. Calculate Trims (Shortening of pipes at corners)
        // Initialize
        pipes.forEach(p => pipeTrims[p.id] = { start: 0, end: 0 });

        Object.values(map).forEach(node => {
            if (node.connectedPipes.length === 2) {
                const p1 = node.connectedPipes[0];
                const p2 = node.connectedPipes[1];
                
                const dot = p1.vector.dot(p2.vector);
                const isStraight = dot < -0.99; // Approx 180 degrees

                if (!isStraight) {
                    // It's a corner (Elbow)
                    const radius = Math.max(p1.pipe.diameter, p2.pipe.diameter) * 1.5;
                    
                    // Apply trim to pipe 1
                    if (p1.isStart) pipeTrims[p1.pipe.id].start = radius;
                    else pipeTrims[p1.pipe.id].end = radius;

                    // Apply trim to pipe 2
                    if (p2.isStart) pipeTrims[p2.pipe.id].start = radius;
                    else pipeTrims[p2.pipe.id].end = radius;
                }
            }
        });

        return { connections: map, trims: pipeTrims };
    }, [pipes]);


    const handleTransformEnd = (e: any) => {
        setIsDragging(false);
        const object = e.target.object;
        if (!object || !selectedId) return;
        
        const pipe = pipes.find(p => p.id === selectedId);
        if (!pipe) return;

        // ORIGINAL CENTER (from Props)
        const oldMidX = (pipe.start.x + pipe.end.x) / 2;
        const oldMidY = (pipe.start.y + pipe.end.y) / 2;
        const oldMidZ = (pipe.start.z + pipe.end.z) / 2;

        // CALCULATE DELTA: New Position (from drag) - Original Position
        const dx = object.position.x - oldMidX;
        const dy = object.position.y - oldMidY;
        const dz = object.position.z - oldMidZ;

        // UPDATE STATE
        onUpdatePipe({
            ...pipe,
            start: { x: pipe.start.x + dx, y: pipe.start.y + dy, z: pipe.start.z + dz },
            end: { x: pipe.end.x + dx, y: pipe.end.y + dy, z: pipe.end.z + dz }
        });
        
        // CRITICAL FIX: Reset the object visually to the old center immediately.
        object.position.set(oldMidX, oldMidY, oldMidZ);
    };

    return (
        <>
            <OrbitControls 
                makeDefault 
                enabled={!isDragging} // Disable orbit while dragging pipe
                mouseButtons={{
                    LEFT: -1 as unknown as THREE.MOUSE,
                    MIDDLE: THREE.MOUSE.ROTATE,
                    RIGHT: THREE.MOUSE.PAN
                }}
                enableDamping={false} 
            />
            
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} castShadow />
            <pointLight position={[-10, -10, -5]} intensity={0.5} />
            <Environment preset="city" />

            <Grid infiniteGrid fadeDistance={30} sectionColor="#475569" cellColor="#1e293b" position={[0, -0.01, 0]} />
            <axesHelper args={[2]} position={[-6, 0, -6]} />

            <group>
                {/* Render Fittings (Elbows, Welds) */}
                <Fittings 
                    pipes={pipes} 
                    connections={connections} 
                    onSelect={onSelectPipe} 
                    selectedId={selectedId} 
                />

                {/* Render Pipes */}
                {pipes.map((pipe) => {
                    const isSelected = pipe.id === selectedId;
                    const trim = trims[pipe.id] || { start: 0, end: 0 };
                    
                    if (isSelected && !isDrawing) {
                        const midX = (pipe.start.x + pipe.end.x) / 2;
                        const midY = (pipe.start.y + pipe.end.y) / 2;
                        const midZ = (pipe.start.z + pipe.end.z) / 2;

                        const hasInsulation = pipe.insulationStatus && pipe.insulationStatus !== 'NONE';
                        const insColor = hasInsulation ? INSULATION_COLORS[pipe.insulationStatus!] : 'transparent';

                        return (
                            <group key={pipe.id}>
                                <TransformControls 
                                    mode="translate" 
                                    onMouseDown={() => setIsDragging(true)}
                                    onMouseUp={handleTransformEnd}
                                    size={0.7}
                                >
                                    <PipeMesh 
                                        data={pipe} 
                                        isSelected={true} 
                                        onSelect={(id) => onSelectPipe(id)}
                                        trimStart={trim.start}
                                        trimEnd={trim.end} 
                                    />
                                </TransformControls>
                                
                                <Html 
                                    position={[midX, midY + 0.6, midZ]} 
                                    center
                                    zIndexRange={[100, 0]}
                                    style={{ pointerEvents: 'auto' }}
                                >
                                    <div 
                                        className="bg-slate-900/95 p-2 rounded-xl border border-slate-600 shadow-2xl backdrop-blur flex flex-col items-center gap-2 select-none transform transition-all animate-in fade-in zoom-in duration-200"
                                        onPointerDown={(e) => e.stopPropagation()} 
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex items-center gap-1.5 px-1">
                                            {hasInsulation && <Shield size={12} style={{ color: insColor }} />}
                                            <div className="text-xs font-bold text-slate-300 whitespace-nowrap">
                                                {pipe.name}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 bg-slate-800 p-1.5 rounded-lg">
                                             <button 
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpdatePipe({...pipe, status: 'PENDING' as PipeStatus})}}
                                                className={`w-6 h-6 rounded-full border-2 shadow-sm ${pipe.status === 'PENDING' ? 'border-white scale-110 ring-2 ring-red-500/50' : 'border-transparent hover:scale-110 opacity-70 hover:opacity-100'} transition-all`}
                                                style={{backgroundColor: STATUS_COLORS['PENDING']}}
                                                title="Pendente"
                                             />
                                             <button 
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpdatePipe({...pipe, status: 'MOUNTED' as PipeStatus})}}
                                                className={`w-6 h-6 rounded-full border-2 shadow-sm ${pipe.status === 'MOUNTED' ? 'border-white scale-110 ring-2 ring-yellow-500/50' : 'border-transparent hover:scale-110 opacity-70 hover:opacity-100'} transition-all`}
                                                style={{backgroundColor: STATUS_COLORS['MOUNTED']}}
                                                title="Montado"
                                             />
                                             <button 
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpdatePipe({...pipe, status: 'WELDED' as PipeStatus})}}
                                                className={`w-6 h-6 rounded-full border-2 shadow-sm ${pipe.status === 'WELDED' ? 'border-white scale-110 ring-2 ring-green-500/50' : 'border-transparent hover:scale-110 opacity-70 hover:opacity-100'} transition-all`}
                                                style={{backgroundColor: STATUS_COLORS['WELDED']}}
                                                title="Soldado"
                                             />
                                             <button 
                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpdatePipe({...pipe, status: 'HYDROTEST' as PipeStatus})}}
                                                className={`w-6 h-6 rounded-full border-2 shadow-sm ${pipe.status === 'HYDROTEST' ? 'border-white scale-110 ring-2 ring-blue-500/50' : 'border-transparent hover:scale-110 opacity-70 hover:opacity-100'} transition-all`}
                                                style={{backgroundColor: STATUS_COLORS['HYDROTEST']}}
                                                title="Testado"
                                             />
                                        </div>
                                    </div>
                                </Html>
                            </group>
                        );
                    }

                    return (
                        <PipeMesh 
                            key={pipe.id} 
                            data={pipe} 
                            isSelected={false} 
                            onSelect={(id) => onSelectPipe(id)}
                            trimStart={trim.start}
                            trimEnd={trim.end}
                        />
                    );
                })}
            </group>

            <PipeDrawer 
                isDrawing={isDrawing} 
                onAddPipe={onAddPipe} 
                onCancel={onCancelDraw} 
                pipes={pipes}
                lockedAxis={lockedAxis}
                fixedLength={fixedLength}
            />
            
            <KeyboardManager selectedId={selectedId} pipes={pipes} onUpdatePipe={onUpdatePipe} />
        </>
    );
}

const Scene: React.FC<SceneProps & { fixedLength?: boolean }> = (props) => {
  // ... Wrapper remains same ...
  const [lockedAxis, setLockedAxis] = useState<'x'|'y'|'z'|null>(null);

  useEffect(() => {
    if (!props.isDrawing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        if (key === 'x') setLockedAxis(current => current === 'x' ? null : 'x');
        if (key === 'c') setLockedAxis(current => current === 'y' ? null : 'y'); 
        if (key === 'z') setLockedAxis(current => current === 'z' ? null : 'z');
        if (key === 'shift') setLockedAxis('y'); 
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
         if (e.key === 'Shift') setLockedAxis(null); 
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [props.isDrawing]);

  return (
    <div className="w-full h-full bg-slate-900 relative rounded-lg overflow-hidden border border-slate-700 shadow-2xl flex flex-col">
      {/* Instructions Overlay */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="bg-black/60 text-white p-3 rounded-lg backdrop-blur-sm text-xs border border-white/10 select-none mb-2 pointer-events-auto">
            {!props.isDrawing ? (
                <>
                    <p className="font-bold mb-1 text-slate-300">Modo de Visualização e Edição</p>
                    <p>🖱️ Clique no Tubo: Selecionar</p>
                    <p>🖱️ Clique Central: Rotacionar</p>
                    <p>🖱️ Arrastar Esq/Dir: Mover</p>
                    <p>⌨️ Setas: Mover Tubo</p>
                    <p>⌨️ Del: Excluir Tubo</p>
                </>
            ) : (
                <>
                    <p className="font-bold mb-1 text-blue-400">✏️ Modo de Desenho</p>
                    <p className="border-b border-white/10 pb-1 mb-1">
                        Modo Atual: <span className={props.fixedLength ? "text-purple-400 font-bold" : "text-green-400 font-bold"}>
                            {props.fixedLength ? "Fixo (6m)" : "Livre"}
                        </span>
                    </p>
                    <p>🖱️ Clique Esq: Adicionar Ponto</p>
                    <p>🖱️ Clique Central: Rotacionar Vista</p>
                    <p>⌨️ <strong>Z, X, C</strong>: Travar Eixo</p>
                    <p>⌨️ Esc: Cancelar</p>
                </>
            )}
          </div>
          
          {props.isDrawing && (
              <div className="flex gap-1 pointer-events-auto">
                  <button 
                    onClick={() => setLockedAxis(lockedAxis === 'x' ? null : 'x')}
                    className={`px-3 py-2 rounded text-xs font-bold border transition-colors flex items-center gap-1 ${lockedAxis === 'x' ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                    title="Travar Eixo X (Tecla: X)"
                  >
                      <MoveHorizontal size={14} /> Eixo X (X)
                  </button>
                  <button 
                    onClick={() => setLockedAxis(lockedAxis === 'y' ? null : 'y')}
                    className={`px-3 py-2 rounded text-xs font-bold border transition-colors flex items-center gap-1 ${lockedAxis === 'y' ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                    title="Travar Eixo Vertical (Tecla: C)"
                  >
                      <MoveVertical size={14} /> Vert Y (C)
                  </button>
                  <button 
                    onClick={() => setLockedAxis(lockedAxis === 'z' ? null : 'z')}
                    className={`px-3 py-2 rounded text-xs font-bold border transition-colors flex items-center gap-1 ${lockedAxis === 'z' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}`}
                    title="Travar Eixo Z (Tecla: Z)"
                  >
                      <MoveDiagonal size={14} /> Eixo Z (Z)
                  </button>
                  {lockedAxis && (
                      <button 
                        onClick={() => setLockedAxis(null)}
                        className="px-2 py-2 rounded text-xs border bg-slate-800 border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700"
                        title="Limpar Trava"
                      >
                          <XIcon size={14} />
                      </button>
                  )}
              </div>
          )}
      </div>

      {/* Legend Overlay (Top Right) */}
      <div className="absolute top-4 right-4 z-10 pointer-events-none">
          <div className="bg-slate-900/80 text-white p-3 rounded-lg backdrop-blur-md border border-slate-700 shadow-xl pointer-events-auto w-40">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-700 pb-1">Legenda</h3>
            
            <div className="mb-3">
                <p className="text-[10px] font-semibold text-slate-500 mb-1">Status Tubulação</p>
                <div className="grid grid-cols-1 gap-1">
                    {ALL_STATUSES.map(status => (
                        <div key={status} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shadow-sm border border-white/10" style={{ backgroundColor: STATUS_COLORS[status] }}></div>
                            <span className="text-[10px] text-slate-300">{STATUS_LABELS[status]}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-[10px] font-semibold text-slate-500 mb-1">Proteção Térmica</p>
                <div className="grid grid-cols-1 gap-1">
                    {ALL_INSULATION_STATUSES.map(status => {
                        const color = INSULATION_COLORS[status];
                        const isTrans = color === 'transparent';
                        return (
                        <div key={status} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded shadow-sm" 
                                style={{ 
                                    backgroundColor: isTrans ? 'transparent' : color,
                                    border: isTrans ? '1px dashed #64748b' : '1px solid rgba(255,255,255,0.2)'
                                }}></div>
                            <span className="text-[10px] text-slate-300">{INSULATION_LABELS[status]}</span>
                        </div>
                    )})}
                </div>
            </div>
          </div>
      </div>
      
      <div className="flex-1 relative" id="scene-canvas-container">
          <Canvas 
            camera={{ position: [8, 8, 8], fov: 50 }} 
            shadows 
            gl={{ preserveDrawingBuffer: true }}
            onPointerMissed={(e) => {
                if (!props.isDrawing && e.type === 'click') {
                    props.onSelectPipe(null);
                }
            }}
          >
            <color attach="background" args={['#0f172a']} />
            <SceneContent {...props} lockedAxis={lockedAxis} fixedLength={props.fixedLength} />
          </Canvas>
      </div>
    </div>
  );
};

export default Scene;