import { PipeStatus, PipeSegment, InsulationStatus } from './types';

// Define explicit string keys to avoid runtime errors if PipeStatus enum is undefined
export const STATUS_COLORS: Record<string, string> = {
  'PENDING': '#94a3b8', // Gray/Slate-400
  'MOUNTED': '#eab308', // Yellow-500
  'WELDED': '#22c55e',  // Green-500
  'HYDROTEST': '#3b82f6' // Blue-500
};

export const STATUS_LABELS: Record<string, string> = {
  'PENDING': 'Pendente',
  'MOUNTED': 'Montado',
  'WELDED': 'Soldado',
  'HYDROTEST': 'Testado (Hydro)'
};

// Colors for the Insulation Shell (Usually semi-transparent in 3D)
export const INSULATION_COLORS: Record<string, string> = {
  'NONE': 'transparent',
  'PENDING': '#f87171',    // Red-400 (Need to insulate)
  'INSTALLING': '#fbbf24', // Amber-400 (Work in progress)
  'FINISHED': '#e2e8f0'    // Slate-200 (Silver/Cladding)
};

export const INSULATION_LABELS: Record<string, string> = {
  'NONE': 'Sem Isolamento',
  'PENDING': 'Isol. Pendente',
  'INSTALLING': 'Isol. Montando',
  'FINISHED': 'Isol. Finalizado'
};

// Safe, ordered list of statuses for iteration
export const ALL_STATUSES = ['PENDING', 'MOUNTED', 'WELDED', 'HYDROTEST'];
export const ALL_INSULATION_STATUSES = ['NONE', 'PENDING', 'INSTALLING', 'FINISHED'];

export const INITIAL_PIPES: PipeSegment[] = [];