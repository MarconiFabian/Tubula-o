import React from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera, GizmoHelper, GizmoViewport } from '@react-three/drei';

export const SceneHelpers: React.FC = () => {
  return (
    <GizmoHelper
      alignment="bottom-right"
      margin={[80, 80]}
    >
      <GizmoViewport 
        axisColors={['#ef4444', '#22c55e', '#3b82f6']} 
        labelColor="white" 
      />
    </GizmoHelper>
  );
};
