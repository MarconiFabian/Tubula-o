
import { PipeStatus, PipeSegment, InsulationStatus } from './types';

export const STATUS_COLORS: Record<string, string> = {
  'PENDING': '#94a3b8', 
  'MOUNTED': '#eab308', 
  'WELDED': '#22c55e',  
  'HYDROTEST': '#3b82f6' 
};

export const STATUS_LABELS: Record<string, string> = {
  'PENDING': 'Pendente',
  'MOUNTED': 'Montado',
  'WELDED': 'Soldado',
  'HYDROTEST': 'Testado (Hydro)'
};

// --- MÉTRICAS DE PLANEJAMENTO (CALIBRAÇÃO MANUAL) ---
// Altere os valores abaixo para ajustar o "motor" de cálculo do cronograma.

export const HOURS_PER_DAY = 8.8; // Jornada de trabalho padrão em horas

export const BASE_PRODUCTIVITY = {
  PIPING: 0.98,      // Homem-Hora por Metro para Montagem (Base: ~9m/dia)
  INSULATION: 1.95,  // Homem-Hora por Metro para Isolamento (Base: ~4.5m/dia)
};

export const DIFFICULTY_WEIGHTS = {
  CRANE: 0.75,           // +75% de tempo (Dificuldade logística/Içamento)
  SCAFFOLD_FLOOR: 1.35,  // +135% de tempo (Trabalho em altura com andaime simples)
  SCAFFOLD_HANGING: 2.10, // +210% de tempo (Andaime em balanço - Risco máximo)
  PTA: 0.95,             // +95% de tempo (Uso de plataforma elevatória)
  BLOCKAGE: 0.65,        // +65% de tempo (Interferências de projeto/campo)
  NIGHT_SHIFT: 0.40,     // +40% de tempo (Perda de rendimento noturno)
  CRITICAL_AREA: 0.50    // +50% de tempo (Área de risco, permissões complexas)
};

export const INSULATION_COLORS: Record<string, string> = {
  'NONE': 'transparent',
  'PENDING': '#f87171',    
  'INSTALLING': '#fbbf24', 
  'FINISHED': '#e2e8f0'    
};

export const INSULATION_LABELS: Record<string, string> = {
  'NONE': 'Sem Isolamento',
  'PENDING': 'Isol. Pendente',
  'INSTALLING': 'Isol. Montando',
  'FINISHED': 'Isol. Finalizado'
};

export const PIPE_DIAMETERS: Record<string, number> = {
  '10"': 0.2730,
  '8"': 0.2032,
  '6"': 0.1683,
  '4"': 0.1143,
  '1"': 0.0334,
  '3/4"': 0.0267
};

export const ALL_STATUSES = ['PENDING', 'MOUNTED', 'WELDED', 'HYDROTEST'];
export const ALL_INSULATION_STATUSES = ['NONE', 'PENDING', 'INSTALLING', 'FINISHED'];
export const AVAILABLE_DIAMETERS = ['10"', '8"', '6"', '4"', '1"', '3/4"'];

export const INITIAL_PIPES: PipeSegment[] = [];
