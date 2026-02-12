import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Text, Billboard } from '@react-three/drei';
import { PipeSegment } from '../../types';
import { STATUS_COLORS, INSULATION_COLORS } from '../../constants';

interface PipeMeshProps {
  data: PipeSegment;
  isSelected: boolean;
  onSelect: (id: string, multi: boolean) => void; 
  trimStart?: number;
  trimEnd?: number;
  customColor?: string; // New prop for overriding status color (e.g. Spool View)
  opacity?: number;
  transparent?: boolean;
}

const PipeMesh: React.FC<PipeMeshProps> = ({ data, isSelected, trimStart = 0, trimEnd = 0, customColor, opacity = 1, transparent = false }) => {
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

  // Use customColor if provided, else fall back to status color
  const color = customColor || ((STATUS_COLORS && STATUS_COLORS[data.status]) || '#888888');
  
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
            >
                <cylinderGeometry args={[data.diameter / 2, data.diameter / 2, geometryLength, 32]} />
                <meshStandardMaterial
                    color={color}
                    roughness={0.3}
                    metalness={0.6}
                    emissive={isSelected ? color : '#000000'}
                    emissiveIntensity={isSelected ? 0.5 : 0}
                    transparent={transparent}
                    opacity={opacity}
                />
            </mesh>
            
            {/* Length Label - Always facing camera (Billboard) and offset vertically in screen space */}
            {geometryLength > 0.5 && !transparent && (
                <Billboard position={position}>
                    <Text
                        position={[0, data.diameter/2 + 0.25, 0]} // Offset "Up" in billboard space (screen Y)
                        fontSize={0.25}
                        color="white"
                        anchorX="center"
                        anchorY="bottom"
                        outlineWidth={0.03}
                        outlineColor="#000000"
                        depthTest={false} // Ensure it renders on top of the pipe
                        renderOrder={1000}
                    >
                        {data.length.toFixed(2)}m
                    </Text>
                </Billboard>
            )}
            
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
                        opacity={transparent ? 0.15 : 0.3}
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