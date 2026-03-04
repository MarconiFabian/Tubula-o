import React, { useState, useRef, useEffect } from 'react';
import { Html, Text, Billboard } from '@react-three/drei';
import { Annotation, AnnotationType } from '../../types';
import * as THREE from 'three';
import { Check, X, Trash2, Construction, MessageSquare, Truck, Layers, Clock } from 'lucide-react';
import { ThreeEvent } from '@react-three/fiber';

interface AnnotationMarkerProps {
  data: Annotation;
  onUpdate: (id: string, text: string, type?: AnnotationType, estimatedHours?: number) => void;
  onDelete: (id: string) => void;
  isSelected?: boolean;
  onSelect?: (id: string, multi: boolean) => void;
}

export const AnnotationMarker: React.FC<AnnotationMarkerProps> = ({ data, onUpdate, onDelete, isSelected, onSelect }) => {
  // Se o texto estiver vazio ao criar, começa em modo de edição
  const [isEditing, setIsEditing] = useState(data.text === '');
  const [inputText, setInputText] = useState(data.text);
  const [type, setType] = useState<AnnotationType>(data.type || AnnotationType.COMMENT);
  const [hours, setHours] = useState<string>(data.estimatedHours?.toString() || '0');
  
  const handleSave = () => {
    const numHours = parseFloat(hours) || 0;
    if (inputText.trim() === '' && type === AnnotationType.COMMENT) {
        onDelete(data.id);
    } else {
        onUpdate(data.id, inputText, type, numHours);
        setIsEditing(false);
    }
  };

  const handleCancel = () => {
      if (data.text === '' && !data.type) {
          onDelete(data.id);
      } else {
          setInputText(data.text);
          setType(data.type || AnnotationType.COMMENT);
          setHours(data.estimatedHours?.toString() || '0');
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

  // Cor do marcador: Roxo (comentário), Amarelo (andaime), Azul (guindaste), Vermelho (balanço)
  const getMarkerConfig = () => {
    switch(type) {
        case AnnotationType.SCAFFOLD: return { color: '#eab308', icon: '🚧', label: 'ANDAIME' };
        case AnnotationType.SCAFFOLD_CANTILEVER: return { color: '#ef4444', icon: '🏗️', label: 'BALANÇO' };
        case AnnotationType.CRANE: return { color: '#3b82f6', icon: '🚜', label: 'GUINDASTE' };
        default: return { color: '#9333ea', icon: '💬', label: 'OBS' };
    }
  };

  const { color: baseColor, icon: typeIcon, label: typeLabel } = getMarkerConfig();
  const markerColor = isSelected ? '#f97316' : baseColor; 

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

        {/* Special Visual Indicators */}
        {(type === AnnotationType.SCAFFOLD || type === AnnotationType.SCAFFOLD_CANTILEVER) && (
            <mesh position={[0, 0.3, 0]}>
                <boxGeometry args={[0.4, 0.4, 0.4]} />
                <meshStandardMaterial color={markerColor} wireframe opacity={0.5} transparent />
            </mesh>
        )}
        {type === AnnotationType.CRANE && (
             <mesh position={[0, 0.3, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.4, 6]} />
                <meshStandardMaterial color={markerColor} wireframe opacity={0.5} transparent />
            </mesh>
        )}
      </group>

      {/* TEXT DISPLAY OR EDIT MODE */}
      {isEditing ? (
          <Html position={[0, 0.8, 0]} center zIndexRange={[100, 0]}>
              <div className="bg-slate-900/95 p-4 rounded-xl border border-slate-700 shadow-2xl min-w-[300px] backdrop-blur-md flex flex-col gap-3 pointer-events-auto">
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-800 rounded-lg">
                      <button 
                        onClick={() => setType(AnnotationType.COMMENT)}
                        className={`flex items-center justify-center gap-1 py-2 rounded-md text-[9px] font-bold transition-all ${type === AnnotationType.COMMENT ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
                      >
                          <MessageSquare size={12}/> OBSERVAÇÃO
                      </button>
                      <button 
                        onClick={() => setType(AnnotationType.SCAFFOLD)}
                        className={`flex items-center justify-center gap-1 py-2 rounded-md text-[9px] font-bold transition-all ${type === AnnotationType.SCAFFOLD ? 'bg-yellow-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
                      >
                          <Construction size={12}/> ANDAIME
                      </button>
                      <button 
                        onClick={() => setType(AnnotationType.SCAFFOLD_CANTILEVER)}
                        className={`flex items-center justify-center gap-1 py-2 rounded-md text-[9px] font-bold transition-all ${type === AnnotationType.SCAFFOLD_CANTILEVER ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
                      >
                          <Layers size={12}/> BALANÇO
                      </button>
                      <button 
                        onClick={() => setType(AnnotationType.CRANE)}
                        className={`flex items-center justify-center gap-1 py-2 rounded-md text-[9px] font-bold transition-all ${type === AnnotationType.CRANE ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
                      >
                          <Truck size={12}/> GUINDASTE
                      </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 font-bold flex items-center gap-1 uppercase tracking-wider">
                        <Clock size={10}/> Esforço Estimado (H/H)
                    </label>
                    <input 
                        type="number"
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                        className="bg-slate-800 text-white text-xs p-2 rounded border border-slate-600 outline-none focus:border-blue-500 w-full"
                        placeholder="0.0"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Descrição / Detalhes</label>
                    <textarea 
                        autoFocus
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Descreva o esforço necessário..."
                        className="bg-slate-800 text-white text-xs p-2 rounded border border-slate-600 outline-none focus:border-blue-500 w-full resize-none h-16"
                        onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) handleSave(); }}
                    />
                  </div>
                  
                  <div className="flex justify-between gap-2 pt-2 border-t border-slate-800">
                      <button onClick={() => onDelete(data.id)} className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors" title="Excluir"><Trash2 size={16}/></button>
                      <div className="flex gap-2">
                        <button onClick={handleCancel} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-[10px] rounded-lg font-bold transition-colors">CANCELAR</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] rounded-lg font-bold flex items-center gap-1 transition-colors shadow-lg shadow-blue-900/20"><Check size={14}/> SALVAR</button>
                      </div>
                  </div>
              </div>
          </Html>
      ) : (
          <Billboard position={[0, 1.2, 0]}>
              {/* Background Panel for readability in 3D */}
              <mesh position={[0, 0, -0.01]} onClick={handleMarkerClick}>
                  <planeGeometry args={[Math.max(inputText.length * 0.12 + 1.2, 2.0), 0.7]} />
                  <meshBasicMaterial color={isSelected ? "#ea580c" : baseColor} opacity={0.85} transparent />
              </mesh>
              
              {/* Icon + Text */}
              <group position={[0, 0, 0]}>
                  <Text
                    fontSize={0.2}
                    color="white"
                    position={[- (inputText.length * 0.06) - 0.4, 0, 0]}
                    anchorX="right"
                  >
                    {typeIcon}
                  </Text>

                  <Text
                    fontSize={0.25}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.02}
                    outlineColor={isSelected ? "#ea580c" : baseColor}
                    onClick={handleMarkerClick}
                    onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                    onPointerOver={() => document.body.style.cursor = 'pointer'}
                    onPointerOut={() => document.body.style.cursor = 'auto'}
                  >
                    {`${inputText || typeLabel} ${data.estimatedHours ? `(${data.estimatedHours}h)` : ''}`}
                  </Text>
              </group>
          </Billboard>
      )}
      
      {/* Line connecting text to marker */}
      {!isEditing && (
          <lineSegments position={[0, 0.5, 0]}>
              <bufferGeometry>
                  <bufferAttribute attach="attributes-position" count={2} itemSize={3} array={new Float32Array([0,0,0, 0,0.5,0])} />
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