
import React, { useState, useEffect, useMemo } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Vector3 } from 'three';
import { Html } from '@react-three/drei';
import { PipeSegment } from '../../types';

interface PipeDrawerProps {
  isDrawing: boolean;
  onAddPipe: (start: {x:number, y:number, z:number}, end: {x:number, y:number, z:number}) => void;
  onCancel: () => void;
  pipes: PipeSegment[];
  lockedAxis: 'x' | 'y' | 'z' | null;
  fixedLength?: number; // 0 for free, or specific length like 6 or 12
}

// Helper: Calculate the closest point on a specific axis line to the mouse ray
const projectRayToAxis = (ray: THREE.Ray, origin: Vector3, axisDir: Vector3): Vector3 => {
    const w0 = new THREE.Vector3().subVectors(ray.origin, origin);
    const a = ray.direction.dot(ray.direction);
    const b = ray.direction.dot(axisDir);
    const c = axisDir.dot(axisDir);
    const d = ray.direction.dot(w0);
    const e = axisDir.dot(w0);

    const denom = a * c - b * b;
    
    if (denom < 0.00001) {
        return origin.clone().add(axisDir.clone().multiplyScalar(e));
    }

    const t = (a * e - b * d) / denom;
    
    return origin.clone().add(axisDir.clone().multiplyScalar(t));
};

