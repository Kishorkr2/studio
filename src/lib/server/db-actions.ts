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
  SkuPlan,
  User,
} from '../types';
import {format} from 'date-fns';
import bcrypt from 'bcryptjs';
import type {SignUpInput} from '@/app/signup/page';

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
  const allPlanItems = await db.all(
    'SELECT machineId, sku, sapCode, quantity FROM productionPlanItems ORDER BY machineId'
  );

  const planMap = new Map<string, SkuPlan[]>();

  for (const item of allPlanItems) {
    const {machineId, sku, sapCode, quantity} = item;
    const existingSkus = planMap.get(machineId) || [];
    existingSkus.push({sku, sapCode, quantity});
    planMap.set(machineId, existingSkus);
  }

  const result: ProductionPlanItem[] = Array.from(
    planMap,
    ([machineId, skus]) => ({
      machineId,
      skus,
    })
  );

  return result;
}

export async function getProductionLogs() {
  const operatorMap = new Map(
    (await getOperators()).map(op => [op.cardNo, op.name])
  );
  const machineMap = new Map((await getMachines()).map(m => [m.id, m.name]));

  const logs = await db.all('SELECT * FROM productionLogEntries');

  return logs.map(log => ({
    date: log.date,
    shift: log.shiftName,
    round: log.round,
    operatorId: log.operatorId,
    operatorName: operatorMap.get(log.operatorId || '') || 'N/A',
    machineId: log.machineId,
    machineName: machineMap.get(log.machineId) || 'N/A',
    sku: log.sku,
    quantity: log.quantity,
    userId: log.userId,
    userName: log.userName,
  }));
}

export async function getProductionLogForShift(
  date: Date,
  shift: ShiftInfo
): Promise<ProductionLog> {
  const dateKey = format(date, 'yyyy-MM-dd');
  const shiftName = shift.name.replace(/\s+/g, '-');
  const rows = await db.all(
    'SELECT * FROM productionLogEntries WHERE date = ? AND shiftName = ?',
    [dateKey, shiftName]
  );
  const log: ProductionLog = {};
  for (const row of rows) {
    if (!log[row.round]) {
      log[row.round] = {entries: [], status: 'synced'};
    }
    log[row.round].entries.push({
      machineId: row.machineId,
      name: row.name,
      status: row.status as 'Online' | 'Offline',
      sku: row.sku,
      sapCode: row.sapCode,
      quantity: row.quantity,
      operatorId: row.operatorId,
      userId: row.userId,
      userName: row.userName,
    });
  }
  return log;
}

export async function getDailyTreadProductionLog() {
  const rows = await db.all('SELECT * FROM dailyTreadProduction');
  const log: Record<
    string,
    Record<string, Record<string, DailyProductionEntry>>
  > = {};
  rows.forEach(row => {
    try {
      log[row.id] = JSON.parse(row.data);
    } catch (e) {
      console.error(`Failed to parse daily tread production for ${row.id}:`, e);
    }
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
  await db.exec('BEGIN TRANSACTION');
  try {
    const {name, builderNo, skillRating, isAbsent} = newOperatorData;
    await db.run('DELETE FROM operators WHERE cardNo = ?', originalCardNo);
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

export async function clearProductionPlan() {
  await db.run('DELETE FROM productionPlanItems');
}

export async function clearAllProductionData() {
  await db.run('DELETE FROM productionLogEntries');
  await db.run('DELETE FROM dailyTreadProduction');
  await db.run('DELETE FROM treadOpeningStock');
}

export async function updateMachines(machines: Machine[]) {
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

  await db.exec('BEGIN TRANSACTION');
  try {
    for (const entry of entries) {
      await db.run(
        `INSERT OR REPLACE INTO productionLogEntries 
        (date, shiftName, round, machineId, name, status, sku, sapCode, quantity, operatorId, userId, userName) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        dateKey,
        shiftName,
        round,
        entry.machineId,
        entry.name,
        entry.status,
        entry.sku,
        entry.sapCode,
        entry.quantity,
        entry.operatorId,
        entry.userId,
        entry.userName,
      );
    }
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    console.error('Failed to save production round:', error);
    throw error;
  }
}

export async function clearShiftData(date: Date, shift: ShiftInfo) {
  const dateKey = format(date, 'yyyy-MM-dd');
  const shiftName = shift.name.replace(/\s+/g, '-');
  await db.run(
    'DELETE FROM productionLogEntries WHERE date = ? AND shiftName = ?',
    [dateKey, shiftName]
  );
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

// User Actions

export async function signUpUser(data: SignUpInput): Promise<{success: boolean; message?: string}> {
  const {name, email, mobile, password} = data;
  try {
    const existingUser = await db.get('SELECT * FROM users WHERE email = ?', email);
    if (existingUser) {
      return {success: false, message: 'An account with this email already exists.'};
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.run(
      'INSERT INTO users (name, email, mobile, password) VALUES (?, ?, ?, ?)',
      name,
      email,
      mobile,
      hashedPassword
    );
    return {success: true};
  } catch (error) {
    console.error('Sign up error:', error);
    return {success: false, message: 'A database error occurred.'};
  }
}

export async function verifyUserLogin(email: string, pass: string): Promise<{success: boolean; message?: string; user?: User}> {
  const user = await db.get<User>('SELECT * FROM users WHERE email = ?', email.toLowerCase());
  
  if (!user) {
    return {success: false, message: 'Invalid email or password.'};
  }
  
  const isPasswordValid = await bcrypt.compare(pass, user.password);
  
  if (!isPasswordValid) {
    return {success: false, message: 'Invalid email or password.'};
  }
  
  if (!user.isApproved) {
    return {success: false, message: 'Your account has not been approved by an administrator yet.'};
  }
  
  return {success: true, user};
}


export async function getUsers(): Promise<User[]> {
  return db.all('SELECT id, name, email, mobile, isApproved, isAdmin FROM users ORDER BY name');
}

export async function approveUser(userId: number) {
  await db.run('UPDATE users SET isApproved = TRUE WHERE id = ?', userId);
}

export async function deleteUser(userId: number) {
  await db.run('DELETE FROM users WHERE id = ?', userId);
}
