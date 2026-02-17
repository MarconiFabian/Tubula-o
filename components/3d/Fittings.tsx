
import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import { PipeSegment, PipeStatus } from '../../types';
import { STATUS_COLORS, INSULATION_COLORS } from '../../constants';

interface FittingsProps {
  pipes: PipeSegment[];
  connections: Record<string, ConnectionNode>;
  onSelect: (id: string | null, multi?: boolean) => void;
  selectedIds: string[];
  isQPressed?: boolean;
  onAnnotationClick?: (point: THREE.Vector3) => void;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
}

export interface ConnectionNode {
  point: THREE.Vector3;
  connectedPipes: {
    pipe: PipeSegment;
    vector: THREE.Vector3; // Vector pointing AWAY from the node
    isStart: boolean;
  }[];
}

const getStatusLevel = (status: PipeStatus | string): number => {
  const s = String(status);
  if (s === 'PENDING') return 0;
  if (s === 'MOUNTED') return 1;
  if (s === 'WELDED') return 2;
  if (s === 'HYDROTEST') return 3;
  return 0;
}

const getColorForStatus = (status: PipeStatus | string) => {
    return STATUS_COLORS[String(status)] || '#888888';
};

export const Fittings: React.FC<FittingsProps> = ({ pipes, connections, onSelect, selectedIds, isQPressed, onAnnotationClick, onPointerMove }) => {
  
  const handleInteraction = (e: ThreeEvent<MouseEvent>, pipeId: string) => {
      e.stopPropagation();
      if (isQPressed && onAnnotationClick) {
          onAnnotationClick(e.point);
      } else {
          const isMulti = e.nativeEvent.ctrlKey || e.nativeEvent.metaKey || e.nativeEvent.shiftKey;
          onSelect(pipeId, isMulti);
      }
  };

  const fittings = useMemo(() => {
    const items: React.ReactElement[] = [];
    if (!connections) return items;

    Object.entries(connections).forEach(([key, rawNode]) => {
      const node = rawNode as ConnectionNode;

      if (node.connectedPipes.length < 2) return;

      if (node.connectedPipes.length === 2) {
        const p1 = node.connectedPipes[0];
        const p2 = node.connectedPipes[1];
        
        // Calcular o ângulo real entre os tubos
        // Como os vetores apontam para FORA do nó, o dot product de tubos retos é -1 (180 graus)
        const dot = p1.vector.dot(p2.vector);
        const angleRadians = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));
        const angleDegrees = Math.round(180 - (angleRadians * (180 / Math.PI)));
        
        const isStraight = angleDegrees < 1; 

        const radius = Math.max(p1.pipe.diameter, p2.pipe.diameter) * 1.5; 
        
        const level1 = getStatusLevel(p1.pipe.status);
        const level2 = getStatusLevel(p2.pipe.status);
        const smartSelectId = level1 <= level2 ? p1.pipe.id : p2.pipe.id;

        if (isStraight) {
          // --- CONEXÃO RETA (SOLDA DE TOPO) ---
          let weldColor = STATUS_COLORS['PENDING'] || '#888888';
          if (level1 >= 3 && level2 >= 3) {
            weldColor = STATUS_COLORS['HYDROTEST'] || '#3b82f6';
          } else if (level1 >= 2 && level2 >= 2) {
            weldColor = STATUS_COLORS['WELDED'] || '#22c55e';
          } else if (level1 >= 1 && level2 >= 1) {
            weldColor = STATUS_COLORS['MOUNTED'] || '#eab308';
          }

          const up = new THREE.Vector3(0, 1, 0);
          const quaternion = new THREE.Quaternion().setFromUnitVectors(up, p1.vector);
          const isSelected = selectedIds.includes(p1.pipe.id) || selectedIds.includes(p2.pipe.id);

          items.push(
            <group key={`weld-${key}`} position={node.point} quaternion={quaternion}>
               <WeldJoint 
                  radius={p1.pipe.diameter/2}
                  color={weldColor}
                  onClick={(e) => handleInteraction(e, smartSelectId)}
                  onPointerMove={onPointerMove}
                  isSelected={isSelected}
               />
            </group>
          );
        } else {
          // --- CURVA / COTOVELO ---
          const startPt = p1.vector.clone().multiplyScalar(radius);
          const endPt = p2.vector.clone().multiplyScalar(radius);
          const controlPt = new THREE.Vector3(0,0,0);
          const curve = new THREE.QuadraticBezierCurve3(startPt, controlPt, endPt);
          
          const bodyStatus = level1 < level2 ? p1.pipe.status : p2.pipe.status;
          const bodyColor = getColorForStatus(bodyStatus);

          const mainPipe = pipes.find(p => p.id === smartSelectId);
          const hasInsulation = mainPipe?.insulationStatus && mainPipe.insulationStatus !== 'NONE';
          const insulationColor = hasInsulation ? (INSULATION_COLORS[mainPipe?.insulationStatus!] || '#e2e8f0') : 'transparent';
          const isSelected = selectedIds.includes(p1.pipe.id) || selectedIds.includes(p2.pipe.id);

          items.push(
            <group key={`elbow-${key}`} position={node.point}>
              {/* Texto do Ângulo */}
              <Billboard position={[0, radius + 0.2, 0]}>
                <Text
                  fontSize={0.2}
                  color="#fbbf24"
                  anchorX="center"
                  anchorY="bottom"
                  fontStyle="italic"
                  fontWeight="bold"
                  outlineWidth={0.02}
                  outlineColor="#000"
                >
                  {angleDegrees}°
                </Text>
              </Billboard>

              {/* Corpo da Curva */}
              <mesh 
                onClick={(e) => handleInteraction(e, smartSelectId)}
                onPointerMove={onPointerMove}
                onPointerOver={() => document.body.style.cursor = 'pointer'}
                onPointerOut={() => document.body.style.cursor = 'auto'}
              >
                <tubeGeometry args={[curve, 16, p1.pipe.diameter / 2, 16, false]} />
                <meshStandardMaterial 
                  color={bodyColor} 
                  roughness={0.3} 
                  metalness={0.6}
                  emissive={isSelected ? bodyColor : '#000000'}
                  emissiveIntensity={isSelected ? 0.4 : 0}
                />
              </mesh>

              {hasInsulation && (
                  <mesh onPointerMove={onPointerMove} onClick={(e) => handleInteraction(e, smartSelectId)}>
                    <tubeGeometry args={[curve, 16, p1.pipe.diameter / 2 + 0.08, 16, false]} />
                    <meshStandardMaterial color={insulationColor} transparent opacity={0.3} roughness={0.1} metalness={0.1} depthWrite={false} side={THREE.DoubleSide} />
                  </mesh>
              )}

              {/* Soldas nas extremidades da curva */}
              <group position={startPt} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), p1.vector)}>
                <WeldJoint radius={p1.pipe.diameter/2} color={getColorForStatus(p1.pipe.status)} onClick={(e) => handleInteraction(e, p1.pipe.id)} onPointerMove={onPointerMove} isSelected={selectedIds.includes(p1.pipe.id)} />
              </group>

              <group position={endPt} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), p2.vector)}>
                <WeldJoint radius={p2.pipe.diameter/2} color={getColorForStatus(p2.pipe.status)} onClick={(e) => handleInteraction(e, p2.pipe.id)} onPointerMove={onPointerMove} isSelected={selectedIds.includes(p2.pipe.id)} />
              </group>
            </group>
          );
        }
      }
    });
    return items;
  }, [pipes, connections, selectedIds, isQPressed, onAnnotationClick, onPointerMove]);

  return <group>{fittings}</group>;
};

const WeldJoint = ({ radius, color, onClick, onPointerMove, isSelected }: { radius: number, color: string, onClick: (e: ThreeEvent<MouseEvent>) => void, onPointerMove?: (e: ThreeEvent<PointerEvent>) => void, isSelected?: boolean }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <mesh
            onClick={onClick}
            onPointerMove={onPointerMove}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
            scale={hovered ? 1.2 : 1}
        >
             <torusGeometry args={[radius + 0.015, 0.035, 12, 24]} />
             <meshStandardMaterial 
                color={hovered ? '#ffffff' : color} 
                roughness={0.5} 
                emissive={isSelected || hovered ? color : '#000000'}
                emissiveIntensity={isSelected || hovered ? 0.6 : 0}
             />
        </mesh>
    )
}
