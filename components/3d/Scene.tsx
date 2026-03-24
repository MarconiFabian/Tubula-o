
import React, { useEffect, useState, useMemo, Suspense, useRef } from 'react';
import { Canvas, useThree, ThreeEvent, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, TransformControls, Html, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import PipeMesh from './PipeMesh';
import { PipeDrawer } from './PipeDrawer';
import { Fittings, ConnectionNode } from './Fittings';
import { AnnotationMarker, GhostMarker } from './AnnotationMarker';
import { SceneHelpers } from './SceneHelpers';
import { StatusLegend } from './StatusLegend';
import { PipeSegment, PipeStatus, Annotation, AccessoryType, AnnotationType, AccessoryStatus } from '../../types';
import { STATUS_COLORS, STATUS_LABELS, ALL_STATUSES } from '../../constants';
import { Loader2, UserCheck, Calendar, X, Info, Package } from 'lucide-react';

interface SceneProps {
  pipes: PipeSegment[];
  annotations?: Annotation[];
  selectedIds: string[]; 
  onSelectPipe: (id: string | null, multi?: boolean) => void;
  onSetSelection?: (ids: string[]) => void; // New optimized bulk selection handler
  isDrawing: boolean;
  onAddPipe: (start: {x:number, y:number, z:number}, end: {x:number, y:number, z:number}) => void;
  onAddAnnotation?: (pos: {x:number, y:number, z:number}) => void;
  onUpdateAnnotation?: (id: string, text: string, type?: AnnotationType, estimatedHours?: number) => void;
  onDeleteAnnotation?: (id: string) => void;
  onUpdatePipe: (pipe: PipeSegment) => void;
  onMovePipes?: (delta: {x:number, y:number, z:number}) => void;
  onCancelDraw: () => void;
  fixedLength?: number; // Alterado de boolean para number
  onUndo?: () => void;
  onRedo?: () => void;
  colorMode?: 'STATUS' | 'SPOOL';
  // Copy/Paste Props
  pastePreview?: PipeSegment[] | null;
  onPasteMove?: (pos: {x:number, y:number, z:number}) => void;
  onPasteConfirm?: () => void;
  snapAngle?: number;
  onSetSnapAngle?: (angle: number) => void;
  currentDiameter?: number;
  dynamicZoom?: boolean;
  placementMode?: AccessoryType | null;
  onAddAccessory?: (pipeId: string, type: AccessoryType, offset: number) => void;
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

/**
 * Componente de controle adaptativo que ajusta a velocidade do zoom e pan
 * baseado na distância da câmera ao alvo. Isso permite um controle preciso
 * em detalhes e rapidez em grandes modelos.
 */
const AdaptiveOrbitControls = ({ enabled, mouseButtons, dynamicZoom = false }: { enabled: boolean, mouseButtons: any, dynamicZoom?: boolean }) => {
    const { camera } = useThree();
    const controlsRef = useRef<any>(null);
    const [shiftPressed, setShiftPressed] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftPressed(true); };
        const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftPressed(false); };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useFrame(() => {
        if (controlsRef.current) {
            if (dynamicZoom || shiftPressed) {
                // Modo Dinâmico Ativo (ou via botão ou via Shift)
                const distance = camera.position.distanceTo(controlsRef.current.target);
                
                // Ajuste dinâmico da velocidade do Zoom
                // Aumentamos o mínimo para 0.8 para evitar a sensação de "travado"
                const dynamicZoomSpeed = Math.max(0.8, Math.min(5.0, distance * 0.05));
                controlsRef.current.zoomSpeed = dynamicZoomSpeed;

                // Ajuste dinâmico da velocidade do Pan
                const dynamicPanSpeed = Math.max(1.0, Math.min(3.5, distance * 0.025));
                controlsRef.current.panSpeed = dynamicPanSpeed;
            } else {
                // Modo Normal (Velocidades fixas aumentadas para 2.5 para fluidez total)
                controlsRef.current.zoomSpeed = 2.5;
                controlsRef.current.panSpeed = 2.0;
            }
        }
    });

    useEffect(() => {
        const handleFocus = (e: any) => {
            if (controlsRef.current && e.detail?.point) {
                const pt = e.detail.point;
                controlsRef.current.target.set(pt.x, pt.y, pt.z);
                controlsRef.current.update();
            }
        };
        const handleReset = () => {
            if (controlsRef.current) {
                controlsRef.current.reset();
                controlsRef.current.target.set(0, 0, 0);
                camera.position.set(15, 15, 15);
                controlsRef.current.update();
            }
        };
        window.addEventListener('FOCUS_OBJECT', handleFocus);
        window.addEventListener('RESET_CAMERA', handleReset);
        return () => {
            window.removeEventListener('FOCUS_OBJECT', handleFocus);
            window.removeEventListener('RESET_CAMERA', handleReset);
        };
    }, [camera]);

    return (
        <OrbitControls 
            ref={controlsRef}
            makeDefault 
            enabled={enabled} 
            mouseButtons={mouseButtons} 
            minDistance={0.01} 
            maxDistance={8000} 
            enableDamping={true} 
            dampingFactor={0.12} // Aumentado para resposta mais rápida (menos "deslize")
            rotateSpeed={0.8}
            screenSpacePanning={true} 
        />
    );
};

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

