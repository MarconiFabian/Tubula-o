
import React, { useState, useEffect, useMemo } from 'react';
import { ThreeEvent, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Vector3 } from 'three';
import { Html, Billboard, Text } from '@react-three/drei';
import { PipeSegment } from '../../types';

interface PipeDrawerProps {
  isDrawing: boolean;
  onAddPipe: (start: {x:number, y:number, z:number}, end: {x:number, y:number, z:number}) => void;
  onCancel: () => void;
  pipes: PipeSegment[];
  lockedAxis: 'x' | 'y' | 'z' | null;
  fixedLength?: number; // 0 for free, or specific length like 6 or 12
  is45Mode?: boolean;
  snapAngle?: number;
  currentDiameter?: number;
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

export const PipeDrawer: React.FC<PipeDrawerProps> = ({ isDrawing, onAddPipe, onCancel, pipes, lockedAxis, fixedLength = 0, is45Mode = false, snapAngle = 45, currentDiameter = 0.2 }) => {
  const [startPoint, setStartPoint] = useState<Vector3 | null>(null);
  const [endPoint, setEndPoint] = useState<Vector3>(new Vector3(0,0,0));
  const [snapPoint, setSnapPoint] = useState<Vector3 | null>(null);
  const { raycaster, mouse, camera } = useThree();

  // Calculate Angle relative to previous pipe
  const currentAngle = useMemo(() => {
    if (!startPoint || !endPoint || pipes.length === 0) return null;
    
    // Find a pipe connected to startPoint
    const connectedPipe = pipes.find(p => 
        new Vector3(p.end.x, p.end.y, p.end.z).distanceTo(startPoint) < 0.01 ||
        new Vector3(p.start.x, p.start.y, p.start.z).distanceTo(startPoint) < 0.01
    );

    if (!connectedPipe) return null;

    const p1Start = new Vector3(connectedPipe.start.x, connectedPipe.start.y, connectedPipe.start.z);
    const p1End = new Vector3(connectedPipe.end.x, connectedPipe.end.y, connectedPipe.end.z);
    
    // Vector of the existing pipe pointing AWAY from the joint
    const v1 = p1End.distanceTo(startPoint) < 0.01 
        ? new Vector3().subVectors(p1Start, p1End).normalize()
        : new Vector3().subVectors(p1End, p1Start).normalize();

    // Vector of the new pipe pointing AWAY from the joint
    const v2 = new Vector3().subVectors(endPoint, startPoint).normalize();

    const dot = v1.dot(v2);
    const angleRadians = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));
    const angleDegrees = Math.round(180 - (angleRadians * (180 / Math.PI)));
    
    return angleDegrees;
  }, [startPoint, endPoint, pipes]);

  // Pre-calculate directions safely based on snapAngle
  const snapDirections = useMemo(() => {
    const dirs: Vector3[] = [];
    const angleToSnap = Math.max(1, snapAngle || 45);

    // Generate multiples of the angle in the 3 primary planes
    for (let a = 0; a < 360; a += angleToSnap) {
        const rad = (a * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // XZ Plane (Horizontal)
        dirs.push(new Vector3(cos, 0, sin).normalize());
        // XY Plane (Vertical)
        dirs.push(new Vector3(cos, sin, 0).normalize());
        // YZ Plane (Vertical)
        dirs.push(new Vector3(0, cos, sin).normalize());
    }
    return dirs;
  }, [snapAngle]);

  // Continuous update of the endPoint using useFrame
  useFrame(() => {
    if (!isDrawing || !startPoint) return;

    // Update raycaster from current mouse position
    raycaster.setFromCamera(mouse, camera);

    let target = new Vector3();

    if (is45Mode) {
        // Exclusive Angle Snapping Logic - NO FALLBACK
        let bestTarget = new Vector3();
        let minDistance = Infinity;
        let found = false;

        // Filter directions based on locked axis (Plane Filtering)
        const filteredDirs = snapDirections.filter(dir => {
            if (lockedAxis === 'x') return Math.abs(dir.x) < 0.001; // Plane YZ
            if (lockedAxis === 'y') return Math.abs(dir.y) < 0.001; // Plane XZ
            if (lockedAxis === 'z') return Math.abs(dir.z) < 0.001; // Plane XY
            return true;
        });

        filteredDirs.forEach(dir => {
            const candidate = projectRayToAxis(raycaster.ray, startPoint, dir);
            const vecToCandidate = new Vector3().subVectors(candidate, startPoint);
            const dot = vecToCandidate.dot(dir);
            
            if (dot > 0.01) { 
                 const dist = raycaster.ray.distanceToPoint(candidate);
                 if (dist < minDistance) {
                     minDistance = dist;
                     bestTarget.copy(candidate);
                     found = true;
                 }
            }
        });

        if (found) {
            target.copy(bestTarget);
        } else {
            target.copy(startPoint);
        }
    }
    else if (lockedAxis === 'x') {
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
        // Free drawing on the horizontal plane of the start point
        const h = startPoint.y;
        const Dy = raycaster.ray.direction.y;
        
        if (Math.abs(Dy) > 0.001) {
            const t = (h - raycaster.ray.origin.y) / Dy;
            if (t >= 0) {
                 const intersect = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(t));
                 target.set(intersect.x, h, intersect.z);
            } else {
                 target.copy(startPoint);
            }
        } else {
             target.copy(startPoint);
        }
    }

    // Apply Grid Snapping (ONLY if angle snap is OFF)
    if (!is45Mode) {
        const snap = (val: number) => Math.round(val * 2) / 2;
        target.x = snap(target.x);
        target.y = snap(target.y);
        target.z = snap(target.z);
    }

    // Apply Fixed Length Override
    if (fixedLength > 0) {
        const direction = new THREE.Vector3().subVectors(target, startPoint);
        if (direction.lengthSq() > 0.001) {
            direction.normalize().multiplyScalar(fixedLength);
            target.copy(startPoint).add(direction);
        }
    }

    // Final point selection (respecting snapPoint if not in angle mode)
    if (snapPoint && fixedLength === 0 && !is45Mode) {
        setEndPoint(snapPoint);
    } else {
        setEndPoint(target);
    }
  });

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

  // Find snap target (points) - Keep this in onPointerMove for performance
  const findSnapTarget = (ray: THREE.Ray): Vector3 | null => {
      let closest: Vector3 | null = null;
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
        const dist = ray.distanceToPoint(pt);
        if (dist < minDist) {
            minDist = dist;
            closest = pt;
        }
      });
      return closest;
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDrawing) return;
    
    const snapped = findSnapTarget(raycaster.ray);
    setSnapPoint(snapped);

    if (!startPoint) {
        if (snapped) {
            setEndPoint(snapped);
        } else if (e.point) {
            const snap = (val: number) => Math.round(val * 2) / 2;
            setEndPoint(new Vector3(snap(e.point.x), 0, snap(e.point.z)));
        }
    }
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isDrawing) return;
    e.stopPropagation();
    
    // Use the current endPoint which is continuously updated by useFrame
    const pointToUse = endPoint.clone();

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
                <sphereGeometry args={[snapPoint && !is45Mode ? 0.25 : 0.1, 16, 16]} />
                <meshBasicMaterial color={snapPoint && !is45Mode ? "#facc15" : (fixedLength > 0 ? "#3b82f6" : "red")} opacity={0.8} transparent depthTest={false} />
            </mesh>
            
            {snapPoint && !is45Mode && (
                <mesh position={endPoint} rotation={[Math.PI/2,0,0]}>
                    <ringGeometry args={[0.3, 0.35, 32]} />
                    <meshBasicMaterial color="#facc15" side={THREE.DoubleSide} transparent opacity={0.8} depthTest={false} />
                </mesh>
            )}
            
            {startPoint && (
                <>
                    <mesh position={startPoint}>
                        <sphereGeometry args={[0.12, 16, 16]} />
                        <meshBasicMaterial color="blue" />
                    </mesh>
                    <GhostPipe start={startPoint} end={endPoint} diameter={currentDiameter} />
                    
                    {currentAngle !== null && currentAngle > 1 && (
                        <Billboard position={startPoint.clone().add(new Vector3(0, 0.5, 0))}>
                            <Text
                                fontSize={0.3}
                                color="#fbbf24"
                                anchorX="center"
                                anchorY="bottom"
                                fontStyle="italic"
                                fontWeight="bold"
                                outlineWidth={0.03}
                                outlineColor="#000"
                            >
                                {currentAngle}°
                            </Text>
                        </Billboard>
                    )}
                </>
            )}

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
            
            <Html position={endPoint} style={{ pointerEvents: 'none' }} zIndexRange={[100, 0]}>
                <div className="bg-slate-900/95 text-white px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-xl transform -translate-x-1/2 -translate-y-full mt-[-30px] border-2 border-slate-700 font-mono flex flex-col gap-2 min-w-[180px]">
                    
                    {!startPoint && snapPoint && (
                        <div className="text-yellow-400 font-black mb-1 text-[12px] uppercase flex items-center justify-center gap-1 animate-pulse border-b border-white/10 pb-2">
                            <span>🔗</span> CONECTAR
                        </div>
                    )}

                    <div className="text-slate-500 text-[10px] font-bold">X:{(endPoint.x || 0).toFixed(2)} Y:{(endPoint.y || 0).toFixed(2)} Z:{(endPoint.z || 0).toFixed(2)}</div>
                    
                    {startPoint && (
                        <>
                         <div className="border-t border-slate-800 my-1"></div>
                         <div className="flex justify-between items-center">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-tighter">Segmento:</span>
                            <span className={`text-2xl font-black ${fixedLength > 0 ? 'text-blue-400' : 'text-white'}`}>
                                {(currentSegmentLength || 0).toFixed(2)}<span className="text-xs ml-0.5">m</span>
                                {fixedLength > 0 && <span className="text-xs ml-1">🔒</span>}
                            </span>
                         </div>
                         <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                            <span>Total Projeto:</span>
                            <span className="text-slate-300">{(projectTotalWithCurrent || 0).toFixed(2)}m</span>
                         </div>
                        </>
                    )}

                    {is45Mode && (
                        <div className="text-green-400 font-black mt-1 text-[10px] uppercase border-t border-white/10 pt-2 text-center tracking-widest">
                             ÂNGULO TRAVADO: {snapAngle}°
                        </div>
                    )}
                </div>
            </Html>
        </>
    </group>
  );
};

const GhostPipe = ({ start, end, diameter }: { start: Vector3, end: Vector3, diameter: number }) => {
    const distance = start.distanceTo(end);
    if (distance < 0.01) return null;

    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);

    return (
        <mesh position={midpoint} quaternion={quaternion}>
            <cylinderGeometry args={[diameter / 2, diameter / 2, distance, 16]} />
            <meshStandardMaterial color="#06b6d4" transparent opacity={0.3} roughness={0.3} metalness={0.6} />
        </mesh>
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
