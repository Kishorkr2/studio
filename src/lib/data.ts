
import type { Operator, Machine, ProductionPlanItem, ShiftInfo } from './types';

export const shifts: ShiftInfo[] = [
  { name: 'Day Shift', startTime: '07:30', endTime: '19:30' },
  { name: 'Night Shift', startTime: '19:30', endTime: '07:30' },
];

export const initialOperators: Operator[] = [
  { cardNo: 'OP-001', name: 'John Doe', builderNo: 'B-01', skillRating: 5, isAbsent: false },
  { cardNo: 'OP-002', name: 'Jane Smith', builderNo: 'B-02', skillRating: 4, isAbsent: false },
  { cardNo: 'OP-003', name: 'Peter Jones', builderNo: 'B-03', skillRating: 3, isAbsent: true },
  { cardNo: 'OP-004', name: 'Mary Williams', builderNo: 'B-04', skillRating: 5, isAbsent: false },
  { cardNo: 'OP-005', name: 'David Brown', builderNo: 'B-05', skillRating: 2, isAbsent: false },
];

// Make machine availability static to ensure predictability.
export const initialMachines: Machine[] = Array.from({ length: 26 }, (_, i) => ({
  id: `TBM-${String(i + 1).padStart(2, '0')}`,
  name: `TBM ${i + 1}`,
  isAvailable: i < 23, // TBM-24, 25, 26 are unavailable
}));

export const initialProductionPlan: ProductionPlanItem[] = [
  { machineId: 'TBM-01', skus: [{ sku: 'P-215-65R17', sapCode: 'S4P-87321', quantity: 100 }] },
  { machineId: 'TBM-02', skus: [{ sku: 'P-225-60R17', sapCode: 'S4P-87322', quantity: 120 }] },
  { machineId: 'TBM-03', skus: [{ sku: 'LT-245-75R16', sapCode: 'S4P-87323', quantity: 150 }] },
  { machineId: 'TBM-04', skus: [{ sku: 'P-235-60R18', sapCode: 'S4P-87324', quantity: 90 }] },
];
