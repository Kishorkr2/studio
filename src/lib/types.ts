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
}

export interface Shift {
  startTime: string;
  endTime: string;
}

export interface MarketRequirement {
  sku: string;
  demand: number;
}

export interface ProductionPlanItem {
  machineId: string;
  sku: string;
}
