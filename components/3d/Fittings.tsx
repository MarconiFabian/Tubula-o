import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { PipeSegment, PipeStatus } from '../../types';
import { STATUS_COLORS } from '../../constants';

interface FittingsProps {
  pipes: PipeSegment[];
  connections: Record<string, ConnectionNode>;
  onSelect: (id: string | null) => void;
  selectedId: string | null;
}

export interface ConnectionNode {
  point: THREE.Vector3;
  connectedPipes: {
    pipe: PipeSegment;
    vector: THREE.Vector3; // Vector pointing AWAY from the node
    isStart: boolean;
  }[];
}

// Helper to determine status level
const getStatusLevel = (status: PipeStatus): number => {
  switch (status) {
    case PipeStatus.PENDING: return 0;
    case PipeStatus.MOUNTED: return 1;
    case PipeStatus.WELDED: return 2;
    case PipeStatus.HYDROTEST: return 3;
    default: return 0;
  }
}

// Helper to get color based on status level
const getColorForStatus = (status: PipeStatus) => {
    return STATUS_COLORS[status];
};

export const Fittings: React.FC<FittingsProps> = ({ pipes, connections, onSelect, selectedId }) => {
  const fittings = useMemo(() => {
    const items: React.ReactElement[] = [];

    // Safety check for undefined connections
    if (!connections) return items;

    Object.entries(connections).forEach(([key, node]) => {
      // 1. End Cap / Open End (1 pipe)
      if (node.connectedPipes.length < 2) return;

      // 2. Simple Connection (2 pipes)
      if (node.connectedPipes.length === 2) {
        const p1 = node.connectedPipes[0];
        const p2 = node.connectedPipes[1];
        
        const dot = p1.vector.dot(p2.vector);
        const isStraight = dot < -0.99; // Approx 180 degrees

        const radius = Math.max(p1.pipe.diameter, p2.pipe.diameter) * 1.5; 
        
        // Smart Selection: When clicking a joint/fitting, select the pipe with the LOWEST status (the bottleneck)
        // If equal, prefer p1.
        const level1 = getStatusLevel(p1.pipe.status);
        const level2 = getStatusLevel(p2.pipe.status);
        const smartSelectId = level1 <= level2 ? p1.pipe.id : p2.pipe.id;

        if (isStraight) {
          // --- STRAIGHT JOINT (Junta Reta) ---
          
          let weldColor = STATUS_COLORS[PipeStatus.PENDING];
          
          // Logic: Combined status for butt weld. Both sides need to be ready.
          if (level1 >= 3 && level2 >= 3) {
            weldColor = STATUS_COLORS[PipeStatus.HYDROTEST];
          } else if (level1 >= 2 && level2 >= 2) {
            weldColor = STATUS_COLORS[PipeStatus.WELDED];
          } else if (level1 >= 1 && level2 >= 1) {
            weldColor = STATUS_COLORS[PipeStatus.MOUNTED];
          }

          const up = new THREE.Vector3(0, 1, 0);
          const quaternion = new THREE.Quaternion().setFromUnitVectors(up, p1.vector);
          
          // Highlight weld if either connected pipe is selected
          const isSelected = selectedId === p1.pipe.id || selectedId === p2.pipe.id;

          items.push(
            <group 
                key={`weld-${key}`} 
                position={node.point} 
                quaternion={quaternion}
            >
               <WeldJoint 
                  radius={p1.pipe.diameter/2}
                  color={weldColor}
                  onClick={() => onSelect(smartSelectId)}
                  isSelected={isSelected}
                  isStraight={true}
               />
            </group>
          );
        } else {
          // --- ELBOW (Curva) ---
          
          const startPt = p1.vector.clone().multiplyScalar(radius);
          const endPt = p2.vector.clone().multiplyScalar(radius);
          const controlPt = new THREE.Vector3(0,0,0);

          const curve = new THREE.QuadraticBezierCurve3(startPt, controlPt, endPt);
          
          // Elbow Body Color: Warns about the lowest status (Bottleneck visualization)
          const bodyStatus = level1 < level2 ? p1.pipe.status : p2.pipe.status;
          const bodyColor = STATUS_COLORS[bodyStatus];

          // Independent Weld Colors
          const weld1Color = getColorForStatus(p1.pipe.status);
          const weld2Color = getColorForStatus(p2.pipe.status);
          
          // Selection Highlight Logic
          const isSelected = selectedId === p1.pipe.id || selectedId === p2.pipe.id;

          items.push(
            <group 
                key={`elbow-${key}`} 
                position={node.point}
            >
              {/* Elbow Body */}
              <mesh 
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(smartSelectId); 
                }}
                onPointerOver={() => document.body.style.cursor = 'pointer'}
                onPointerOut={() => document.body.style.cursor = 'auto'}
              >
                <tubeGeometry args={[curve, 10, p1.pipe.diameter / 2, 16, false]} />
                <meshStandardMaterial 
                  color={bodyColor} 
                  roughness={0.3} 
                  metalness={0.6}
                  emissive={isSelected ? bodyColor : '#000000'}
                  emissiveIntensity={isSelected ? 0.4 : 0}
                />
              </mesh>

              {/* Weld 1: Connecting Pipe 1 to Elbow */}
              <group position={startPt} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), p1.vector)}>
                <WeldJoint 
                    radius={p1.pipe.diameter/2} 
                    color={weld1Color}
                    onClick={() => onSelect(p1.pipe.id)} // Clicking this specific ring selects Pipe 1
                    isSelected={selectedId === p1.pipe.id}
                />
              </group>

              {/* Weld 2: Connecting Pipe 2 to Elbow */}
              <group position={endPt} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), p2.vector)}>
                <WeldJoint 
                    radius={p2.pipe.diameter/2} 
                    color={weld2Color}
                    onClick={() => onSelect(p2.pipe.id)} // Clicking this specific ring selects Pipe 2
                    isSelected={selectedId === p2.pipe.id}
                />
              </group>
            </group>
          );
        }
      }
      // 3. Tee / Cross (>2 pipes)
      else {
         items.push(
            <mesh key={`tee-${key}`} position={node.point}>
                <sphereGeometry args={[node.connectedPipes[0].pipe.diameter * 0.8]} />
                <meshStandardMaterial color="#555" />
            </mesh>
         );
      }
    });

    return items;
  }, [pipes, connections, onSelect, selectedId]);

  return <group>{fittings}</group>;
};

// Interactive Weld Joint Component
const WeldJoint = ({ radius, color, onClick, isSelected, isStraight = false }: { radius: number, color: string, onClick: () => void, isSelected?: boolean, isStraight?: boolean }) => {
    const [hovered, setHovered] = useState(false);

    return (
        <mesh
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
            scale={hovered ? 1.2 : 1} // Visual feedback on hover
        >
             {/* Ring geometry slightly larger than pipe */}
             <torusGeometry args={[radius + 0.015, 0.035, 12, 24]} />
             <meshStandardMaterial 
                color={hovered ? '#ffffff' : color} // Highlights white on hover, otherwise status color
                roughness={0.5} 
                emissive={isSelected || hovered ? color : '#000000'}
                emissiveIntensity={isSelected || hovered ? 0.6 : 0}
             />
        </mesh>
    )
}