export const PipeDrawer: React.FC<PipeDrawerProps> = ({ isDrawing, onAddPipe, onCancel, pipes, lockedAxis, fixedLength = 0 }) => {
  const [startPoint, setStartPoint] = useState<Vector3 | null>(null);
  const [endPoint, setEndPoint] = useState<Vector3>(new Vector3(0,0,0));
  const [snapPoint, setSnapPoint] = useState<Vector3 | null>(null);
  const { raycaster } = useThree();

  // Reset state when drawing mode changes
  useEffect(() => {
    if (!isDrawing) {
        setStartPoint(null);
        setSnapPoint(null);
    }
  }, [isDrawing]);

  // Calculate total length of existing pipes for the tooltip
  const existingTotalLength = useMemo(() => {
      return pipes.reduce((acc, pipe) => acc + (pipe.length || 0), 0);
  }, [pipes]);

  // Listen for Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
        if(e.key === 'Escape') {
            if (startPoint) setStartPoint(null); 
            else onCancel(); 
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, startPoint]);

  const snap = (val: number) => Math.round(val * 2) / 2;

  // Find snap target (points)
  const findSnapTarget = (): Vector3 | null => {
      if (!raycaster || !raycaster.ray) return null;

      let closest: Vector3 | null = null;
      // Increased threshold for easier connecting
      let minDist = 0.8; 

      const points: Vector3[] = [];
      if (Array.isArray(pipes)) {
        pipes.forEach(p => {
            if (p?.start && p?.end) {
                points.push(new Vector3(p.start.x, p.start.y, p.start.z));
                points.push(new Vector3(p.end.x, p.end.y, p.end.z));
            }
        });
      }

      points.forEach(pt => {
        const dist = raycaster.ray.distanceToPoint(pt);
        if (dist < minDist) {
            minDist = dist;
            closest = pt;
        }
      });
      return closest;
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDrawing) return;
    
    // 1. Calculate Snapping
    const snapped = findSnapTarget();
    setSnapPoint(snapped);

    // If we are just moving the mouse to pick a start point, and we snapped, show that
    if (!startPoint && snapped) {
        setEndPoint(snapped);
        return;
    }

    // 2. Calculate Raw Target based on Raycaster
    let target = new Vector3();
    
    if (!startPoint) {
        // Phase 1: Picking Start Point (Ground Plane interaction)
        if (e.point) {
             target.set(e.point.x, 0, e.point.z);
        }
    } else {
        // Phase 2: Picking End Point relative to Start Point
        if (!raycaster || !raycaster.ray) return;

        if (lockedAxis === 'x') {
            target = projectRayToAxis(raycaster.ray, startPoint, new Vector3(1, 0, 0));
            target.y = startPoint.y;
            target.z = startPoint.z;
        } 
        else if (lockedAxis === 'y') {
            target = projectRayToAxis(raycaster.ray, startPoint, new Vector3(0, 1, 0));
            target.x = startPoint.x;
            target.z = startPoint.z;
        }
        else if (lockedAxis === 'z') {
            target = projectRayToAxis(raycaster.ray, startPoint, new Vector3(0, 0, 1));
            target.x = startPoint.x;
            target.y = startPoint.y;
        }
        else {
            const h = startPoint.y;
            const Dy = raycaster.ray.direction.y;
            
            if (Math.abs(Dy) > 0.001) {
                const t = (h - raycaster.ray.origin.y) / Dy;
                if (t >= 0) {
                     const intersect = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(t));
                     target.set(intersect.x, h, intersect.z);
                } else {
                     target.set(e.point.x, h, e.point.z);
                }
            } else {
                 target.set(e.point.x, h, e.point.z);
            }
        }
    }

    // 3. Apply Grid Snapping
    target.x = snap(target.x);
    target.y = snap(target.y);
    target.z = snap(target.z);

    // 4. Apply Fixed Length Override
    if (fixedLength > 0 && startPoint) {
        const direction = new THREE.Vector3().subVectors(target, startPoint);
        if (direction.lengthSq() > 0.001) {
            direction.normalize().multiplyScalar(fixedLength); // Strict fixed length
            target.copy(startPoint).add(direction);
        }
    }

    // 5. Final Selection logic
    if (snapped && startPoint && fixedLength === 0) {
        setEndPoint(snapped);
    } else {
        setEndPoint(target);
    }
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isDrawing) return;
    e.stopPropagation();
    
    const pointToUse = (fixedLength > 0 && startPoint) ? endPoint : (snapPoint || endPoint);

    if (startPoint && startPoint.distanceTo(pointToUse) < 0.01) return;

    if (!startPoint) {
      setStartPoint(pointToUse);
    } else {
      onAddPipe(startPoint, pointToUse);
      setStartPoint(pointToUse); // Continuous drawing
    }
  };

  if (!isDrawing) return null;

  // Calculate Lengths for Display
  const currentSegmentLength = startPoint ? startPoint.distanceTo(endPoint) : 0;
  const projectTotalWithCurrent = existingTotalLength + currentSegmentLength;

  return (
    <group>
        {/* Invisible ground plane */}
        <mesh 
            visible={false} 
            rotation={[-Math.PI / 2, 0, 0]} 
            position={[0, 0, 0]} 
            onPointerMove={handlePointerMove}
            onClick={handleClick}
        >
            <planeGeometry args={[10000, 10000]} />
        </mesh>
        
        {/* Helper Visuals */}
        <>
            <mesh position={endPoint}>
                {/* Larger sphere when snapping to make it obvious */}
                <sphereGeometry args={[snapPoint ? 0.25 : 0.1, 16, 16]} />
                <meshBasicMaterial color={snapPoint ? "#facc15" : (fixedLength > 0 ? "#3b82f6" : "red")} opacity={0.8} transparent depthTest={false} />
            </mesh>
            
            {/* Snap Ring Highlight */}
            {snapPoint && (
                <mesh position={endPoint} rotation={[Math.PI/2,0,0]}>
                    <ringGeometry args={[0.3, 0.35, 32]} />
                    <meshBasicMaterial color="#facc15" side={THREE.DoubleSide} transparent opacity={0.8} depthTest={false} />
                </mesh>
            )}
            
            {/* Guide Lines */}
            {startPoint && (
                <>
                    <mesh position={startPoint}>
                        <sphereGeometry args={[0.12, 16, 16]} />
                        <meshBasicMaterial color="blue" />
                    </mesh>
                    <GhostLine start={startPoint} end={endPoint} color={fixedLength > 0 ? "#3b82f6" : "#06b6d4"} />
                </>
            )}

            {/* Height Line Reference */}
            {endPoint.y > 0.01 && (
                <lineSegments>
                     <bufferGeometry>
                        <float32BufferAttribute attach="attributes-position" count={2} itemSize={3} array={new Float32Array([
                            endPoint.x, endPoint.y, endPoint.z,
                            endPoint.x, 0, endPoint.z
                        ])} />
                     </bufferGeometry>
                     <lineDashedMaterial color="white" opacity={0.3} transparent dashSize={0.2} gapSize={0.1} />
                </lineSegments>
            )}
            
            {/* ETIQUETA FLUTUANTE MELHORADA */}
            <Html position={endPoint} style={{ pointerEvents: 'none' }} zIndexRange={[100, 0]}>
                <div className="bg-slate-900/95 text-white px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-xl transform -translate-x-1/2 -translate-y-full mt-[-30px] border-2 border-slate-700 font-mono flex flex-col gap-2 min-w-[180px]">
                    
                    {!startPoint && snapPoint && (
                        <div className="text-yellow-400 font-black mb-1 text-[12px] uppercase flex items-center justify-center gap-1 animate-pulse border-b border-white/10 pb-2">
                            <span>🔗</span> CONECTAR
                        </div>
                    )}

                    <div className="text-slate-500 text-[10px] font-bold">X:{endPoint.x.toFixed(2)} Y:{endPoint.y.toFixed(2)} Z:{endPoint.z.toFixed(2)}</div>
                    
                    {startPoint && (
                        <>
                         <div className="border-t border-slate-800 my-1"></div>
                         <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter">Segmento:</span>
                            <span className={`text-2xl font-black ${fixedLength > 0 ? 'text-blue-400' : 'text-white'}`}>
                                {currentSegmentLength.toFixed(2)}<span className="text-xs ml-0.5">m</span>
                                {fixedLength > 0 && <span className="text-xs ml-1">🔒</span>}
                            </span>
                         </div>
                         <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                            <span>Total Projeto:</span>
                            <span className="text-slate-300">{projectTotalWithCurrent.toFixed(2)}m</span>
                         </div>
                        </>
                    )}

                    {lockedAxis && (
                        <div className="text-blue-400 font-black mt-1 text-[10px] uppercase border-t border-white/10 pt-2 text-center tracking-widest">
                             TRAVA: EIXO {lockedAxis.toUpperCase()}
                        </div>
                    )}
                </div>
            </Html>
        </>
    </group>
  );
};

const GhostLine = ({ start, end, color }: { start: Vector3, end: Vector3, color: string }) => {
    const distance = start.distanceTo(end);
    if(distance < 0.01) return null;
    
    return (
        <lineSegments>
            <bufferGeometry>
                <float32BufferAttribute attach="attributes-position" count={2} itemSize={3} array={new Float32Array([
                    start.x, start.y, start.z,
                    end.x, end.y, end.z
                ])} />
            </bufferGeometry>
            <lineBasicMaterial color={color} linewidth={2} />
        </lineSegments>
    )
}
