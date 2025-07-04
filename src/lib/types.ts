
export interface Operator {
  id: string;
  name: string;
  skillRating: number;
  isAbsent: boolean;
}

export interface Machine {
  id: string;
  name: string;
  isAvailable: boolean;
}

export interface MachineProductionData {
  machineId: string;
  name: string;
  status: 'Online' | 'Offline';
  sku: string;
  quantity: number;
  operatorId?: string;
  remark?: string;
  trolleyNo?: string;
  noOfSpool?: string;
}

export interface ShiftInfo {
  name: string;
  startTime: string;
  endTime: string;
}

export interface MarketRequirement {
  id?: string;
  sku: string;
  sapCode: string;
  demand: number;
  machine: string;
}

export interface ProductionPlanItem {
  machineId: string;
  skus: string[];
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
  openingStock: number;
  production: number;
}
