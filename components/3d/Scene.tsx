import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, TransformControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import PipeMesh from './PipeMesh';
import { PipeDrawer } from './PipeDrawer';
import { Fittings, ConnectionNode } from './Fittings';
import { PipeSegment, PipeStatus } from '../../types';
import { STATUS_COLORS, INSULATION_COLORS, STATUS_LABELS, ALL_STATUSES } from '../../constants';
import { MoveHorizontal, MoveVertical, MoveDiagonal, X as XIcon, Shield, Loader2 } from 'lucide-react';

interface SceneProps {
  pipes: PipeSegment[];
  selectedIds: string[]; // Updated prop name
  onSelectPipe: (id: string | null, multi?: boolean) => void;
  isDrawing: boolean;
  onAddPipe: (start: {x:number, y:number, z:number}, end: {x:number, y:number, z:number}) => void;
  onUpdatePipe: (pipe: PipeSegment) => void;
  onCancelDraw: () => void;
  fixedLength?: boolean;
}

const KeyboardManager = ({ selectedIds, pipes, onUpdatePipe }: { selectedIds: string[], pipes: PipeSegment[], onUpdatePipe: (p: PipeSegment) => void }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
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
    }, [selectedIds, pipes, onUpdatePipe]);
    return null;
};

const SceneContent: React.FC<SceneProps & { lockedAxis: 'x'|'y'|'z'|null }> = ({ 
  pipes, selectedIds, onSelectPipe, isDrawing, onAddPipe, onUpdatePipe, onCancelDraw, lockedAxis, fixedLength
}) => {
    const { camera, gl } = useThree();
    const [isDragging, setIsDragging] = useState(false);
    
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

    const handleTransformEnd = (e: any) => {
        setIsDragging(false);
        const object = e.target.object;
        if (!object || selectedIds.length !== 1) return;
        
        const pipe = pipes.find(p => p.id === selectedIds[0]);
        if (!pipe) return;

        const oldMidX = (pipe.start.x + pipe.end.x) / 2;
        const oldMidY = (pipe.start.y + pipe.end.y) / 2;
        const oldMidZ = (pipe.start.z + pipe.end.z) / 2;

        const dx = object.position.x - oldMidX;
        const dy = object.position.y - oldMidY;
        const dz = object.position.z - oldMidZ;

        onUpdatePipe({
            ...pipe,
            start: { x: pipe.start.x + dx, y: pipe.start.y + dy, z: pipe.start.z + dz },
            end: { x: pipe.end.x + dx, y: pipe.end.y + dy, z: pipe.end.z + dz }
        });
        object.position.set(oldMidX, oldMidY, oldMidZ);
    };

    if (!Array.isArray(pipes)) return null;

    return (
        <>
            <OrbitControls makeDefault enabled={!isDragging} mouseButtons={{LEFT: -1 as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN}} />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} castShadow />
            <Environment preset="city" />
            <Grid infiniteGrid fadeDistance={30} sectionColor="#475569" cellColor="#1e293b" position={[0, -0.01, 0]} />
            <axesHelper args={[2]} position={[-6, 0, -6]} />

            <group>
                <Fittings pipes={pipes} connections={connections} onSelect={onSelectPipe} selectedIds={selectedIds} />
                {pipes.map((pipe) => {
                    const isSelected = selectedIds.includes(pipe.id);
                    const trim = trims[pipe.id] || { start: 0, end: 0 };
                    
                    if (isSelected && selectedIds.length === 1 && !isDrawing) {
                        const midX = (pipe.start.x + pipe.end.x) / 2;
                        const midY = (pipe.start.y + pipe.end.y) / 2;
                        const midZ = (pipe.start.z + pipe.end.z) / 2;
                        return (
                            <group key={pipe.id}>
                                <TransformControls mode="translate" onMouseDown={() => setIsDragging(true)} onMouseUp={handleTransformEnd} size={0.7}>
                                    <PipeMesh data={pipe} isSelected={true} onSelect={(id, multi) => onSelectPipe(id, multi)} trimStart={trim.start} trimEnd={trim.end} />
                                </TransformControls>
                                <Html position={[midX, midY + 0.6, midZ]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'auto' }}>
                                    <div className="bg-slate-900/95 p-2 rounded-xl border border-slate-600 shadow-2xl backdrop-blur flex gap-2" onPointerDown={(e) => e.stopPropagation()}>
                                         {ALL_STATUSES.map(status => (
                                            <button key={status} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpdatePipe({...pipe, status: status as PipeStatus})}} className={`w-6 h-6 rounded-full border-2 ${pipe.status === status ? 'border-white scale-110' : 'border-transparent opacity-70'}`} style={{backgroundColor: STATUS_COLORS[status]}} />
                                         ))}
                                    </div>
                                </Html>
                            </group>
                        );
                    }
                    return <PipeMesh key={pipe.id} data={pipe} isSelected={isSelected} onSelect={(id, multi) => onSelectPipe(id, multi)} trimStart={trim.start} trimEnd={trim.end} />;
                })}
            </group>
            <PipeDrawer isDrawing={isDrawing} onAddPipe={onAddPipe} onCancel={onCancelDraw} pipes={pipes} lockedAxis={lockedAxis} fixedLength={fixedLength} />
            <KeyboardManager selectedIds={selectedIds} pipes={pipes} onUpdatePipe={onUpdatePipe} />
        </>
    );
}

const Scene: React.FC<SceneProps & { fixedLength?: boolean }> = (props) => {
  const [lockedAxis, setLockedAxis] = useState<'x'|'y'|'z'|null>(null);
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

  return (
    <div className="w-full h-full bg-slate-900 relative rounded-lg overflow-hidden border border-slate-700 shadow-2xl flex flex-col">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="bg-black/60 text-white p-3 rounded-lg backdrop-blur-sm text-xs border border-white/10 select-none pointer-events-auto">
            {!props.isDrawing ? <><p className="font-bold text-slate-300">Modo de Edição</p><p>Clique: Selecionar (Ctrl: Múltiplo)</p><p>Del: Excluir</p></> : <><p className="font-bold text-blue-400">✏️ Desenhando</p><p>X, C (Y), Z: Travar Eixos</p><p>Esc: Cancelar</p></>}
          </div>
      </div>
      <div className="flex-1 relative">
          <Canvas camera={{ position: [8, 8, 8], fov: 50 }} shadows gl={{ preserveDrawingBuffer: true, antialias: true }} onPointerMissed={(e) => !props.isDrawing && e.type === 'click' && props.onSelectPipe(null)}>
            <color attach="background" args={['#0f172a']} />
            <Suspense fallback={<Html center><Loader2 className="animate-spin text-white" /></Html>}>
                <SceneContent {...props} lockedAxis={lockedAxis} />
            </Suspense>
          </Canvas>
      </div>
    </div>
  );
};

export default Scene;