
export enum PipeStatus {
  PENDING = 'PENDING',       // Gray: Pendente de montagem
  MOUNTED = 'MOUNTED',       // Yellow: Montado, aguardando solda
  WELDED = 'WELDED',         // Green: Soldagem concluída
  HYDROTEST = 'HYDROTEST'    // Blue: Teste Hidrostático aprovado
}

export enum InsulationStatus {
  NONE = 'NONE',             // Sem isolamento
  PENDING = 'PENDING',       // Pendente (Ex: Vermelho claro/Rosa)
  INSTALLING = 'INSTALLING', // Em instalação (Ex: Amarelo/Laranja)
  FINISHED = 'FINISHED'      // Finalizado (Ex: Prata/Alumínio)
}

export interface PlanningFactors {
  hasCrane: boolean;
  accessType: 'NONE' | 'SCAFFOLD_FLOOR' | 'SCAFFOLD_HANGING' | 'PTA';
  hasBlockage: boolean;
  isNightShift?: boolean;    
  isCriticalArea?: boolean;  
  delayHours: number;
  teamCount?: number; 
  customStartDate?: string; // Novo: Permite definir início de trabalho manual por item/grupo
}

// Added ProductivityWeights interface for 4D planning calculations
export interface ProductivityWeights {
  crane: number;
  blockage: number;
  nightShift: number;
  criticalArea: number;
  scaffoldFloor: number;
  scaffoldHanging: number;
  pta: number;
}

// Added ProductivitySettings interface for 4D planning configuration
export interface ProductivitySettings {
  pipingBase: number;
  insulationBase: number;
  weights: ProductivityWeights;
}

export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface WelderInfo {
  welderId?: string;
  weldDate: string;
  electrodeBatch: string;
  visualInspection: boolean;
}

export interface PipeSegment {
  id: string;
  name: string;
  location?: string;
  spoolId?: string;
  start: Coordinates;
  end: Coordinates;
  diameter: number; 
  status: PipeStatus;
  welderInfo?: WelderInfo;
  generalInfo?: string;
  testPackId?: string;
  length: number; 
  insulationStatus?: InsulationStatus;
  planningFactors?: PlanningFactors;
}

export type AccessoryType = 'VALVE' | 'FLANGE' | 'SUPPORT';

export interface Accessory {
  id: string;
  type: AccessoryType;
  position: Coordinates;
  rotation?: Coordinates;
  parentPipeId: string;
  color?: string;
}

export interface Annotation {
  id: string;
  position: Coordinates;
  text: string;
}

export interface ProjectStats {
  totalLength: number;
  installedLength: number;
  totalWelds: number;
  completedWelds: number;
  totalLines: number;
  testedLines: number;
}
