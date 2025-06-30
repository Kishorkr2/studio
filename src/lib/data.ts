import type { Operator, Machine, MachineProductionData, Shift, ProductionPlanItem, ShiftInfo } from './types';

export const shifts: ShiftInfo[] = [
  { name: 'Day Shift', startTime: '09:00', endTime: '19:00' },
  { name: 'Night Shift', startTime: '21:00', endTime: '07:00' },
];

export const initialOperators: Operator[] = [
  { id: 'OP-001', name: 'John Doe', skillRating: 5, isAbsent: false },
  { id: 'OP-002', name: 'Jane Smith', skillRating: 4, isAbsent: false },
  { id: 'OP-003', name: 'Peter Jones', skillRating: 3, isAbsent: true },
  { id: 'OP-004', name: 'Mary Williams', skillRating: 5, isAbsent: false },
  { id: 'OP-005', name: 'David Brown', skillRating: 2, isAbsent: false },
];

export const initialMachines: Machine[] = Array.from({ length: 26 }, (_, i) => ({
  id: `TBM-${String(i + 1).padStart(2, '0')}`,
  name: `TBM ${i + 1}`,
  isAvailable: Math.random() > 0.1, // 90% chance of being available
}));

export const initialProductionPlan: ProductionPlanItem[] = [
  { machineId: 'TBM-01', sku: 'P-215-65R17' },
  { machineId: 'TBM-02', sku: 'P-215-65R17' },
  { machineId: 'TBM-03', sku: 'LT-245-75R16' },
  { machineId: 'TBM-04', sku: 'P-235-60R18' },
];

export const initialProductionData: MachineProductionData[] = Array.from({ length: 26 }, (_, i) => ({
  machineId: `TBM-${String(i + 1).padStart(2, '0')}`,
  name: `TBM ${i + 1}`,
  status: Math.random() > 0.1 ? 'Online' : 'Offline',
  sku: '',
  quantity: 0,
}));


export const initialShift: Shift = {
  startTime: '08:00',
  endTime: '16:00',
};
