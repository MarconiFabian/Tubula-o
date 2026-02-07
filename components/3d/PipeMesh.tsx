import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { PipeSegment } from '../../types';
import { STATUS_COLORS, INSULATION_COLORS } from '../../constants';

interface PipeMeshProps {
  data: PipeSegment;
  isSelected: boolean;
  onSelect: (id: string) => void;
  trimStart?: number; // Amount to shorten from start
  trimEnd?: number;   // Amount to shorten from end
}

const PipeMesh: React.FC<PipeMeshProps> = ({ data, isSelected, onSelect, trimStart = 0, trimEnd = 0 }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Calculate geometry and orientation
  const { position, rotation, length, geometryLength } = useMemo(() => {
    const start = new THREE.Vector3(data.start.x, data.start.y, data.start.z);
    const end = new THREE.Vector3(data.end.x, data.end.y, data.end.z);

    const fullLength = start.distanceTo(end);
    
    // Direction vector
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    
    // Calculate new start/end points based on trim
    // Actual Visual Start = Start + Direction * TrimStart
    // Actual Visual End = End - Direction * TrimEnd
    
    // We compute the center of the TRIMMED segment
    const effectiveStart = start.clone().add(direction.clone().multiplyScalar(trimStart));
    const effectiveEnd = end.clone().sub(direction.clone().multiplyScalar(trimEnd));
    
    // Safety check to prevent negative length
    let visualLength = effectiveStart.distanceTo(effectiveEnd);
    if (visualLength < 0.01) visualLength = 0.01;

    const midpoint = new THREE.Vector3().addVectors(effectiveStart, effectiveEnd).multiplyScalar(0.5);

    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
    const euler = new THREE.Euler().setFromQuaternion(quaternion);

    return {
      position: midpoint,
      rotation: euler,
      length: fullLength,
      geometryLength: visualLength
    };
  }, [data.start, data.end, trimStart, trimEnd]);

  const color = (STATUS_COLORS && STATUS_COLORS[data.status]) || '#888888';
  
  const hasInsulation = data.insulationStatus && data.insulationStatus !== 'NONE';
  const insulationColor = hasInsulation ? (INSULATION_COLORS[data.insulationStatus!] || '#e2e8f0') : 'transparent';

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(data.id);
  };

  return (
    <group>
      {/* The Main Pipe Cylinder */}
      {geometryLength > 0.01 && (
        <>
            <mesh
                ref={meshRef}
                position={position}
                rotation={rotation}
                onClick={handleClick}
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
            
            {/* Thermal Protection Layer (Transparent Glass/Gel Shell) */}
            {hasInsulation && (
                 <mesh
                    position={position}
                    rotation={rotation}
                    onClick={handleClick} // Pass click through
                 >
                    {/* Radius slightly larger (+0.08) for layering effect */}
                    <cylinderGeometry args={[data.diameter / 2 + 0.08, data.diameter / 2 + 0.08, geometryLength, 32]} />
                    <meshStandardMaterial
                        color={insulationColor}
                        transparent
                        opacity={0.3} // Low opacity to see the pipe status inside clearly
                        roughness={0.1} // Smooth/Shiny surface for glass effect
                        metalness={0.1}
                        side={THREE.DoubleSide}
                        depthWrite={false} // Important for transparency sorting
                    />
                 </mesh>
            )}
        </>
      )}
    </group>
  );
};

export default PipeMesh;