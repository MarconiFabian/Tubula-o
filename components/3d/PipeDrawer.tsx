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
  fixedLength?: boolean;
}

// Helper: Calculate the closest point on a specific axis line to the mouse ray
// This avoids creating Plane objects which can cause NaN errors
const projectRayToAxis = (ray: THREE.Ray, origin: Vector3, axisDir: Vector3): Vector3 => {
    // We want to find the point on the line (origin + t * axisDir) that is closest to the ray.
    // This is essentially the distance between two skew lines.
    
    // Vector connecting ray origin to line origin
    const w0 = new THREE.Vector3().subVectors(ray.origin, origin);
    
    const a = ray.direction.dot(ray.direction); // always 1 if normalized
    const b = ray.direction.dot(axisDir);
    const c = axisDir.dot(axisDir); // always 1 if normalized
    const d = ray.direction.dot(w0);
    const e = axisDir.dot(w0);

    const denom = a * c - b * b;
    
    // If lines are parallel (denom ~ 0), just project to the closest point on the line from the ray origin
    if (denom < 0.00001) {
        return origin.clone().add(axisDir.clone().multiplyScalar(e));
    }

    // Closest point parameter on the axis line
    // FORMULA FIX: Previously (b*d - a*e) was inverted, causing axis mirroring.
    // Correct derivation for t: (a*e - b*d) / (a*c - b*b)
    const t = (a * e - b * d) / denom;
    
    return origin.clone().add(axisDir.clone().multiplyScalar(t));
};

export const PipeDrawer: React.FC<PipeDrawerProps> = ({ isDrawing, onAddPipe, onCancel, pipes, lockedAxis, fixedLength = false }) => {
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
      let minDist = 0.5;

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
        // Simple distance check to the ray
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
        // Default to y=0 plane
        if (e.point) {
             target.set(e.point.x, 0, e.point.z);
        }
    } else {
        // Phase 2: Picking End Point relative to Start Point
        
        // Safety: Ensure ray is valid
        if (!raycaster || !raycaster.ray) return;

        if (lockedAxis === 'x') {
            // Project ray to X axis line passing through startPoint
            target = projectRayToAxis(raycaster.ray, startPoint, new Vector3(1, 0, 0));
            // Force exact Y/Z alignment to avoid floating point drift
            target.y = startPoint.y;
            target.z = startPoint.z;
        } 
        else if (lockedAxis === 'y') {
            // Project ray to Y axis line
            target = projectRayToAxis(raycaster.ray, startPoint, new Vector3(0, 1, 0));
            target.x = startPoint.x;
            target.z = startPoint.z;
        }
        else if (lockedAxis === 'z') {
            // Project ray to Z axis line
            target = projectRayToAxis(raycaster.ray, startPoint, new Vector3(0, 0, 1));
            target.x = startPoint.x;
            target.y = startPoint.y;
        }
        else {
            // No Lock: Move on the horizontal plane at startPoint height
            // We use math plane intersection here, but strictly horizontal (safe)
            // Ray: P = O + tD
            // Plane: y = h
            // h = Oy + t * Dy  =>  t = (h - Oy) / Dy
            
            const h = startPoint.y;
            const Dy = raycaster.ray.direction.y;
            
            // Avoid division by zero (looking purely horizontal)
            if (Math.abs(Dy) > 0.001) {
                const t = (h - raycaster.ray.origin.y) / Dy;
                // If t < 0, intersection is behind camera, ignore
                if (t >= 0) {
                     const intersect = raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(t));
                     target.set(intersect.x, h, intersect.z);
                } else {
                     // Fallback to ground projection if looking up
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

    // 4. Apply Fixed Length Override (if enabled)
    // This MUST happen after grid snapping to ensure the direction is clean, 
    // but the final length is strict.
    if (fixedLength && startPoint) {
        const direction = new THREE.Vector3().subVectors(target, startPoint);
        if (direction.lengthSq() > 0.001) {
            direction.normalize().multiplyScalar(6.0); // Strict 6m
            target.copy(startPoint).add(direction);
        }
    }

    // 5. Final Selection logic (Geometric Snap vs Calculated Target)
    if (snapped && startPoint && !fixedLength) {
        // If free drawing, allow snapping to existing geometry
        setEndPoint(snapped);
    } else {
        // If fixed length, strict length wins over point snapping (unless we added sophisticated intersection logic)
        setEndPoint(target);
    }
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isDrawing) return;
    e.stopPropagation();
    
    // If fixed length is ON, use endPoint (calculated strict 6m), ignoring snapPoint if they conflict
    const pointToUse = (fixedLength && startPoint) ? endPoint : (snapPoint || endPoint);

    // Prevent zero-length pipes
    if (startPoint && startPoint.distanceTo(pointToUse) < 0.01) return;

    if (!startPoint) {
      setStartPoint(pointToUse);
    } else {
      onAddPipe(startPoint, pointToUse);
      setStartPoint(pointToUse); // Continuous drawing
    }
  };

  if (!isDrawing) return null;

  return (
    <group>
        {/* Invisible ground plane to catch mouse events for the initial calculation */}
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
                <sphereGeometry args={[snapPoint ? 0.2 : 0.1, 16, 16]} />
                <meshBasicMaterial color={snapPoint ? "#facc15" : (lockedAxis ? "#22c55e" : "red")} opacity={0.8} transparent depthTest={false} />
            </mesh>
            
            {/* Guide Lines */}
            {startPoint && (
                <>
                    <mesh position={startPoint}>
                        <sphereGeometry args={[0.12, 16, 16]} />
                        <meshBasicMaterial color="blue" />
                    </mesh>
                    <GhostLine start={startPoint} end={endPoint} color={lockedAxis ? "#22c55e" : "#06b6d4"} />
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
            
            <Html position={endPoint} style={{ pointerEvents: 'none' }}>
                <div className="bg-slate-900/90 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap transform -translate-x-1/2 -translate-y-full mt-[-20px] border border-slate-700 font-mono">
                    <div>
                        {endPoint.x.toFixed(1)}, {endPoint.y.toFixed(1)}, {endPoint.z.toFixed(1)}
                    </div>
                    {startPoint && (
                         <div className="text-slate-400 text-[10px] mt-0.5 border-t border-slate-700 pt-0.5">
                            L: {startPoint.distanceTo(endPoint).toFixed(2)}m
                            {fixedLength && <span className="text-purple-400 ml-1 font-bold">(FIXED)</span>}
                        </div>
                    )}
                    {lockedAxis && (
                        <div className="text-green-400 font-bold mt-0.5 text-[10px] uppercase">
                             LOCKED: {lockedAxis.toUpperCase()}
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
    
    // Use simple line instead of cylinder to avoid geometry math errors
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