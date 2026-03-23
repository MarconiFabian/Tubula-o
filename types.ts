
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
  materialAvailable?: boolean; // Novo: Material disponível em campo
  weatherExposed?: boolean; // Novo: Exposto a intempéries
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
  supportBase: number; // HH per support
  valveBase: number;   // HH per valve
  instrumentBase: number; // HH per instrument
  otherBase: number;   // HH per other component
  weights: ProductivityWeights;
  globalConfig: {
    weatherFactor: number; // Multiplicador para chuva/vento
    materialDelayFactor: number; // Multiplicador se material não disponível
    skillMultiplier: {
      JUNIOR: number;
      SENIOR: number;
      EXPERT: number;
    };
    workOnWeekends: boolean;
    shiftHours: number;
    safetyBuffer: number; // 0.1 = 10% de folga
    reworkFactor: number; // 0.05 = 5% de retrabalho
  };
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

export interface ComponentStatus {
  total: number;
  installed: number;
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
  supports?: ComponentStatus;
  accessories?: Accessory[];
}

export type AccessoryType = 'SUPPORT' | 'VALVE' | 'INSTRUMENT' | 'OTHER';

export enum AccessoryStatus {
  PENDING = 'PENDING',
  MOUNTED = 'MOUNTED'
}

export interface Accessory {
  id: string;
  type: AccessoryType;
  offset: number; // 0 to 1 along the pipe
  status: AccessoryStatus;
  name?: string;
}

export enum AnnotationType {
  COMMENT = 'COMMENT',
  SCAFFOLD = 'SCAFFOLD',
  CRANE = 'CRANE',
  SCAFFOLD_CANTILEVER = 'SCAFFOLD_CANTILEVER'
}

export interface Annotation {
  id: string;
  position: Coordinates;
  text: string;
  type?: AnnotationType;
  estimatedHours?: number;
}

export interface DailyProduction {
  date: string;
  pipeMeters: number;
  insulationMeters: number;
  pipingProgress?: number;
  insulationProgress?: number;
  totalProgress?: number;
  plannedPipingProgress?: number;
  plannedInsulationProgress?: number;
  plannedTotalProgress?: number;
}

export interface CalendarException {
  date: string;
  type: 'WORK' | 'NON_WORK' | 'HOLIDAY';
}

export interface ProjectCalendar {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  workDays: string[]; // ['1', '2', '3', '4', '5']
  teamCount: number;
  exceptions: CalendarException[];
}

export interface ProjectStats {
  totalLength: number;
  installedLength: number;
  totalWelds: number;
  completedWelds: number;
  totalLines: number;
  testedLines: number;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: 'admin' | 'viewer';
  createdAt: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  user: User | null;
}
