export interface User {
  id: number;
  name: string;
  email: string;
  mobile: string;
  password?: string;
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
}

// Represents a single SKU's production for a given machine in a round
export interface SkuProduction {
  sku: string;
  sapCode: string;
  quantity: number;
}

// Represents the data for a single machine card in a given round
export interface MachineProductionData {
  machineId: string;
  name: string;
  operatorId?: string;
  skus: SkuProduction[];
  userId?: number;
  userName?: string;
}

// This is the raw row from the DB
export interface FlatProductionLogEntry {
    machineId: string;
    name: string;
    status: 'Online' | 'Offline';
    sku: string;
    sapCode: string;
    quantity: number;
    operatorId?: string;
    userId?: number;
    userName?: string;
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
  entries: FlatProductionLogEntry[];
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
}

export interface DailyProductionEntry {
  quantity: number;
  trolleyNo: string;
}