const SupportVisual = ({ pos, dir, actualUp, pipeDiameter, status }: { pos: THREE.Vector3, dir: THREE.Vector3, actualUp: THREE.Vector3, pipeDiameter: number, status: AccessoryStatus }) => {
    const isMounted = status === AccessoryStatus.MOUNTED;
    const isVertical = Math.abs(dir.y) > 0.8;
    
    if (isVertical) {
        // Suporte para tubos verticais (Guia/Abraçadeira de parede)
        return (
            <group position={pos}>
                {/* Abraçadeira (U-Bolt style) */}
                <mesh rotation={[Math.PI/2, 0, 0]}>
                    <torusGeometry args={[pipeDiameter + 0.05, 0.02, 8, 24]} />
                    <meshStandardMaterial color={isMounted ? "#cbd5e1" : "#334155"} />
                </mesh>
                {/* Braço de fixação horizontal */}
                <mesh position={[0.25, 0, 0]} rotation={[0, 0, Math.PI/2]}>
                    <boxGeometry args={[0.04, 0.5, 0.08]} />
                    <meshStandardMaterial 
                        color={isMounted ? "#cbd5e1" : "#334155"} 
                        emissive={isMounted ? "#3b82f6" : "#1e293b"} 
                        emissiveIntensity={isMounted ? 1.2 : 0.2}
                    />
                </mesh>
                {/* Placa de base na parede */}
                <mesh position={[0.5, 0, 0]}>
                    <boxGeometry args={[0.02, 0.3, 0.3]} />
                    <meshStandardMaterial color={isMounted ? "#475569" : "#1e293b"} />
                </mesh>
            </group>
        );
    } else {
        // Suporte para tubos horizontais (Pedestal/Berço)
        const offset = actualUp.clone().multiplyScalar(-(pipeDiameter + 0.2));
        
        // Alinhamento do berço com a direção do tubo
        // O berço deve ser perpendicular à direção do tubo se for um suporte de apoio simples,
        // mas aqui vamos alinhar o grupo com o 'actualUp'
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), actualUp);

        return (
            <group position={pos.clone().add(offset)} quaternion={quaternion}>
                {/* Base do suporte */}
                <mesh position={[0, -0.15, 0]}>
                    <boxGeometry args={[0.4, 0.1, 0.4]} />
                    <meshStandardMaterial color={isMounted ? "#475569" : "#1e293b"} />
                </mesh>
                {/* Haste vertical */}
                <mesh>
                    <boxGeometry args={[0.08, 0.4, 0.08]} />
                    <meshStandardMaterial 
                        color={isMounted ? "#cbd5e1" : "#334155"} 
                        emissive={isMounted ? "#3b82f6" : "#1e293b"} 
                        emissiveIntensity={isMounted ? 1.2 : 0.2}
                    />
                </mesh>
                {/* Berço (horizontal) */}
                <mesh position={[0, 0.2, 0]}>
                    <boxGeometry args={[pipeDiameter * 2.8, 0.08, 0.2]} />
                    <meshStandardMaterial color={isMounted ? "#94a3b8" : "#334155"} />
                </mesh>
            </group>
        );
    }
};

