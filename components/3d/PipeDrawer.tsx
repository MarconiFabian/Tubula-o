import React, { useState, useEffect, useRef } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Vector3, Plane } from 'three';
import { Html } from '@react-three/drei';
import { PipeSegment } from '../../types';

interface PipeDrawerProps {
  isDrawing: boolean;
  onAddPipe: (start: {x:number, y:number, z:number}, end: {x:number, y:number, z:number}) => void;
  onCancel: () => void;
  pipes: PipeSegment[];
  lockedAxis: 'x' | 'y' | 'z' | null;
}

export const PipeDrawer: React.FC<PipeDrawerProps> = ({ isDrawing, onAddPipe, onCancel, pipes, lockedAxis }) => {
  const [startPoint, setStartPoint] = useState<Vector3 | null>(null);
  const [endPoint, setEndPoint] = useState<Vector3>(new Vector3(0,0,0));
  const [snapPoint, setSnapPoint] = useState<Vector3 | null>(null);
  const { camera, raycaster } = useThree();

  // Listen for Escape to cancel
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

  const snap = (val: number) => Math.round(val * 2) / 2; // Snap to 0.5m

  // Find closest endpoint from existing pipes
  const findSnapTarget = (): Vector3 | null => {
      let closest: Vector3 | null = null;
      let minDist = 0.5; // Snap threshold

      const points: Vector3[] = [];
      pipes.forEach(p => {
          points.push(new Vector3(p.start.x, p.start.y, p.start.z));
          points.push(new Vector3(p.end.x, p.end.y, p.end.z));
      });

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
    
    // Check for snapping
    const snapped = findSnapTarget();
    setSnapPoint(snapped);

    if (snapped && !startPoint) {
        setEndPoint(snapped);
        return;
    }

    let target = new Vector3();
    const effectiveLock = lockedAxis;

    if (!startPoint) {
      // Phase 1: Start Point - Default to ground plane
      target.set(e.point.x, 0, e.point.z);
    } else {
      // Phase 2: End Point
      
      if (effectiveLock === 'y') {
         // Vertical Mode
         // Construct a plane passing through startPoint with normal facing camera but horizontal
         let normal = new Vector3().subVectors(camera.position, startPoint).setY(0);
         
         // Robustness for Top-Down view (if camera is directly above, normal length is 0)
         if (normal.lengthSq() < 0.01) {
             normal.set(1, 0, 0); // Arbitrary horizontal normal
         } else {
             normal.normalize();
         }
         
         const plane = new Plane().setFromNormalAndCoplanarPoint(normal, startPoint);
         const targetVec = new Vector3();
         raycaster.ray.intersectPlane(plane, targetVec);
         
         if (targetVec) {
            target.set(startPoint.x, targetVec.y, startPoint.z);
         } else {
             // Fallback if plane intersection fails (rare)
             target.copy(startPoint).setY(startPoint.y + (e.point.y - startPoint.y)); 
         }
      } 
      else if (effectiveLock === 'x') {
         // Lock Y and Z, vary X
         const plane = new Plane(new Vector3(0, 1, 0), -startPoint.y);
         const targetVec = new Vector3();
         raycaster.ray.intersectPlane(plane, targetVec);
         if(targetVec) {
             target.set(targetVec.x, startPoint.y, startPoint.z);
         }
      }
      else if (effectiveLock === 'z') {
         // Lock Y and X, vary Z
         const plane = new Plane(new Vector3(0, 1, 0), -startPoint.y);
         const targetVec = new Vector3();
         raycaster.ray.intersectPlane(plane, targetVec);
         if(targetVec) {
             target.set(startPoint.x, startPoint.y, targetVec.z);
         }
      }
      else {
        // No Lock: Planar (XZ) movement at startPoint height
        const plane = new Plane(new Vector3(0, 1, 0), -startPoint.y);
        const targetVec = new Vector3();
        raycaster.ray.intersectPlane(plane, targetVec);
        if (targetVec) {
             target.set(targetVec.x, startPoint.y, targetVec.z);
        }
      }
    }

    // Apply Snapping to grid
    target.x = snap(target.x);
    target.y = snap(target.y);
    target.z = snap(target.z);

    // If we have a geometric snap target, override calculated target
    // We only override if we are NOT strictly locking an axis, or if the snap point aligns.
    // For simplicity, snapping to geometry takes precedence as it's a direct user intent.
    if (snapped && startPoint) {
        setEndPoint(snapped);
    } else {
        setEndPoint(target);
    }
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isDrawing) return;
    e.stopPropagation();
    
    const pointToUse = snapPoint || endPoint;

    if (!startPoint) {
      setStartPoint(pointToUse);
    } else {
      if (startPoint.distanceTo(pointToUse) < 0.01) return;
      onAddPipe(startPoint, pointToUse);
      setStartPoint(pointToUse); // Chain drawing
    }
  };

  if (!isDrawing) return null;

  return (
    <group>
        <mesh 
            visible={false} 
            rotation={[-Math.PI / 2, 0, 0]} 
            position={[0, 0, 0]} 
            onPointerMove={handlePointerMove}
            onClick={handleClick}
        >
            <planeGeometry args={[1000, 1000]} />
        </mesh>
        
        {/* Visual Guides */}
        <>
            <mesh position={endPoint}>
                <sphereGeometry args={[snapPoint ? 0.2 : 0.1, 16, 16]} />
                <meshBasicMaterial color={snapPoint ? "#facc15" : (lockedAxis ? "#22c55e" : "red")} opacity={0.8} transparent />
            </mesh>
            
            {/* Height Reference Line */}
            {endPoint.y > 0.1 && (
                <lineSegments onUpdate={(line) => line.computeLineDistances()}>
                    <primitive object={new THREE.BufferGeometry().setFromPoints([
                        endPoint, 
                        new Vector3(endPoint.x, 0, endPoint.z)
                    ])} attach="geometry" />
                    <lineDashedMaterial attach="material" color="white" opacity={0.3} transparent dashSize={0.2} gapSize={0.1} />
                </lineSegments>
            )}

            {startPoint && (
                <mesh position={startPoint}>
                    <sphereGeometry args={[0.12, 16, 16]} />
                    <meshBasicMaterial color="blue" />
                </mesh>
            )}

            {startPoint && (
                <GhostLine start={startPoint} end={endPoint} color={lockedAxis ? "#22c55e" : "#06b6d4"} />
            )}
            
                <Html position={endPoint} style={{ pointerEvents: 'none' }}>
                <div className="bg-slate-900/90 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap transform -translate-x-1/2 -translate-y-full mt-[-20px] border border-slate-700">
                    <div className="font-mono">
                        {endPoint.x.toFixed(1)}, {endPoint.y.toFixed(1)}, {endPoint.z.toFixed(1)}
                    </div>
                    {startPoint && (
                         <div className="text-slate-400 text-[10px] mt-0.5 border-t border-slate-700 pt-0.5">
                            Comp: {startPoint.distanceTo(endPoint).toFixed(2)}m
                        </div>
                    )}
                    {lockedAxis && (
                        <div className="text-green-400 font-bold mt-0.5 text-[10px] uppercase">
                             TRAVA: {lockedAxis.toUpperCase()}
                        </div>
                    )}
                    {snapPoint && <div className="text-yellow-400 font-bold text-[10px]">ALVO</div>}
                </div>
            </Html>
        </>
    </group>
  );
};

const GhostLine = ({ start, end, color }: { start: Vector3, end: Vector3, color: string }) => {
    const distance = start.distanceTo(end);
    if(distance < 0.01) return null;
    
    const midpoint = new Vector3().addVectors(start, end).multiplyScalar(0.5);
    const direction = new Vector3().subVectors(end, start).normalize();
    const up = new Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
    
    return (
        <mesh position={midpoint} quaternion={quaternion}>
            <cylinderGeometry args={[0.08, 0.08, distance, 16]} />
            <meshBasicMaterial color={color} opacity={0.6} transparent depthTest={false} />
        </mesh>
    )
}