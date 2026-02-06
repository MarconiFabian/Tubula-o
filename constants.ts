import { PipeStatus, PipeSegment } from './types';

// Helper to safely get colors, guarding against undefined PipeStatus
const getStatusColors = () => {
  if (!PipeStatus) return {};
  return {
    [PipeStatus.PENDING]: '#ef4444', // Red-500
    [PipeStatus.MOUNTED]: '#eab308', // Yellow-500
    [PipeStatus.WELDED]: '#22c55e',  // Green-500
    [PipeStatus.HYDROTEST]: '#3b82f6' // Blue-500
  };
};

export const STATUS_COLORS = getStatusColors();

// Helper to safely get labels
const getStatusLabels = () => {
  if (!PipeStatus) return {};
  return {
    [PipeStatus.PENDING]: 'Pendente',
    [PipeStatus.MOUNTED]: 'Montado',
    [PipeStatus.WELDED]: 'Soldado',
    [PipeStatus.HYDROTEST]: 'Testado (Hydro)'
  };
};

export const STATUS_LABELS = getStatusLabels();

// Helper to calculate 3D distance
const calcDist = (p1: {x:number, y:number, z:number}, p2: {x:number, y:number, z:number}) => {
  return Math.sqrt(
    Math.pow(p2.x - p1.x, 2) +
    Math.pow(p2.y - p1.y, 2) +
    Math.pow(p2.z - p1.z, 2)
  );
};

// Start with an empty array as requested
export const INITIAL_PIPES: PipeSegment[] = [];