const ComponentMarkers = ({ pipe }: { pipe: PipeSegment }) => {
    const start = new THREE.Vector3(pipe.start.x, pipe.start.y, pipe.start.z);
    const end = new THREE.Vector3(pipe.end.x, pipe.end.y, pipe.end.z);
    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const length = start.distanceTo(end);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);
    const actualUp = new THREE.Vector3().crossVectors(right, dir).normalize();

    const markers: React.ReactNode[] = [];

    // Renderizar Suportes (Estruturas metálicas abaixo do tubo)
    if (pipe.supports && pipe.supports.total > 0) {
        for (let i = 0; i < pipe.supports.total; i++) {
            const t = (i + 1) / (pipe.supports.total + 1);
            const pos = new THREE.Vector3().lerpVectors(start, end, t);
            const isMounted = i < pipe.supports.installed;
            markers.push(
                <SupportVisual 
                    key={`support-${pipe.id}-${i}`} 
                    pos={pos} 
                    dir={dir} 
                    actualUp={actualUp} 
                    pipeDiameter={pipe.diameter} 
                    status={isMounted ? AccessoryStatus.MOUNTED : AccessoryStatus.PENDING} 
                />
            );
        }
    }

    // Renderizar Acessórios Manuais
    if (pipe.accessories && pipe.accessories.length > 0) {
        pipe.accessories.forEach((acc) => {
            const pos = new THREE.Vector3().lerpVectors(start, end, acc.offset);
            
            if (acc.type === 'SUPPORT') {
                markers.push(
                    <SupportVisual 
                        key={`acc-${acc.id}`} 
                        pos={pos} 
                        dir={dir} 
                        actualUp={actualUp} 
                        pipeDiameter={pipe.diameter} 
                        status={acc.status} 
                    />
                );
            }
        });
    }

    return <group>{markers}</group>;
};

