'use server';

import {db} from './database';
import type {
  Operator,
  Machine,
  ShiftInfo,
  ProductionPlanItem,
  ProductionLog,
  TreadStock,
  MachineProductionData,
  DailyProductionEntry,
} from '../types';
import {format} from 'date-fns';

export async function getOperators(): Promise<Operator[]> {
  return db.all('SELECT * FROM operators ORDER BY name');
}

export async function getMachines(): Promise<Machine[]> {
  return db.all('SELECT * FROM machines ORDER BY id');
}

export async function getShifts(): Promise<ShiftInfo[]> {
  return db.all('SELECT * FROM shifts');
}

export async function getProductionPlan(): Promise<ProductionPlanItem[]> {
  const planItems = await db.all(
    'SELECT machineId, json_group_array(json_object(\'sku\', sku, \'sapCode\', sapCode, \'quantity\', quantity)) as skus FROM productionPlanItems GROUP BY machineId'
  );
  return planItems.map(item => ({
    machineId: item.machineId,
    skus: JSON.parse(item.skus),
  }));
}

export async function getProductionLogs() {
  return db.all('SELECT * FROM productionLogs');
}

export async function getProductionLogForShift(
  date: Date,
  shift: ShiftInfo
): Promise<ProductionLog> {
  const dateKey = format(date, 'yyyy-MM-dd');
  const shiftName = shift.name.replace(/\s+/g, '-');
  const logIdPrefix = `production-log-${dateKey}-${shiftName}`;
  const rows = await db.all(
    'SELECT * FROM productionLogs WHERE id LIKE ?',
    `${logIdPrefix}%`
  );
  const log: ProductionLog = {};
  rows.forEach(row => {
    const round = row.id.split('::')[1];
    if (round) {
      log[round] = {
        entries: JSON.parse(row.entries),
        status: 'synced',
      };
    }
  });
  return log;
}

export async function getDailyTreadProductionLog() {
  const rows = await db.all('SELECT * FROM dailyTreadProduction');
  const log: Record<
    string,
    Record<string, Record<string, DailyProductionEntry>>
  > = {};
  rows.forEach(row => {
    log[row.id] = JSON.parse(row.data);
  });
  return log;
}

export async function getTreadOpeningStock(): Promise<TreadStock[]> {
  return db.all('SELECT * FROM treadOpeningStock');
}

export async function updateOperator(
  cardNo: string,
  data: Partial<Operator>
) {
  const fields = Object.keys(data)
    .map(k => `${k} = ?`)
    .join(', ');
  const values = Object.values(data);
  await db.run(`UPDATE operators SET ${fields} WHERE cardNo = ?`, [
    ...values,
    cardNo,
  ]);
}

export async function renameOperator(
  originalCardNo: string,
  newCardNo: string,
  newOperatorData: Operator
) {
  // Use a transaction to ensure both operations succeed or fail together
  await db.exec('BEGIN TRANSACTION');
  try {
    const {name, builderNo, skillRating, isAbsent} = newOperatorData;
    // Delete the old operator record
    await db.run('DELETE FROM operators WHERE cardNo = ?', originalCardNo);
    // Insert the new operator record
    await db.run(
      'INSERT INTO operators (cardNo, name, builderNo, skillRating, isAbsent) VALUES (?, ?, ?, ?, ?)',
      newCardNo,
      name,
      builderNo,
      skillRating,
      isAbsent
    );
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}

export async function addOperator(data: Operator) {
  await db.run(
    'INSERT INTO operators (cardNo, name, builderNo, skillRating, isAbsent) VALUES (?, ?, ?, ?, ?)',
    data.cardNo,
    data.name,
    data.builderNo,
    data.skillRating,
    data.isAbsent
  );
}

export async function deleteOperator(cardNo: string) {
  await db.run('DELETE FROM operators WHERE cardNo = ?', cardNo);
}

export async function updateShifts(shifts: ShiftInfo[]) {
  for (const shift of shifts) {
    await db.run(
      'UPDATE shifts SET startTime = ?, endTime = ? WHERE name = ?',
      shift.startTime,
      shift.endTime,
      shift.name
    );
  }
}

export async function updateProductionPlan(plan: ProductionPlanItem[]) {
  await db.run('DELETE FROM productionPlanItems');
  for (const item of plan) {
    for (const sku of item.skus) {
      await db.run(
        'INSERT INTO productionPlanItems (machineId, sku, sapCode, quantity) VALUES (?, ?, ?, ?)',
        item.machineId,
        sku.sku,
        sku.sapCode,
        sku.quantity
      );
    }
  }
}

export async function clearAllProductionData() {
  await db.run('DELETE FROM productionLogs');
  await db.run('DELETE FROM dailyTreadProduction');
  await db.run('DELETE FROM treadOpeningStock');
}

export async function updateMachines(machines: Machine[]) {
  // Use a transaction for bulk updates
  await db.exec('BEGIN TRANSACTION');
  try {
    for (const machine of machines) {
      await db.run(
        'UPDATE machines SET name = ?, isAvailable = ? WHERE id = ?',
        machine.name,
        machine.isAvailable,
        machine.id
      );
    }
    await db.exec('COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
}

export async function addMachine(machine: Machine) {
  await db.run(
    'INSERT INTO machines (id, name, isAvailable) VALUES (?, ?, ?)',
    machine.id,
    machine.name,
    machine.isAvailable
  );
}

export async function deleteMachine(id: string) {
  await db.run('DELETE FROM machines WHERE id = ?', id);
}

export async function saveProductionRound(
  date: Date,
  shift: ShiftInfo,
  round: string,
  entries: MachineProductionData[]
) {
  const dateKey = format(date, 'yyyy-MM-dd');
  const shiftName = shift.name.replace(/\s+/g, '-');
  const logId = `production-log-${dateKey}-${shiftName}::${round}`; // Unique ID per round

  const entriesJson = JSON.stringify(entries);

  // Use INSERT OR REPLACE to avoid unique constraint errors
  await db.run(
    'INSERT OR REPLACE INTO productionLogs (id, entries) VALUES (?, ?)',
    logId,
    entriesJson
  );
}

export async function clearShiftData(date: Date, shift: ShiftInfo) {
  const dateKey = format(date, 'yyyy-MM-dd');
  const shiftName = shift.name.replace(/\s+/g, '-');
  const logIdPrefix = `production-log-${dateKey}-${shiftName}`;
  await db.run('DELETE FROM productionLogs WHERE id LIKE ?', `${logIdPrefix}%`);
}

export async function saveDailyProductionLog(
  log: Record<string, Record<string, Record<string, DailyProductionEntry>>>
) {
  for (const [dateKey, dateData] of Object.entries(log)) {
    const dataJson = JSON.stringify(dateData);
    await db.run(
      'INSERT OR REPLACE INTO dailyTreadProduction (id, data) VALUES (?, ?)',
      dateKey,
      dataJson
    );
  }
}

export async function saveTreadOpeningStock(stock: TreadStock[]) {
  // Use a transaction for bulk inserts/updates
  await db.exec('BEGIN TRANSACTION');
  try {
    for (const item of stock) {
      if (!item.sapCode) continue;
      await db.run(
        'INSERT OR REPLACE INTO treadOpeningStock (sapCode, sku, openingStock, production) VALUES (?, ?, ?, ?)',
        item.sapCode,
        item.sku,
        item.openingStock,
        item.production
      );
    }
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
}
