import React, { useEffect, useState, useMemo, Suspense, useRef } from 'react';
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, TransformControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import PipeMesh from './PipeMesh';
import { PipeDrawer } from './PipeDrawer';
import { Fittings, ConnectionNode } from './Fittings';
import { AnnotationMarker, GhostMarker } from './AnnotationMarker';
import { PipeSegment, PipeStatus, Annotation, AccessoryType } from '../../types';
import { STATUS_COLORS, STATUS_LABELS, ALL_STATUSES } from '../../constants';
import { Loader2, UserCheck, Calendar } from 'lucide-react';

interface SceneProps {
  pipes: PipeSegment[];
  annotations?: Annotation[];
  selectedIds: string[]; 
  onSelectPipe: (id: string | null, multi?: boolean) => void;
  onSetSelection?: (ids: string[]) => void; // New optimized bulk selection handler
  isDrawing: boolean;
  onAddPipe: (start: {x:number, y:number, z:number}, end: {x:number, y:number, z:number}) => void;
  onUpdatePipe: (pipe: PipeSegment) => void;
  onMovePipes?: (delta: {x:number, y:number, z:number}) => void;
  onCancelDraw: () => void;
  fixedLength?: boolean;
  onAddAnnotation?: (pos: {x:number, y:number, z:number}) => void;
  onUpdateAnnotation?: (id: string, text: string) => void;
  onDeleteAnnotation?: (id: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  colorMode?: 'STATUS' | 'SPOOL';
  // Copy/Paste Props
  pastePreview?: PipeSegment[] | null;
  onPasteMove?: (pos: {x:number, y:number, z:number}) => void;
  onPasteConfirm?: () => void;
}

const stringToColor = (str: string) => {
    if (!str) return '#475569'; 
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
};

// Componente para Mover Múltiplos Itens (Gizmo no Centro do Grupo)
const MultiSelectControls = ({ selectedIds, pipes, annotations, onMovePipes }: { selectedIds: string[], pipes: PipeSegment[], annotations: Annotation[], onMovePipes: (d:{x:number, y:number, z:number})=>void }) => {
    const transformRef = useRef<any>(null);
    const targetRef = useRef<THREE.Mesh>(null);
    const lastPos = useRef<THREE.Vector3 | null>(null);

    // 1. Calcular o centróide (média) de todos os itens selecionados (Tubos + Anotações)
    const centroid = useMemo(() => {
        if (selectedIds.length === 0) return null;
        
        const selectedPipes = pipes.filter(p => selectedIds.includes(p.id));
        const selectedAnns = annotations.filter(a => selectedIds.includes(a.id));
        
        if (selectedPipes.length === 0 && selectedAnns.length === 0) return null;

        let x = 0, y = 0, z = 0;
        let count = 0;

        // Soma posições dos tubos (start e end points)
        selectedPipes.forEach(p => {
            x += p.start.x + p.end.x;
            y += p.start.y + p.end.y;
            z += p.start.z + p.end.z;
            count += 2; 
        });

        // Soma posições das anotações
        selectedAnns.forEach(a => {
            x += a.position.x;
            y += a.position.y;
            z += a.position.z;
            count += 1;
        });

        if (count === 0) return null;
        return new THREE.Vector3(x / count, y / count, z / count);
    }, [selectedIds, pipes, annotations]);

    // 2. Posicionar o target "invisível" no centróide sempre que a seleção muda
    useEffect(() => {
        if (centroid && targetRef.current) {
            targetRef.current.position.copy(centroid);
        }
    }, [centroid]);

    if (!centroid || selectedIds.length === 0) return null;

    return (
        <>
            <mesh ref={targetRef} position={centroid} visible={false}>
                <boxGeometry args={[0.5, 0.5, 0.5]} />
            </mesh>
            <TransformControls 
                ref={transformRef}
                object={targetRef}
                mode="translate"
                onMouseDown={() => {
                   if (targetRef.current) lastPos.current = targetRef.current.position.clone();
                }}
                onObjectChange={() => {
                    if (targetRef.current && lastPos.current) {
                        const current = targetRef.current.position;
                        const delta = {
                            x: current.x - lastPos.current.x,
                            y: current.y - lastPos.current.y,
                            z: current.z - lastPos.current.z
                        };
                        // Aplica o movimento relativo a todos os itens selecionados
                        onMovePipes(delta);
                        lastPos.current.copy(current);
                    }
                }}
            />
        </>
    )
}

const KeyboardManager = ({ selectedIds, pipes, onUpdatePipe, onUndo, onRedo }: 
    { selectedIds: string[], pipes: PipeSegment[], onUpdatePipe: (p: PipeSegment) => void, onUndo?: ()=>void, onRedo?: ()=>void }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) { onRedo?.(); } else { onUndo?.(); }
                return;
            }

            if (selectedIds.length !== 1) return;
            const selectedId = selectedIds[0];
            
            const pipe = pipes.find(p => p.id === selectedId);

            if (!pipe) return;

            const step = e.shiftKey ? 1.0 : 0.1; 
            const delta = { x: 0, y: 0, z: 0 };
            let moved = false;
            
            if (e.key === 'ArrowUp') { delta.z = -step; moved = true; }
            if (e.key === 'ArrowDown') { delta.z = step; moved = true; }
            if (e.key === 'ArrowLeft') { delta.x = -step; moved = true; }
            if (e.key === 'ArrowRight') { delta.x = step; moved = true; }
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
    }, [selectedIds, pipes, onUpdatePipe, onUndo, onRedo]);
    return null;
};

