
export interface User {
  id: number;
  name: string;
  email: string;
  mobile: string;
  password: string; // Hashed password from DB
  isApproved: boolean;
  isAdmin: boolean;
}

export interface Operator {
  cardNo: string;
  name: string;
  builderNo: string;
  skillRating: number;
  isAbsent: boolean;
}

export interface Machine {
  id: string;
  name: string;
  isAvailable: boolean;
  type: 'TBM' | 'CuringPress';
}

// Represents a single SKU's production for a given machine in a round
export interface SkuProduction {
  sku: string;
  sapCode: string;
  quantity: number;
  leftQty?: number;
  rightQty?: number;
  remark?: string;
}

export interface OperatorEntry {
  operatorId: string;
  skus: SkuProduction[];
  userId?: number;
  userName?: string;
}

// Represents the data for a single machine card in a given round
export interface MachineProductionData {
  machineId: string;
  name: string;
  operatorId?: string;
  skus: SkuProduction[];
  operatorEntries?: OperatorEntry[];
  userId?: number;
  userName?: string;
}

// This is the raw row from the DB
export interface FlatProductionLogEntry {
  date: string;
  shiftName: string;
  round: string;
  machineId: string;
  name: string;
  status: 'Online' | 'Offline';
  sku: string;
  sapCode: string;
  quantity: number;
  leftQty?: number;
  rightQty?: number;
  operatorId?: string;
  userId?: number;
  userName?: string;
  remark?: string;
}

export interface ShiftInfo {
  name: string;
  startTime: string;
  endTime: string;
}

export interface SkuPlan {
  sku: string;
  sapCode: string;
  quantity: number;
}

export interface ProductionPlanItem {
  machineId: string;
  skus: SkuPlan[];
}

export interface ProductionLogEntry {
  entries: MachineProductionData[];
  status: 'synced' | 'pending';
}

export interface ProductionLog {
  [roundTime: string]: ProductionLogEntry;
}

export interface TreadStock {
  sku: string;
  sapCode: string;
  openingStock: number;
  production: number;
  currentTreadStock: number;
}

export interface DailyProductionEntry {
  quantity: number;
  trolleyNo: string;
}

export interface ReportDataRow {
  date: string;
  shift: string;
  round: string;
  operatorId?: string;
  operatorName?: string;
  machineId: string;
  machineName: string;
  sku: string;
  sapCode: string;
  quantity: number;
  remark?: string;
  trolleyNo?: string;
  userId?: number;
  userName?: string;
}

export interface SavedEntry {
  machineName: string;
  operatorName: string;
  sku: string;
  quantity: number;
  time: string;
}

export interface SkuStandard {
    sapCode: string;
    sku: string;
    stdWeight: number | null;
    stdHourlyProduction: number | null;
}
