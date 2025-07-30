'use server';

import * as dbActions from '@/lib/server/db-actions';
import type {
  Operator,
  Machine,
  ShiftInfo,
  ProductionPlanItem,
  ProductionLog,
  TreadStock,
  MachineProductionData,
  DailyProductionEntry,
} from '@/lib/types';

export const getOperators = async () => dbActions.getOperators();
export const getMachines = async () => dbActions.getMachines();
export const getShifts = async () => dbActions.getShifts();
export const getProductionPlan = async () => dbActions.getProductionPlan();
export const getProductionLogs = async () => dbActions.getProductionLogs();
export const getProductionLogForShift = async (date: Date, shift: ShiftInfo) =>
  dbActions.getProductionLogForShift(date, shift);
export const getDailyTreadProductionLog = async () =>
  dbActions.getDailyTreadProductionLog();
export const getTreadOpeningStock = async () => dbActions.getTreadOpeningStock();
export const updateOperator = async (cardNo: string, data: Partial<Operator>) =>
  dbActions.updateOperator(cardNo, data);
export const renameOperator = async (
  originalCardNo: string,
  newCardNo: string,
  newOperatorData: Operator
) => dbActions.renameOperator(originalCardNo, newCardNo, newOperatorData);
export const addOperator = async (data: Operator) => dbActions.addOperator(data);
export const deleteOperator = async (cardNo: string) =>
  dbActions.deleteOperator(cardNo);
export const updateShifts = async (shifts: ShiftInfo[]) =>
  dbActions.updateShifts(shifts);
export const updateProductionPlan = async (plan: ProductionPlanItem[]) =>
  dbActions.updateProductionPlan(plan);
export const clearAllProductionData = async () => dbActions.clearAllProductionData();
export const updateMachines = async (machines: Machine[]) =>
  dbActions.updateMachines(machines);
export const addMachine = async (machine: Machine) => dbActions.addMachine(machine);
export const deleteMachine = async (id: string) => dbActions.deleteMachine(id);
export const saveProductionRound = async (
  date: Date,
  shift: ShiftInfo,
  round: string,
  entries: MachineProductionData[]
) => dbActions.saveProductionRound(date, shift, round, entries);
export const clearShiftData = async (date: Date, shift: ShiftInfo) =>
  dbActions.clearShiftData(date, shift);
export const saveDailyProductionLog = async (
  log: Record<string, Record<string, Record<string, DailyProductionEntry>>>
) => dbActions.saveDailyProductionLog(log);
export const saveTreadOpeningStock = async (stock: TreadStock[]) =>
  dbActions.saveTreadOpeningStock(stock);