const SceneContent: React.FC<SceneProps & { lockedAxis: 'x'|'y'|'z'|null, selectionBox: any, onSetSelectionBox: any }> = ({ 
  pipes, annotations = [], selectedIds, onSelectPipe, onSetSelection, isDrawing, onAddPipe, onUpdatePipe, onMovePipes, onCancelDraw, lockedAxis, fixedLength,
  onAddAnnotation, onUpdateAnnotation, onDeleteAnnotation, onUndo, onRedo,
  colorMode = 'STATUS', selectionBox, onSetSelectionBox,
  pastePreview, onPasteMove, onPasteConfirm
}) => {
    const { camera, gl, size } = useThree();
    const [isDragging, setIsDragging] = useState(false);
    const [isQPressed, setIsQPressed] = useState(false);
    const [ghostPos, setGhostPos] = useState<THREE.Vector3 | null>(null);
    
    // --- BOX SELECTION LOGIC ---
    useEffect(() => {
        if (!selectionBox.isSelecting && selectionBox.w > 2 && selectionBox.h > 2) {
            const startX = (selectionBox.x / size.width) * 2 - 1;
            const startY = -(selectionBox.y / size.height) * 2 + 1;
            const endX = ((selectionBox.x + selectionBox.w) / size.width) * 2 - 1;
            const endY = -((selectionBox.y + selectionBox.h) / size.height) * 2 + 1;

            const minX = Math.min(startX, endX);
            const maxX = Math.max(startX, endX);
            const minY = Math.min(startY, endY);
            const maxY = Math.max(startY, endY);

            const newSelectedIds: string[] = [];

            // 1. Verificar Tubos
            pipes.forEach(pipe => {
                const center = new THREE.Vector3(
                    (pipe.start.x + pipe.end.x) / 2,
                    (pipe.start.y + pipe.end.y) / 2,
                    (pipe.start.z + pipe.end.z) / 2
                );
                center.project(camera); 

                if (center.x >= minX && center.x <= maxX && center.y >= minY && center.y <= maxY) {
                    newSelectedIds.push(pipe.id);
                }
            });

            // 2. Verificar Anotações
            annotations.forEach(ann => {
                const pos = new THREE.Vector3(ann.position.x, ann.position.y, ann.position.z);
                pos.project(camera);
                
                if (pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) {
                    newSelectedIds.push(ann.id);
                }
            });

            if (newSelectedIds.length > 0) {
                if (onSetSelection) {
                    // Optimized batch update
                    onSetSelection(newSelectedIds);
                } else {
                    // Fallback
                    onSelectPipe(newSelectedIds[0], false);
                    for(let i=1; i<newSelectedIds.length; i++) {
                        onSelectPipe(newSelectedIds[i], true);
                    }
                }
            }
        }
    }, [selectionBox.isSelecting]); 

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'q') setIsQPressed(true); };
        const handleKeyUp = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'q') { setIsQPressed(false); setGhostPos(null); } };
        window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, []);

    const { connections, trims } = useMemo(() => {
        const map: Record<string, ConnectionNode> = {};
        const pipeTrims: Record<string, { start: number, end: number }> = {};
        if (!Array.isArray(pipes)) return { connections: map, trims: pipeTrims };
        const getKey = (v: {x:number, y:number, z:number}) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
        pipes.forEach(pipe => {
            if (!pipe.start || !pipe.end) return;
            const startKey = getKey(pipe.start);
            const endKey = getKey(pipe.end);
            const startVec = new THREE.Vector3(pipe.start.x, pipe.start.y, pipe.start.z);
            const endVec = new THREE.Vector3(pipe.end.x, pipe.end.y, pipe.end.z);
            const dirFromStart = new THREE.Vector3().subVectors(endVec, startVec).normalize();
            const dirFromEnd = new THREE.Vector3().subVectors(startVec, endVec).normalize();
            if (!map[startKey]) map[startKey] = { point: startVec, connectedPipes: [] };
            map[startKey].connectedPipes.push({ pipe, vector: dirFromStart, isStart: true });
            if (!map[endKey]) map[endKey] = { point: endVec, connectedPipes: [] };
            map[endKey].connectedPipes.push({ pipe, vector: dirFromEnd, isStart: false });
            pipeTrims[pipe.id] = { start: 0, end: 0 };
        });
        Object.values(map).forEach(node => {
            if (node.connectedPipes.length === 2) {
                const p1 = node.connectedPipes[0];
                const p2 = node.connectedPipes[1];
                const dot = p1.vector.dot(p2.vector);
                if (dot > -0.99) {
                    const radius = Math.max(p1.pipe.diameter, p2.pipe.diameter) * 1.5;
                    if (p1.isStart) pipeTrims[p1.pipe.id].start = radius; else pipeTrims[p1.pipe.id].end = radius;
                    if (p2.isStart) pipeTrims[p2.pipe.id].start = radius; else pipeTrims[p2.pipe.id].end = radius;
                }
            }
        });
        return { connections: map, trims: pipeTrims };
    }, [pipes]);
    
    // Logic for Paste Mode: Intercept movement
    const handlePastePointerMove = (e: ThreeEvent<PointerEvent>) => {
        if (pastePreview && onPasteMove) {
            e.stopPropagation();
            const snap = (v:number) => Math.round(v * 2) / 2;
            const pt = e.point.clone();
            // Snap to grid
            pt.x = snap(pt.x);
            pt.y = snap(pt.y);
            pt.z = snap(pt.z);
            
            onPasteMove({ x: pt.x, y: pt.y, z: pt.z });
        }
    }

    const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
        if (isQPressed && !isDrawing) {
            e.stopPropagation();
            setGhostPos(e.point);
        } else {
            if (ghostPos) setGhostPos(null);
        }
    };

    const handleGlobalClick = (e: ThreeEvent<MouseEvent>) => {
        if (pastePreview && onPasteConfirm) {
            e.stopPropagation();
            onPasteConfirm();
            return;
        }

        if (isQPressed && onAddAnnotation) {
            e.stopPropagation();
            onAddAnnotation(e.point);
        }
    };

    const handlePipeClick = (e: ThreeEvent<MouseEvent>, pipe: PipeSegment) => {
        e.stopPropagation();
        
        // Se estiver em modo de colagem, o clique confirma a colagem (tratado no global ou aqui se clicar num tubo existente)
        if (pastePreview && onPasteConfirm) {
             onPasteConfirm();
             return;
        }

        if (isQPressed) {
             onAddAnnotation?.(e.point);
        } else {
            const isMulti = e.nativeEvent.ctrlKey || e.nativeEvent.metaKey || e.nativeEvent.shiftKey;
            onSelectPipe(pipe.id, isMulti);
        }
    };

    const spoolColors = useMemo(() => {
        const map: Record<string, string> = {};
        pipes.forEach(p => { if (p.spoolId && !map[p.spoolId]) map[p.spoolId] = stringToColor(p.spoolId); });
        return map;
    }, [pipes]);

    if (!Array.isArray(pipes)) return null;

    return (
        <>
            <OrbitControls 
                makeDefault 
                enabled={!isDragging && !selectionBox.isSelecting} 
                mouseButtons={{LEFT: -1 as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN}} 
                minDistance={0.1}
                maxDistance={5000}
                enableDamping={true} // Suaviza o movimento
                dampingFactor={0.05} // Fator de amortecimento
                zoomSpeed={4} // Aumentado para navegação rápida em cenas grandes
                rotateSpeed={0.8}
                panSpeed={1.5} // Aumentado para facilitar o reposicionamento em cenas grandes
            />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} castShadow />
            <Environment preset="city" />
            <Grid infiniteGrid fadeDistance={500} sectionColor="#475569" cellColor="#1e293b" position={[0, -0.01, 0]} onClick={handleGlobalClick} onPointerMove={handlePointerMove} />
            <axesHelper args={[2]} position={[-6, 0, -6]} />

            {/* PASTE PREVIEW GHOSTS */}
            {pastePreview && (
                <group>
                    {/* Invisible plane to catch mouse events everywhere during paste */}
                    <mesh 
                        visible={false} 
                        rotation={[-Math.PI / 2, 0, 0]} 
                        position={[0, 0, 0]} 
                        onPointerMove={handlePastePointerMove}
                        onClick={handleGlobalClick}
                    >
                        <planeGeometry args={[10000, 10000]} />
                    </mesh>

                    {pastePreview.map((pipe) => {
                        // Calcular conexões virtuais para o preview? 
                        // Por simplicidade, renderizamos apenas os segmentos retos fantasmas
                        return (
                            <PipeMesh 
                                key={pipe.id} 
                                data={pipe} 
                                isSelected={false} 
                                onSelect={() => {}} 
                                customColor="#facc15" // Yellow ghost
                                transparent={true}
                                opacity={0.5}
                            />
                        )
                    })}
                </group>
            )}


            {annotations.map(ann => (
                <AnnotationMarker 
                    key={ann.id} 
                    data={ann} 
                    onUpdate={onUpdateAnnotation!} 
                    onDelete={onDeleteAnnotation!}
                    isSelected={selectedIds.includes(ann.id)}
                    onSelect={onSelectPipe}
                />
            ))}
            
            {ghostPos && isQPressed && <GhostMarker position={ghostPos} />}

            {/* GIZMO DE TRANSFORMAÇÃO PARA MÚLTIPLOS OU ÚNICOS ITENS (TUBOS E ANOTAÇÕES) */}
            {onMovePipes && selectedIds.length > 0 && !isDrawing && !pastePreview && (
                <MultiSelectControls 
                    selectedIds={selectedIds} 
                    pipes={pipes} 
                    annotations={annotations}
                    onMovePipes={onMovePipes} 
                />
            )}

            <group>
                <Fittings 
                    pipes={pipes} 
                    connections={connections} 
                    onSelect={onSelectPipe} 
                    selectedIds={selectedIds} 
                    isQPressed={isQPressed}
                    onAnnotationClick={onAddAnnotation}
                    onPointerMove={handlePointerMove}
                />
                
                {pipes.map((pipe) => {
                    const isSelected = selectedIds.includes(pipe.id);
                    const trim = trims[pipe.id] || { start: 0, end: 0 };
                    let colorOverride = (colorMode === 'SPOOL' && pipe.spoolId) ? spoolColors[pipe.spoolId] : undefined;

                    // Mostra info label apenas se for seleção única e não estiver desenhando
                    const showLabel = isSelected && selectedIds.length === 1 && !isDrawing;

                    return (
                        <group key={pipe.id} onClick={(e) => handlePipeClick(e, pipe)} onPointerMove={handlePointerMove}>
                             <PipeMesh data={pipe} isSelected={isSelected} onSelect={() => {}} trimStart={trim.start} trimEnd={trim.end} customColor={colorOverride} />
                             
                             {showLabel && (
                                <Html position={[(pipe.start.x + pipe.end.x)/2, (pipe.start.y + pipe.end.y)/2 + 0.6, (pipe.start.z + pipe.end.z)/2]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'auto' }}>
                                    <div className="bg-slate-900/95 p-2 rounded-xl border border-slate-600 shadow-2xl backdrop-blur flex flex-col gap-2 min-w-[140px]" onPointerDown={(e) => e.stopPropagation()}>
                                         <div className="flex gap-1 justify-center mb-1">
                                            {ALL_STATUSES.map(status => (
                                                <button key={status} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpdatePipe({...pipe, status: status as PipeStatus})}} className={`w-6 h-6 rounded-full border-2 ${pipe.status === status ? 'border-white scale-110' : 'border-transparent opacity-70'}`} style={{backgroundColor: STATUS_COLORS[status]}} title={status} />
                                            ))}
                                         </div>
                                         <div className="text-[10px] text-center text-slate-400 font-mono bg-black/30 rounded px-1 py-0.5 border border-slate-700">{pipe.spoolId ? `Spool: ${pipe.spoolId}` : 'No Spool'}</div>
                                    </div>
                                </Html>
                             )}
                        </group>
                    );
                })}
            </group>
            <PipeDrawer isDrawing={isDrawing} onAddPipe={onAddPipe} onCancel={onCancelDraw} pipes={pipes} lockedAxis={lockedAxis} fixedLength={fixedLength} />
            <KeyboardManager selectedIds={selectedIds} pipes={pipes} onUpdatePipe={onUpdatePipe} onUndo={onUndo} onRedo={onRedo} />
            
            {isQPressed && !isDrawing && (
                <Html position={[0,0,0]} style={{pointerEvents:'none'}}>
                    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-full font-bold shadow-xl animate-pulse flex items-center gap-2 pointer-events-none">
                        <span>📍</span> CLIQUE PARA MARCAR
                    </div>
                </Html>
            )}
        </>
    );
}

