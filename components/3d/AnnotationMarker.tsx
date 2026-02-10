import React, { useState, useRef, useEffect } from 'react';
import { Html, Text, Billboard } from '@react-three/drei';
import { Annotation } from '../../types';
import * as THREE from 'three';
import { Check, X, Trash2 } from 'lucide-react';
import { ThreeEvent } from '@react-three/fiber';

interface AnnotationMarkerProps {
  data: Annotation;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string, multi: boolean) => void;
}

export const AnnotationMarker: React.FC<AnnotationMarkerProps> = ({ data, onUpdate, onDelete, isSelected, onSelect }) => {
  // Se o texto estiver vazio ao criar, começa em modo de edição
  const [isEditing, setIsEditing] = useState(data.text === '');
  const [inputText, setInputText] = useState(data.text);
  
  const handleSave = () => {
    if (inputText.trim() === '') {
        onDelete(data.id);
    } else {
        onUpdate(data.id, inputText);
        setIsEditing(false);
    }
  };

  const handleCancel = () => {
      if (data.text === '') {
          onDelete(data.id);
      } else {
          setInputText(data.text);
          setIsEditing(false);
      }
  };

  const handleMarkerClick = (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      if (onSelect) {
          const isMulti = e.nativeEvent.ctrlKey || e.nativeEvent.shiftKey || e.nativeEvent.metaKey;
          onSelect(data.id, isMulti);
      }
  };

  // Cor do marcador: Roxo (padrão) ou Laranja (selecionado)
  const markerColor = isSelected ? '#f97316' : '#9333ea'; // Orange-500 vs Purple-600

  return (
    <group position={[data.position.x, data.position.y, data.position.z]}>
      {/* Group para os elementos clicáveis de seleção (Cone e Esfera) */}
      <group onClick={handleMarkerClick}>
        {/* Visual Marker: Arrow/Cone pointing down */}
        <mesh position={[0, 0.25, 0]}>
            <coneGeometry args={[0.1, 0.5, 32]} />
            <meshStandardMaterial color={markerColor} emissive={markerColor} emissiveIntensity={isSelected ? 0.8 : 0.5} />
        </mesh>
        
        {/* Floating Sphere on top */}
        <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.08]} />
            <meshStandardMaterial color={markerColor} emissive={markerColor} emissiveIntensity={isSelected ? 0.5 : 0} />
        </mesh>
      </group>

      {/* TEXT DISPLAY OR EDIT MODE */}
      {isEditing ? (
          <Html position={[0, 0.8, 0]} center zIndexRange={[100, 0]}>
              <div className="bg-slate-900/90 p-2 rounded-lg border border-purple-500 shadow-xl min-w-[200px] backdrop-blur-sm flex flex-col gap-2 pointer-events-auto">
                  <textarea 
                    autoFocus
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Escreva a observação..."
                    className="bg-slate-800 text-white text-xs p-2 rounded border border-slate-600 outline-none focus:border-purple-500 w-full resize-none h-16"
                    onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) handleSave(); }}
                  />
                  <div className="flex justify-between gap-2">
                      <button onClick={() => onDelete(data.id)} className="p-1 bg-red-900/50 hover:bg-red-900 text-red-200 rounded" title="Excluir"><Trash2 size={14}/></button>
                      <div className="flex gap-2">
                        <button onClick={handleCancel} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded font-bold">Cancelar</button>
                        <button onClick={handleSave} className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded font-bold flex items-center gap-1"><Check size={12}/> Salvar</button>
                      </div>
                  </div>
              </div>
          </Html>
      ) : (
          <Billboard position={[0, 1.2, 0]}>
              {/* Background Panel for readability in 3D */}
              <mesh position={[0, 0, -0.01]} onClick={handleMarkerClick}>
                  <planeGeometry args={[inputText.length * 0.12 + 0.5, 0.6]} />
                  <meshBasicMaterial color={isSelected ? "#ea580c" : "#581c87"} opacity={0.9} transparent />
              </mesh>
              
              {/* 3D Text - Double click to edit, Single click to Select */}
              <Text
                fontSize={0.25}
                color="white"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor={isSelected ? "#ea580c" : "#9333ea"}
                onClick={handleMarkerClick}
                onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                onPointerOver={() => document.body.style.cursor = 'pointer'}
                onPointerOut={() => document.body.style.cursor = 'auto'}
              >
                {inputText}
              </Text>
          </Billboard>
      )}
      
      {/* Line connecting text to marker */}
      {!isEditing && (
          <lineSegments position={[0, 0.5, 0]}>
              <bufferGeometry>
                  <float32BufferAttribute attach="attributes-position" count={2} itemSize={3} array={new Float32Array([0,0,0, 0,0.5,0])} />
              </bufferGeometry>
              <lineBasicMaterial color={markerColor} />
          </lineSegments>
      )}
    </group>
  );
};

export const GhostMarker = ({ position }: { position: {x:number, y:number, z:number} }) => (
    <group position={[position.x, position.y, position.z]}>
        <mesh position={[0, 0.25, 0]}>
            <coneGeometry args={[0.1, 0.5, 32]} />
            <meshStandardMaterial color="#9333ea" transparent opacity={0.5} emissive="#9333ea" />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.08]} />
            <meshStandardMaterial color="#9333ea" transparent opacity={0.5} emissive="#9333ea" />
        </mesh>
    </group>
);