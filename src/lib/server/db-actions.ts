
'use server';

import {connect, db} from './database';
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
  FlatProductionLogEntry,
  ReportDataRow,
  SkuStandard,
  CuringLogEntry,
  SignUpInput,
} from '../types';
import {format} from 'date-fns';
import bcrypt from 'bcryptjs';

export async function getOperators(): Promise<Operator[]> {
  await connect();
  return db.all('SELECT * FROM operators ORDER BY name');
}

export async function getMachines(
  type: 'TBM' | 'CuringPress' | 'all' = 'all'
): Promise<Machine[]> {
  await connect();
  const orderByClause =
    "ORDER BY type, CAST(SUBSTR(name, INSTR(name, ' ') + 1) AS INTEGER)";
  let machines;
  if (type === 'all') {
    machines = await db.all(`SELECT * FROM machines ${orderByClause}`);
  } else {
    machines = await db.all(
      `SELECT * FROM machines WHERE type = ? ${orderByClause}`,
      type
    );
  }

  // Convert isAvailable from 0/1 to boolean
  return machines.map((m: Machine) => ({
    ...m,
    isAvailable: Boolean(m.isAvailable),
  }));
}

export async function getShifts(): Promise<ShiftInfo[]> {
  await connect();
  return db.all('SELECT * FROM shifts');
}

