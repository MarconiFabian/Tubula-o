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

export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface WelderInfo {
  welderId?: string; // Made optional or deprecated
  weldDate: string;
  electrodeBatch: string;
  visualInspection: boolean;
}

export interface PipeSegment {
  id: string;
  name: string;
  location?: string; // New Field: Local da Atividade
  start: Coordinates;
  end: Coordinates;
  diameter: number; // in meters
  status: PipeStatus;
  welderInfo?: WelderInfo;
  generalInfo?: string; // New field for general notes
  testPackId?: string;
  length: number; // Calculated automatically
  insulationStatus?: InsulationStatus; // Updated from boolean to Enum
}

export interface ProjectStats {
  totalLength: number;
  installedLength: number;
  totalWelds: number;
  completedWelds: number;
  totalLines: number;
  testedLines: number;
}