const SceneContent: React.FC<SceneProps & { lockedAxis: 'x'|'y'|'z'|null, selectionBox: any, onSetSelectionBox: any, is45Mode: boolean, snapAngle: number, currentDiameter?: number, showDimensions?: boolean, dynamicZoom?: boolean }> = ({ 
  pipes, annotations = [], selectedIds, onSelectPipe, onSetSelection, isDrawing, onAddPipe, onUpdatePipe, onMovePipes, onCancelDraw, lockedAxis, fixedLength,
  onAddAnnotation, onUpdateAnnotation, onDeleteAnnotation, onUndo, onRedo,
  colorMode = 'STATUS', selectionBox, onSetSelectionBox,
  pastePreview, onPasteMove, onPasteConfirm, is45Mode, snapAngle, currentDiameter, showDimensions, dynamicZoom,
  placementMode, onAddAccessory
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
        const getKey = (v: {x:number, y:number, z:number}) => `${(v.x || 0).toFixed(3)},${(v.y || 0).toFixed(3)},${(v.z || 0).toFixed(3)}`;
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

        if (placementMode && onAddAccessory) {
            // Calcular o offset baseado no ponto de clique
            const start = new THREE.Vector3(pipe.start.x, pipe.start.y, pipe.start.z);
            const end = new THREE.Vector3(pipe.end.x, pipe.end.y, pipe.end.z);
            const clickPt = e.point;
            
            // Projeção do ponto no segmento
            const line = new THREE.Line3(start, end);
            const closestPt = new THREE.Vector3();
            line.closestPointToPoint(clickPt, true, closestPt);
            
            const distStart = start.distanceTo(closestPt);
            const totalDist = start.distanceTo(end);
            const offset = totalDist > 0 ? distStart / totalDist : 0;
            
            onAddAccessory(pipe.id, placementMode, offset);
            return;
        }

        if (isQPressed) {
             onAddAnnotation?.(e.point);
        } else {
            const isMulti = e.nativeEvent.ctrlKey || e.nativeEvent.metaKey || e.nativeEvent.shiftKey;
            onSelectPipe(pipe.id, isMulti);
        }
    };

    const handlePipeDoubleClick = (e: ThreeEvent<MouseEvent>, pipe: PipeSegment) => {
        e.stopPropagation();
        const center = {
            x: (pipe.start.x + pipe.end.x) / 2,
            y: (pipe.start.y + pipe.end.y) / 2,
            z: (pipe.start.z + pipe.end.z) / 2
        };
        window.dispatchEvent(new CustomEvent('FOCUS_OBJECT', { detail: { point: center } }));
    };

    const spoolColors = useMemo(() => {
        const map: Record<string, string> = {};
        pipes.forEach(p => { if (p.spoolId && !map[p.spoolId]) map[p.spoolId] = stringToColor(p.spoolId); });
        return map;
    }, [pipes]);

    if (!Array.isArray(pipes)) return null;

    return (
        <>
            <AdaptiveOrbitControls 
                enabled={!isDragging && !selectionBox.isSelecting} 
                mouseButtons={{LEFT: -1 as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN}} 
                dynamicZoom={dynamicZoom}
            />
            <ambientLight intensity={1.2} />
            <pointLight position={[20, 20, 20]} intensity={2.5} castShadow />
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
                    
                    // Cota persistente (se ativada)
                    const showDimension = showDimensions && !isDrawing;

                    return (
                        <group 
                            key={pipe.id} 
                            onClick={(e) => handlePipeClick(e, pipe)} 
                            onDoubleClick={(e) => handlePipeDoubleClick(e, pipe)}
                            onPointerMove={handlePointerMove}
                        >
                             <PipeMesh data={pipe} isSelected={isSelected} onSelect={() => {}} trimStart={trim.start} trimEnd={trim.end} customColor={colorOverride} />
                             
                             {/* Renderizar marcadores de componentes (válvulas, suportes, etc) */}
                             <ComponentMarkers pipe={pipe} />
                             
                             {showDimension && (
                                <Billboard position={[(pipe.start.x + pipe.end.x)/2, (pipe.start.y + pipe.end.y)/2 + 0.3, (pipe.start.z + pipe.end.z)/2]}>
                                    <Text
                                        fontSize={0.22}
                                        color="white"
                                        anchorX="center"
                                        anchorY="bottom"
                                        fontWeight="bold"
                                        outlineWidth={0.02}
                                        outlineColor="#000"
                                    >
                                        {(pipe.length || 0).toFixed(2)}m
                                    </Text>
                                </Billboard>
                             )}

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
            <PipeDrawer isDrawing={isDrawing} onAddPipe={onAddPipe} onCancel={onCancelDraw} pipes={pipes} lockedAxis={lockedAxis} fixedLength={fixedLength} is45Mode={is45Mode} snapAngle={snapAngle} currentDiameter={currentDiameter} />
            <KeyboardManager selectedIds={selectedIds} pipes={pipes} onUpdatePipe={onUpdatePipe} onUndo={onUndo} onRedo={onRedo} />
            
            {isQPressed && !isDrawing && (
                <Html position={[0,0,0]} style={{pointerEvents:'none'}}>
                    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-full font-bold shadow-xl animate-pulse flex items-center gap-2 pointer-events-none">
                        <span>📍</span> CLIQUE PARA MARCAR
                    </div>
                </Html>
            )}

            {placementMode && !isDrawing && (
                <Html position={[0,0,0]} style={{pointerEvents:'none'}}>
                    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full font-bold shadow-xl animate-pulse flex items-center gap-2 pointer-events-none">
                        <span>🔧</span> MODO DE POSICIONAMENTO: {placementMode}
                    </div>
                </Html>
            )}
        </>
    );
}

const Scene: React.FC<SceneProps & { fixedLength?: number, onUndo?: ()=>void, onRedo?: ()=>void, colorMode?: 'STATUS'|'SPOOL', onMovePipes?: (d:any)=>void, onSetSelection?: (ids:string[])=>void, pastePreview?: PipeSegment[] | null, onPasteMove?: any,  onPasteConfirm?: any, 
  snapAngle?: number, 
  onSetSnapAngle?: (angle: number) => void,
  showDimensions?: boolean,
  dynamicZoom?: boolean
}> = (props) => {
  const [lockedAxis, setLockedAxis] = useState<'x'|'y'|'z'|null>(null);
  const [selectionBox, setSelectionBox] = useState({ x: 0, y: 0, w: 0, h: 0, isSelecting: false, startX: 0, startY: 0 });
  const [showHelp, setShowHelp] = useState(false);

    const [is45Mode, setIs45Mode] = useState(false);

    useEffect(() => {
        if (!props.isDrawing) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase();
            if (k === 'h') setShowHelp(prev => !prev);
            if (k === 'x') setLockedAxis(c => c === 'x' ? null : 'x');
            if (k === 'c') setLockedAxis(c => c === 'y' ? null : 'y'); 
            if (k === 'z') setLockedAxis(c => c === 'z' ? null : 'z');
            if (k === 'shift') setLockedAxis('y'); 
            if (k === 'f') setIs45Mode(prev => !prev);
        };
        const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setLockedAxis(null); };
        window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, [props.isDrawing]);

    useEffect(() => {
        const handleGlobalH = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'h' && !props.isDrawing) setShowHelp(prev => !prev);
        };
        window.addEventListener('keydown', handleGlobalH);
        return () => window.removeEventListener('keydown', handleGlobalH);
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
                    <p className={`font-black ${is45Mode ? 'text-green-400' : 'text-slate-400'}`}>
                        F: Travar Ângulo ({is45Mode ? 'LIGADO' : 'DESLIGADO'})
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                        <span>Ângulo:</span>
                        <input 
                            type="number" 
                            value={props.snapAngle} 
                            onChange={(e) => props.onSetSnapAngle?.(parseFloat(e.target.value) || 0)}
                            className="w-12 bg-slate-800 border border-slate-600 rounded px-1 text-white"
                        />
                        <span>°</span>
                    </div>
                    <p>Esc: Cancelar</p>
                </>
            )}
          </div>
      </div>
      <div className="flex-1 relative">
          <StatusLegend />
          <Canvas camera={{ position: [8, 8, 8], fov: 50, near: 0.05, far: 5000 }} shadows gl={{ preserveDrawingBuffer: true, antialias: true }} onPointerMissed={(e) => {
              // Se clicar no vazio SEM arrastar (box w=0) e SEM colar, limpa seleção
              if (!props.isDrawing && !selectionBox.isSelecting && !props.pastePreview && e.type === 'click') {
                  props.onSelectPipe(null);
              }
          }}>
            <color attach="background" args={['#0f172a']} />
            <SceneHelpers />
            <Suspense fallback={<Html center><Loader2 className="animate-spin text-white" /></Html>}>
                <SceneContent {...props} lockedAxis={lockedAxis} is45Mode={is45Mode} selectionBox={selectionBox} onSetSelectionBox={setSelectionBox} snapAngle={props.snapAngle || 45} showDimensions={props.showDimensions} />
            </Suspense>
          </Canvas>
      </div>

      {/* HELP OVERLAY */}
      {showHelp && (
          <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-300">
              <div className="bg-slate-900 border border-blue-500/30 rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative">
                  <button onClick={() => setShowHelp(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"><X size={24}/></button>
                  <div className="flex items-center gap-4 mb-8">
                      <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-600/20"><Info className="text-white" size={24}/></div>
                      <div>
                          <h2 className="text-2xl font-bold text-white">Guia de Atalhos</h2>
                          <p className="text-slate-400 text-sm">Isometrico Manager v2.5</p>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-4">
                          <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest border-b border-slate-800 pb-2">Desenho (✏️)</h3>
                          <div className="space-y-2">
                              <div className="flex justify-between items-center"><span className="text-slate-300 text-sm">Travar Eixo X</span> <kbd className="bg-slate-800 px-2 py-1 rounded text-xs font-bold text-blue-400 border border-slate-700">X</kbd></div>
                              <div className="flex justify-between items-center"><span className="text-slate-300 text-sm">Travar Eixo Y (Vertical)</span> <kbd className="bg-slate-800 px-2 py-1 rounded text-xs font-bold text-blue-400 border border-slate-700">C</kbd></div>
                              <div className="flex justify-between items-center"><span className="text-slate-300 text-sm">Travar Eixo Z</span> <kbd className="bg-slate-800 px-2 py-1 rounded text-xs font-bold text-blue-400 border border-slate-700">Z</kbd></div>
                              <div className="flex justify-between items-center"><span className="text-slate-300 text-sm">Travar Ângulo (45°)</span> <kbd className="bg-slate-800 px-2 py-1 rounded text-xs font-bold text-blue-400 border border-slate-700">F</kbd></div>
                              <div className="flex justify-between items-center"><span className="text-slate-300 text-sm">Cancelar Desenho</span> <kbd className="bg-slate-800 px-2 py-1 rounded text-xs font-bold text-slate-400 border border-slate-700">ESC</kbd></div>
                          </div>
                      </div>
                      <div className="space-y-4">
                          <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest border-b border-slate-800 pb-2">Geral (🛠️)</h3>
                          <div className="space-y-2">
                              <div className="flex justify-between items-center"><span className="text-slate-300 text-sm">Copiar Seleção</span> <kbd className="bg-slate-800 px-2 py-1 rounded text-xs font-bold text-purple-400 border border-slate-700">CTRL+C</kbd></div>
                              <div className="flex justify-between items-center"><span className="text-slate-300 text-sm">Colar Seleção</span> <kbd className="bg-slate-800 px-2 py-1 rounded text-xs font-bold text-purple-400 border border-slate-700">CTRL+V</kbd></div>
                              <div className="flex justify-between items-center"><span className="text-slate-300 text-sm">Desfazer / Refazer</span> <kbd className="bg-slate-800 px-2 py-1 rounded text-xs font-bold text-purple-400 border border-slate-700">CTRL+Z / Y</kbd></div>
                              <div className="flex justify-between items-center"><span className="text-slate-300 text-sm">Anotação Rápida</span> <kbd className="bg-slate-800 px-2 py-1 rounded text-xs font-bold text-purple-400 border border-slate-700">Q + CLICK</kbd></div>
                              <div className="flex justify-between items-center"><span className="text-slate-300 text-sm font-bold text-blue-400">Focar em Tubo</span> <kbd className="bg-slate-800 px-2 py-1 rounded text-xs font-bold text-blue-400 border border-slate-700">DUPLO CLIQUE</kbd></div>
                              <div className="flex justify-between items-center"><span className="text-slate-300 text-sm">Abrir este Guia</span> <kbd className="bg-slate-800 px-2 py-1 rounded text-xs font-bold text-white border border-slate-700">H</kbd></div>
                          </div>
                      </div>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-slate-800 flex justify-center">
                      <button onClick={() => setShowHelp(false)} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-600/20">Entendi!</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Scene;
