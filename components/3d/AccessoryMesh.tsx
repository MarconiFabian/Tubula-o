import React from 'react';
import * as THREE from 'three';
import { Accessory } from '../../types';

interface AccessoryMeshProps {
  data: Accessory;
  isSelected: boolean;
  onSelect: (id: string) => void;
  orientation?: THREE.Quaternion; // Orientação baseada no tubo pai
}

export const AccessoryMesh: React.FC<AccessoryMeshProps> = ({ data, isSelected, onSelect, orientation }) => {
  const color = isSelected ? '#ef4444' : (data.color || '#cccccc');
  const emissive = isSelected ? 0.5 : 0;

  const handlePointerOver = () => document.body.style.cursor = 'pointer';
  const handlePointerOut = () => document.body.style.cursor = 'auto';

  // O Quaternion alinha o Eixo Y do grupo com o Tubo.
  // Portanto, desenhamos tudo considerando que Y é o fluxo do tubo.
  const finalQuaternion = orientation ? orientation.clone() : new THREE.Quaternion();

  return (
    <group 
        position={[data.position.x, data.position.y, data.position.z]} 
        quaternion={finalQuaternion}
        onClick={(e) => { e.stopPropagation(); onSelect(data.id); }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
    >
      {/* --- VÁLVULA --- */}
      {data.type === 'VALVE' && (
        <group>
            {/* Corpo Central (Esfera) */}
            <mesh>
                <sphereGeometry args={[0.12]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} />
            </mesh>
            
            {/* Conectores (Alinhados com Y - Fluxo) */}
            <mesh position={[0, 0.14, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 0.1]} />
                <meshStandardMaterial color="#64748b" />
            </mesh>
             <mesh position={[0, -0.14, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 0.1]} />
                <meshStandardMaterial color="#64748b" />
            </mesh>

            {/* Haste (Apontando para Z - Perpendicular ao fluxo) */}
            <mesh position={[0, 0, 0.15]} rotation={[Math.PI/2, 0, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.3]} />
                <meshStandardMaterial color="#94a3b8" />
            </mesh>

            {/* Manopla (No topo da haste) */}
            <mesh position={[0, 0, 0.3]} rotation={[0, 0, 0]}>
                <torusGeometry args={[0.12, 0.02, 8, 16]} />
                <meshStandardMaterial color="#ef4444" />
            </mesh>
        </group>
      )}

      {/* --- FLANGE --- */}
      {data.type === 'FLANGE' && (
         <group>
             {/* Disco Principal (Concêntrico ao Y) */}
             <mesh>
                <cylinderGeometry args={[0.18, 0.18, 0.05, 24]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} />
             </mesh>
             {/* Pescoço */}
             <mesh position={[0, -0.05, 0]}>
                 <cylinderGeometry args={[0.16, 0.15, 0.05, 24]} />
                 <meshStandardMaterial color={color} />
             </mesh>
             {/* Parafusos (Visual) */}
             {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                 <mesh key={i} position={[Math.cos(i * Math.PI/4) * 0.14, 0.03, Math.sin(i * Math.PI/4) * 0.14]}>
                     <cylinderGeometry args={[0.015, 0.015, 0.02]} />
                     <meshStandardMaterial color="#334155" />
                 </mesh>
             ))}
         </group>
      )}

      {/* --- SUPORTE --- */}
      {data.type === 'SUPPORT' && (
        <group> 
            {/* Grampo U (Abraça o eixo Y) */}
            {/* Rotacionamos 90 no X para o Torus ficar de pé em relação ao Y */}
            <mesh rotation={[Math.PI/2, 0, 0]}>
                 <torusGeometry args={[0.16, 0.02, 8, 16, Math.PI]} />
                 <meshStandardMaterial color={color} emissive={color} emissiveIntensity={emissive} />
            </mesh>
            
            {/* Perna do Suporte */}
            {/* Apontando para o eixo X Local (Geralmente para baixo/lado dependendo da rotação do tubo) */}
            <mesh position={[0.3, 0, 0]} rotation={[0, 0, Math.PI/2]}>
                <boxGeometry args={[0.05, 0.4, 0.05]} />
                <meshStandardMaterial color="#fbbf24" />
            </mesh>

            {/* Base da Perna */}
            <mesh position={[0.5, 0, 0]} rotation={[0, 0, Math.PI/2]}>
                <boxGeometry args={[0.02, 0.3, 0.3]} />
                <meshStandardMaterial color="#fbbf24" />
            </mesh>
        </group>
      )}
    </group>
  );
};
