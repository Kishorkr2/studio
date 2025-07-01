import type { Operator, Machine, ProductionPlanItem, ShiftInfo } from './types';

export const shifts: ShiftInfo[] = [
  { name: 'Day Shift', startTime: '07:30', endTime: '19:30' },
  { name: 'Night Shift', startTime: '19:30', endTime: '07:30' },
];

export const initialOperators: Operator[] = [
  { id: 'OP-001', name: 'John Doe', skillRating: 5, isAbsent: false },
  { id: 'OP-002', name: 'Jane Smith', skillRating: 4, isAbsent: false },
  { id: 'OP-003', name: 'Peter Jones', skillRating: 3, isAbsent: true },
  { id: 'OP-004', name: 'Mary Williams', skillRating: 5, isAbsent: false },
  { id: 'OP-005', name: 'David Brown', skillRating: 2, isAbsent: false },
];

// Make machine availability static to ensure predictability.
export const initialMachines: Machine[] = Array.from({ length: 26 }, (_, i) => ({
  id: `TBM-${String(i + 1).padStart(2, '0')}`,
  name: `TBM ${i + 1}`,
  isAvailable: i < 23, // TBM-24, 25, 26 are unavailable
}));

export const initialProductionPlan: ProductionPlanItem[] = [
  { machineId: 'TBM-01', skus: ['P-215-65R17'] },
  { machineId: 'TBM-02', skus: ['P-215-65R17', 'P-225-60R17'] },
  { machineId: 'TBM-03', skus: ['LT-245-75R16'] },
  { machineId: 'TBM-04', skus: ['P-235-60R18'] },
];