export async function getProductionPlan(): Promise<ProductionPlanItem[]> {
  await connect();
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

export async function getProductionLogs(): Promise<ReportDataRow[]> {
  await connect();
  const [operators, machines, logs] = await Promise.all([
    db.all('SELECT cardNo, name FROM operators'),
    db.all('SELECT id, name FROM machines'),
    db.all('SELECT * FROM productionLogEntries ORDER BY date DESC, shiftName, round, machineId, id'),
  ]);

  const operatorMap = new Map(operators.map((op: Operator) => [op.cardNo, op.name]));
  const machineMap = new Map(machines.map((m: Machine) => [m.id, m.name]));
  
  const reportRows: ReportDataRow[] = [];

  for (const log of logs) {
      reportRows.push({
        id: log.id,
        date: log.date,
        shift: log.shiftName,
        round: log.round,
        operatorId: log.operatorId,
        operatorName: log.operatorId ? (operatorMap.get(log.operatorId) || 'N/A') : 'N/A',
        machineId: log.machineId,
        machineName: machineMap.get(log.machineId) || 'N/A',
        sku: log.sku,
        sapCode: log.sapCode,
        quantity: log.quantity,
        userId: log.userId,
        userName: log.userName,
        remark: log.remark,
      });
  }

  return reportRows;
}


export async function getProductionLogForShift(
  date: Date,
  shift: ShiftInfo
): Promise<ProductionLog> {
  await connect();
  const dateKey = format(date, 'yyyy-MM-dd');
  const shiftName = shift.name.replace(/\s+/g, '-');

  const rows = await db.all(
    'SELECT * FROM productionLogEntries WHERE date = ? AND shiftName = ? ORDER BY round, machineId',
    [dateKey, shiftName]
  );

  const log: ProductionLog = {};

  for (const row of rows) {
    if (!row.round || !row.machineId) {
      continue;
    }

    if (!log[row.round]) {
      log[row.round] = {entries: [], status: 'synced'};
    }

    let machineEntry = log[row.round].entries.find(
      e => e.machineId === row.machineId
    );

    const skuProduction = {
      sku: row.sku || '',
      sapCode: row.sapCode || '',
      quantity: row.quantity || 0,
      leftQty: row.leftQty,
      rightQty: row.rightQty,
    };

    if (machineEntry) {
      if (skuProduction.sku) {
        machineEntry.skus.push(skuProduction);
      }
    } else {
      const newMachineEntry: MachineProductionData = {
        machineId: row.machineId,
        name: row.name || '',
        operatorId: row.operatorId || '',
        skus: skuProduction.sku ? [skuProduction] : [],
        userId: row.userId,
        userName: row.userName,
        id: row.id,
      };
      log[row.round].entries.push(newMachineEntry);
    }
  }

  return log;
}

export async function getDailyTreadProductionLog() {
  await connect();
  const rows = await db.all('SELECT * FROM dailyTreadProduction');
  const log: Record<
    string,
    Record<string, Record<string, DailyProductionEntry>>
  > = {};
  rows.forEach((row: {id: string; data: string}) => {
    try {
      log[row.id] = JSON.parse(row.data);
    } catch (e) {
      console.error(`Failed to parse daily tread production for ${row.id}:`, e);
    }
  });
  return log;
}

export async function getTreadOpeningStock(): Promise<TreadStock[]> {
  await connect();
  return db.all('SELECT * FROM treadOpeningStock');
}

export async function updateOperator(
  cardNo: string,
  data: Partial<Operator>
) {
  await connect();
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
  await connect();
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
  await connect();
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
  await connect();
  await db.run('DELETE FROM operators WHERE cardNo = ?', cardNo);
}

export async function updateShifts(shifts: ShiftInfo[]) {
  await connect();
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
  await connect();
  await db.exec('BEGIN TRANSACTION');
  try {
    await db.run('DELETE FROM productionPlanItems');
    for (const item of plan) {
      for (const sku of item.skus) {
        await db.run(
          'INSERT INTO productionPlanItems (machineId, sku, sapCode, quantity) VALUES (?, ?, ?, ?)',
          item.machineId,
          sku.sku || '',
          sku.sapCode || '',
          sku.quantity || 0
        );
      }
    }
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    console.error('Failed to update production plan:', error);
    throw error;
  }
}

export async function clearProductionPlan() {
  await connect();
  await db.run('DELETE FROM productionPlanItems');
}

export async function clearAllProductionData() {
  await connect();
  await db.run('DELETE FROM productionLogEntries');
  await db.run('DELETE FROM dailyTreadProduction');
  await db.run('DELETE FROM treadOpeningStock');
}

export async function updateMachines(machines: Machine[]) {
  await connect();
  await db.exec('BEGIN TRANSACTION');
  try {
    for (const machine of machines) {
      await db.run(
        'UPDATE machines SET name = ?, isAvailable = ?, type = ? WHERE id = ?',
        machine.name,
        machine.isAvailable,
        machine.type,
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
  await connect();
  await db.run(
    'INSERT INTO machines (id, name, isAvailable, type) VALUES (?, ?, ?, ?)',
    machine.id,
    machine.name,
    machine.isAvailable,
    machine.type
  );
}

export async function deleteMachine(id: string) {
  await connect();
  await db.run('DELETE FROM machines WHERE id = ?', id);
}

export async function saveProductionRound(
  date: Date,
  shift: ShiftInfo,
  round: string,
  entries: MachineProductionData[]
) {
  await connect();
  const dateKey = format(date, 'yyyy-MM-dd');
  const shiftName = shift.name.replace(/\s+/g, '-');

  await db.exec('BEGIN TRANSACTION');
  try {
    // We only want to delete entries for the specific machines being updated in this round
    const machineIdsToDelete = entries.map(e => e.machineId);
    if(machineIdsToDelete.length > 0) {
      const placeholders = machineIdsToDelete.map(() => '?').join(',');
      await db.run(
        `DELETE FROM productionLogEntries 
        WHERE date = ? AND shiftName = ? AND round = ? AND machineId IN (${placeholders})`,
        [dateKey, shiftName, round, ...machineIdsToDelete]
      );
    }

    for (const entry of entries) {
      if (!entry.operatorId && (!entry.skus || entry.skus.length === 0 || entry.skus.every(s => !s.sku && !s.sapCode))) {
        continue;
      }

      if (entry.skus && entry.skus.length > 0 && entry.skus.some(s => s.sku || s.sapCode)) {
        for (const sku of entry.skus) {
          if (!sku.sku && !sku.sapCode) continue;
          await db.run(
            `INSERT INTO productionLogEntries 
             (date, shiftName, round, machineId, name, status, sku, sapCode, quantity, leftQty, rightQty, operatorId, userId, userName, remark) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              dateKey,
              shiftName,
              round,
              entry.machineId,
              entry.name,
              'Online',
              sku.sku || '',
              sku.sapCode || '',
              sku.quantity || 0,
              sku.leftQty,
              sku.rightQty,
              entry.operatorId || null,
              entry.userId || null,
              entry.userName || null,
              sku.remark || null,
            ]
          );
        }
      } else if (entry.operatorId) {
        // This case handles saving just the operator assignment without any production
        await db.run(
          `INSERT INTO productionLogEntries 
           (date, shiftName, round, machineId, name, status, operatorId, userId, userName, quantity) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            dateKey,
            shiftName,
            round,
            entry.machineId,
            entry.name,
            'Online',
            entry.operatorId,
            entry.userId || null,
            entry.userName || null,
            0,
          ]
        );
      }
    }
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    console.error('Failed to save production round:', error);
    throw error;
  }
}

export async function updateSingleProductionLog(entry: FlatProductionLogEntry) {
  await connect();
  
  const cavity = entry.leftQty && entry.leftQty > 0 ? 'L' : 'R';

  await db.run('BEGIN TRANSACTION');
  try {
    // Delete the original entry. A robust solution would use the primary key (id)
    await db.run(
      'DELETE FROM productionLogEntries WHERE id = ?',
      [entry.id]
    );

    // Insert the updated entry as a new row
    await db.run(
      `INSERT INTO productionLogEntries (date, shiftName, round, machineId, name, sku, sapCode, quantity, leftQty, rightQty, operatorId, userId, userName)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.date,
        entry.shiftName,
        entry.round,
        entry.machineId,
        entry.name,
        entry.sku,
        entry.sapCode,
        entry.quantity,
        cavity === 'L' ? entry.quantity : 0,
        cavity === 'R' ? entry.quantity : 0,
        entry.operatorId,
        entry.userId,
        entry.userName,
      ]
    );
    
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    console.error('Failed to update single production log entry:', error);
    throw error;
  }
}


export async function clearShiftData(date: Date, shift: ShiftInfo) {
  await connect();
  const dateKey = format(date, 'yyyy-MM-dd');
  const shiftName = shift.name.replace(/\s+/g, '-');
  await db.run(
    'DELETE FROM productionLogEntries WHERE date = ? AND shiftName = ?',
    [dateKey, shiftName]
  );
}

export async function saveDailyProductionLog(
  dateKey: string,
  shiftName: string,
  logForShift: Record<string, DailyProductionEntry>
): Promise<{success: boolean; error?: string}> {
  await connect();
  try {
    const existingData = await db.get(
      'SELECT data FROM dailyTreadProduction WHERE id = ?',
      dateKey
    );

    let fullDayLog: Record<string, Record<string, DailyProductionEntry>> = {};
    if (existingData) {
      try {
        fullDayLog = JSON.parse(existingData.data);
      } catch (e) {
        console.error(`Failed to parse existing daily log for ${dateKey}`, e);
        // If parsing fails, we might want to start fresh or handle the error.
        // For now, we'll overwrite with the new shift data.
      }
    }

    fullDayLog[shiftName] = logForShift;

    const dataJson = JSON.stringify(fullDayLog);
    await db.run(
      'INSERT OR REPLACE INTO dailyTreadProduction (id, data) VALUES (?, ?)',
      dateKey,
      dataJson
    );
    return {success: true};
  } catch (error) {
    console.error('Error in saveDailyProductionLog:', error);
    return {success: false, error: (error as Error).message};
  }
}

export async function saveTreadOpeningStock(stock: TreadStock[]) {
  await connect();
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

export async function saveCuringLogEntry(entry: CuringLogEntry) {
  await connect();
  try {
    await db.run(
      'INSERT INTO curingLogEntries (press_no, cavity1_sku, cavity1_qty, cavity2_sku, cavity2_qty) VALUES (?, ?, ?, ?, ?)',
      entry.press_no,
      entry.cavity1_sku,
      entry.cavity1_qty,
      entry.cavity2_sku,
      entry.cavity2_qty
    );
    return {success: true};
  } catch (error) {
    console.error('Error saving curing log entry:', error);
    return {success: false, message: 'Database error'};
  }
}

// User Actions
export async function signUpUser(
  data: SignUpInput
): Promise<{success: boolean; message?: string}> {
  await connect();
  const {name, email, mobile, password} = data;
  try {
    const existingUser = await db.get(
      'SELECT * FROM users WHERE email = ?',
      email.toLowerCase()
    );
    if (existingUser) {
      return {
        success: false,
        message: 'An account with this email already exists.',
      };
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.run(
      'INSERT INTO users (name, email, mobile, password) VALUES (?, ?, ?, ?)',
      name,
      email.toLowerCase(),
      mobile,
      hashedPassword
    );
    return {success: true};
  } catch (error) {
    console.error('Sign up error:', error);
    return {success: false, message: 'A database error occurred.'};
  }
}

export async function verifyUserLogin(
  email: string,
  pass: string
): Promise<{success: boolean; message?: string; user?: User}> {
  await connect();
  const user = await db.get(
    'SELECT * FROM users WHERE lower(email) = ?',
    email.toLowerCase()
  );
  
  if (!user) {
    return {success: false, message: 'Invalid email or password.'};
  }

  const isPasswordValid = await bcrypt.compare(pass, user.password);

  if (!isPasswordValid) {
    return {success: false, message: 'Invalid email or password.'};
  }

  if (!user.isApproved) {
    return {
      success: false,
      message: 'Your account has not been approved by an administrator yet.',
    };
  }

  // Important: Do not send the password hash to the client
  const { password, ...userWithoutPassword } = user;
  
  const userData: User = {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      isApproved: Boolean(user.isApproved),
      isAdmin: Boolean(user.isAdmin),
      canMakeEntry: Boolean(user.canMakeEntry),
      password: '', // This should not be sent to client
  };

  return {success: true, user: userData};
}

export async function getUsers(): Promise<User[]> {
  await connect();
  return db.all(
    'SELECT id, name, email, mobile, isApproved, isAdmin, canMakeEntry FROM users ORDER BY name'
  );
}

export async function approveUser(userId: number) {
  await connect();
  await db.run('UPDATE users SET isApproved = TRUE WHERE id = ?', userId);
}

export async function deleteUser(userId: number) {
  await connect();
  await db.run('DELETE FROM users WHERE id = ?', userId);
}

export async function updateUserPermissions(userId: number, canMakeEntry: boolean) {
  await connect();
  await db.run('UPDATE users SET canMakeEntry = ? WHERE id = ?', canMakeEntry, userId);
}


// Sku Standards
export async function getSkuStandards(): Promise<SkuStandard[]> {
  await connect();
  return db.all('SELECT * FROM skuStandards');
}

export async function updateSkuStandards(standards: SkuStandard[]) {
  await connect();
  await db.exec('BEGIN TRANSACTION');
  try {
    for (const standard of standards) {
      if (!standard.sapCode) continue;
      await db.run(
        'INSERT OR REPLACE INTO skuStandards (sapCode, sku, stdWeight, stdHourlyProduction) VALUES (?, ?, ?, ?)',
        standard.sapCode,
        standard.sku,
        standard.stdWeight,
        standard.stdHourlyProduction
      );
    }
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    console.error('Failed to update SKU standards:', error);
    throw error;
  }
}

export async function getCuringPlan() {
  await connect();
  try {
    const rows = await db.all('SELECT * FROM curingPlan');
    return rows.map(row => ({
      pressId: row.pressId,
      leftCavity: JSON.parse(row.leftCavity || '{}'),
      rightCavity: JSON.parse(row.rightCavity || '{}')
    }));
  } catch (error) {
    console.log('Curing plan table not found, returning empty array');
    return [];
  }
}

export async function saveCuringPlan(curingPlan: any[]) {
  await connect();
  await db.exec('BEGIN TRANSACTION');
  try {
    await db.run('DELETE FROM curingPlan');
    for (const press of curingPlan) {
      await db.run(
        'INSERT INTO curingPlan (pressId, leftCavity, rightCavity) VALUES (?, ?, ?)',
        press.pressId,
        JSON.stringify(press.leftCavity),
        JSON.stringify(press.rightCavity)
      );
    }
    await db.exec('COMMIT');
  } catch (error) {
    await db.exec('ROLLBACK');
    console.error('Failed to save curing plan:', error);
    throw error;
  }
}
