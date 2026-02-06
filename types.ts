export enum PipeStatus {
  PENDING = 'PENDING',       // Red: Pendente de montagem
  MOUNTED = 'MOUNTED',       // Yellow: Montado, aguardando solda
  WELDED = 'WELDED',         // Green: Soldagem concluída
  HYDROTEST = 'HYDROTEST'    // Blue: Teste Hidrostático aprovado
}

export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface WelderInfo {
  welderId: string;
  weldDate: string;
  electrodeBatch: string;
  visualInspection: boolean;
}

export interface PipeSegment {
  id: string;
  name: string;
  start: Coordinates;
  end: Coordinates;
  diameter: number; // in meters
  status: PipeStatus;
  welderInfo?: WelderInfo;
  testPackId?: string;
  length: number; // Calculated automatically
}

export interface ProjectStats {
  totalLength: number;
  installedLength: number;
  totalWelds: number;
  completedWelds: number;
  totalLines: number;
  testedLines: number;
}