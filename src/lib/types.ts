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

export interface MachineProductionData {
  machineId: string;
  name: string;
  status: 'Online' | 'Offline';
  sku: string;
  sapCode: string;
  quantity: number;
  operatorId?: string;
  remark?: string;
  trolleyNo?: string;
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
}
