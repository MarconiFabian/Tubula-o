import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PipeSegment } from '../../types';
import { STATUS_COLORS, INSULATION_COLORS } from '../../constants';

interface PipeMeshProps {
  data: PipeSegment;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void; 
  trimStart?: number;
  trimEnd?: number;
}

const PipeMesh: React.FC<PipeMeshProps> = ({ data, isSelected, trimStart = 0, trimEnd = 0 }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Calculate geometry and orientation
  const { position, rotation, geometryLength } = useMemo(() => {
    const start = new THREE.Vector3(data.start.x, data.start.y, data.start.z);
    const end = new THREE.Vector3(data.end.x, data.end.y, data.end.z);

    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    
    // Calculate center of trimmed segment
    const effectiveStart = start.clone().add(direction.clone().multiplyScalar(trimStart));
    const effectiveEnd = end.clone().sub(direction.clone().multiplyScalar(trimEnd));
    
    let visualLength = effectiveStart.distanceTo(effectiveEnd);
    if (visualLength < 0.01) visualLength = 0.01;

    const midpoint = new THREE.Vector3().addVectors(effectiveStart, effectiveEnd).multiplyScalar(0.5);

    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
    const euler = new THREE.Euler().setFromQuaternion(quaternion);

    return {
      position: midpoint,
      rotation: euler,
      geometryLength: visualLength
    };
  }, [data.start, data.end, trimStart, trimEnd]);

  const color = (STATUS_COLORS && STATUS_COLORS[data.status]) || '#888888';
  
  const hasInsulation = data.insulationStatus && data.insulationStatus !== 'NONE';
  const insulationColor = hasInsulation ? (INSULATION_COLORS[data.insulationStatus!] || '#e2e8f0') : 'transparent';

  return (
    <group>
      {/* The Main Pipe Cylinder */}
      {geometryLength > 0.01 && (
        <>
            <mesh
                ref={meshRef}
                position={position}
                rotation={rotation}
                onPointerOver={() => document.body.style.cursor = 'pointer'}
                onPointerOut={() => document.body.style.cursor = 'auto'}
                // REMOVED onClick here to allow bubbling to parent Group in Scene.tsx
            >
                <cylinderGeometry args={[data.diameter / 2, data.diameter / 2, geometryLength, 32]} />
                <meshStandardMaterial
                    color={color}
                    roughness={0.3}
                    metalness={0.6}
                    emissive={isSelected ? color : '#000000'}
                    emissiveIntensity={isSelected ? 0.5 : 0}
                />
            </mesh>
            
            {/* Thermal Protection Layer */}
            {hasInsulation && (
                 <mesh
                    position={position}
                    rotation={rotation}
                    onPointerOver={() => document.body.style.cursor = 'pointer'}
                    onPointerOut={() => document.body.style.cursor = 'auto'}
                 >
                    <cylinderGeometry args={[data.diameter / 2 + 0.08, data.diameter / 2 + 0.08, geometryLength, 32]} />
                    <meshStandardMaterial
                        color={insulationColor}
                        transparent
                        opacity={0.3}
                        roughness={0.1}
                        metalness={0.1}
                        side={THREE.DoubleSide}
                        depthWrite={false}
                    />
                 </mesh>
            )}
        </>
      )}
    </group>
  );
};

export default PipeMesh;