const Scene: React.FC<SceneProps & { fixedLength?: boolean, onUndo?: ()=>void, onRedo?: ()=>void, colorMode?: 'STATUS'|'SPOOL', onMovePipes?: (d:any)=>void, onSetSelection?: (ids:string[])=>void, pastePreview?: PipeSegment[] | null, onPasteMove?: any, onPasteConfirm?: any }> = (props) => {
  const [lockedAxis, setLockedAxis] = useState<'x'|'y'|'z'|null>(null);
  const [selectionBox, setSelectionBox] = useState({ x: 0, y: 0, w: 0, h: 0, isSelecting: false, startX: 0, startY: 0 });

  useEffect(() => {
    if (!props.isDrawing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        if (k === 'x') setLockedAxis(c => c === 'x' ? null : 'x');
        if (k === 'c') setLockedAxis(c => c === 'y' ? null : 'y'); 
        if (k === 'z') setLockedAxis(c => c === 'z' ? null : 'z');
        if (k === 'shift') setLockedAxis('y'); 
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setLockedAxis(null); };
    window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [props.isDrawing]);

  // --- BOX SELECTION EVENT HANDLERS ON PARENT DIV ---
  const handleMouseDown = (e: React.MouseEvent) => {
      // Se estiver desenhando OU colando, não inicia box selection
      if (props.isDrawing || props.pastePreview || e.button !== 0) return;
      
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setSelectionBox({
          startX: x, startY: y,
          x, y, w: 0, h: 0,
          isSelecting: true
      });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!selectionBox.isSelecting) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      
      const x = Math.min(selectionBox.startX, currentX);
      const y = Math.min(selectionBox.startY, currentY);
      const w = Math.abs(currentX - selectionBox.startX);
      const h = Math.abs(currentY - selectionBox.startY);
      
      setSelectionBox(prev => ({ ...prev, x, y, w, h }));
  };

  const handleMouseUp = () => {
      if (selectionBox.isSelecting) {
          setSelectionBox(prev => ({ ...prev, isSelecting: false }));
          setTimeout(() => setSelectionBox({ x: 0, y: 0, w: 0, h: 0, isSelecting: false, startX: 0, startY: 0 }), 50);
      }
  };

  return (
    <div 
        className="w-full h-full bg-slate-900 relative rounded-lg overflow-hidden border border-slate-700 shadow-2xl flex flex-col select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
    >
      {/* BOX SELECTION OVERLAY */}
      {selectionBox.isSelecting && selectionBox.w > 0 && (
          <div 
            style={{
                position: 'absolute',
                left: selectionBox.x,
                top: selectionBox.y,
                width: selectionBox.w,
                height: selectionBox.h,
                border: '2px dashed #0ea5e9',
                backgroundColor: 'rgba(14, 165, 233, 0.2)',
                pointerEvents: 'none',
                zIndex: 50
            }}
          />
      )}

      <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="bg-black/60 text-white p-3 rounded-lg backdrop-blur-sm text-xs border border-white/10 select-none pointer-events-auto">
            {!props.isDrawing ? (
                <>
                    <p className="font-bold text-slate-300">Modo de Edição</p>
                    <p>Clique: Selecionar (Ctrl: Múltiplo)</p>
                    <p className="text-blue-400 font-bold">Arraste no fundo: Seleção em Caixa</p>
                    <p className="text-purple-400 font-bold">Segure Q + Clique: Marcar Obs.</p>
                    <p>Ctrl + C: Copiar Seleção</p>
                    <p>Ctrl + V: Colar (Mouse posiciona)</p>
                    <p>Ctrl + Z: Desfazer</p>
                    <p>Del: Excluir</p>
                    {props.colorMode === 'SPOOL' && <p className="text-green-400 font-bold mt-1">VISTA POR SPOOL ATIVA</p>}
                </>
            ) : (
                <>
                    <p className="font-bold text-blue-400">✏️ Desenhando</p>
                    <p>X, C (Y), Z: Travar Eixos</p>
                    <p>Esc: Cancelar</p>
                </>
            )}
          </div>
      </div>
      <div className="flex-1 relative">
          <Canvas camera={{ position: [8, 8, 8], fov: 50, near: 0.05, far: 5000 }} shadows gl={{ preserveDrawingBuffer: true, antialias: true }} onPointerMissed={(e) => {
              // Se clicar no vazio SEM arrastar (box w=0) e SEM colar, limpa seleção
              if (!props.isDrawing && !selectionBox.isSelecting && !props.pastePreview && e.type === 'click') {
                  props.onSelectPipe(null);
              }
          }}>
            <color attach="background" args={['#0f172a']} />
            <Suspense fallback={<Html center><Loader2 className="animate-spin text-white" /></Html>}>
                <SceneContent {...props} lockedAxis={lockedAxis} selectionBox={selectionBox} onSetSelectionBox={setSelectionBox} />
            </Suspense>
          </Canvas>
      </div>
    </div>
  );
};

export default Scene;