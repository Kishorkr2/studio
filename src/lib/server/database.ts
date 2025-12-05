
import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import {
  initialOperators,
  initialMachines,
  shifts,
  initialProductionPlan,
} from '../data';
import bcrypt from 'bcryptjs';
import type { Machine } from '../types';

// This is a top-level await, which is supported in modern TypeScript and Node.js.
// It ensures that the database is connected before any other module that imports this file can use it.
export let db: any;

export async function connect() {
  if (db) return;

  db = await open({
    filename: './database.db',
    driver: sqlite3.Database,
  });
  await setup();
}

async function setup() {
  await db.exec('PRAGMA journal_mode = WAL;');
  
  const userColumns = await db.all("PRAGMA table_info(users)").catch(() => []);
  if (!userColumns.some((col: any) => col.name === 'canMakeEntry')) {
    await db.exec('ALTER TABLE users ADD COLUMN canMakeEntry BOOLEAN DEFAULT FALSE').catch(() => {});
  }

  // Only recreate table if it doesn't exist properly
  const tableInfo = await db.all("PRAGMA table_info(productionLogEntries)").catch(() => []);
  if (tableInfo.length === 0) {
    console.log('Creating productionLogEntries table');
  }

  const existingColumns = await db.all("PRAGMA table_info(machines)").catch(() => []);
  const hasTypeColumn = existingColumns.some((col: any) => col.name === 'type');

  if (!hasTypeColumn) {
    await db.exec('ALTER TABLE machines RENAME TO machines_old;').catch(() => {});
    await db.exec(`
      CREATE TABLE IF NOT EXISTS machines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        isAvailable BOOLEAN,
        type TEXT NOT NULL DEFAULT 'TBM'
      );
    `);
    await db.exec('INSERT INTO machines (id, name, isAvailable) SELECT id, name, isAvailable FROM machines_old;').catch(() => {});
    await db.exec('DROP TABLE machines_old;').catch(() => {});
  }


  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      mobile TEXT NOT NULL,
      password TEXT NOT NULL,
      isApproved BOOLEAN DEFAULT FALSE,
      isAdmin BOOLEAN DEFAULT FALSE,
      canMakeEntry BOOLEAN DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS operators (
      cardNo TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      builderNo TEXT,
      skillRating INTEGER,
      isAbsent BOOLEAN
    );
    CREATE TABLE IF NOT EXISTS machines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        isAvailable BOOLEAN,
        type TEXT NOT NULL DEFAULT 'TBM'
    );
    CREATE TABLE IF NOT EXISTS shifts (
      name TEXT PRIMARY KEY,
      startTime TEXT,
      endTime TEXT
    );
    CREATE TABLE IF NOT EXISTS productionPlanItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machineId TEXT,
      sku TEXT,
      sapCode TEXT,
      quantity INTEGER
    );
    CREATE TABLE IF NOT EXISTS productionLogEntries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      shiftName TEXT NOT NULL,
      round TEXT NOT NULL,
      machineId TEXT NOT NULL,
      name TEXT,
      status TEXT,
      sku TEXT,
      sapCode TEXT,
      quantity INTEGER DEFAULT 0,
      leftQty INTEGER,
      rightQty INTEGER,
      operatorId TEXT,
      userId INTEGER,
      userName TEXT,
      remark TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS curingLogEntries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        press_no INTEGER NOT NULL,
        cavity1_sku TEXT,
        cavity1_qty INTEGER,
        cavity2_sku TEXT,
        cavity2_qty INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS dailyTreadProduction (
      id TEXT PRIMARY KEY,
      data TEXT
    );
    CREATE TABLE IF NOT EXISTS treadOpeningStock (
      sapCode TEXT PRIMARY KEY,
      sku TEXT,
      openingStock INTEGER,
      production INTEGER
    );
    CREATE TABLE IF NOT EXISTS skuStandards (
      sapCode TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      stdWeight REAL,
      stdHourlyProduction INTEGER
    );
    CREATE TABLE IF NOT EXISTS curingPlan (
      pressId TEXT PRIMARY KEY,
      leftCavity TEXT,
      rightCavity TEXT
    );
  `);
  
  // Seed Admin user
  const adminUser = await db.get('SELECT * FROM users WHERE email = ?', 'ralson@ralson.com');
  if (!adminUser) {
    const hashedPassword = await bcrypt.hash('ralson@123', 10);
    await db.run(
      'INSERT INTO users (name, email, mobile, password, isApproved, isAdmin, canMakeEntry) VALUES (?, ?, ?, ?, ?, ?, ?)',
      'Ralson Admin', 'ralson@ralson.com', '1234567890', hashedPassword, true, true, true
    );
  } else {
    // Ensure admin user has all rights on restart
    await db.run('UPDATE users SET isAdmin = ?, canMakeEntry = ?, isApproved = ? WHERE email = ?', true, true, true, 'ralson@ralson.com');
  }

  const operatorCount = await db.get('SELECT COUNT(*) as count FROM operators');
  if (operatorCount.count === 0) {
    for (const op of initialOperators) {
      await db.run(
        'INSERT INTO operators (cardNo, name, builderNo, skillRating, isAbsent) VALUES (?, ?, ?, ?, ?)',
        op.cardNo,
        op.name,
        op.builderNo,
        op.skillRating,
        op.isAbsent
      );
    }
  }

  const machineCountResult = await db.get('SELECT COUNT(*) as count FROM machines');
  const machineCount = machineCountResult?.count ?? 0;
  if (machineCount === 0) {
    // Seed TBMs
    for (const m of initialMachines) {
      await db.run(
        'INSERT INTO machines (id, name, isAvailable, type) VALUES (?, ?, ?, ?)',
        m.id,
        m.name,
        m.isAvailable,
        m.type
      );
    }
    // Seed Curing Presses
     for (let i = 1; i <= 42; i++) {
        const curingPress: Machine = {
            id: `CP-${String(i).padStart(2, '0')}`,
            name: `Curing Press ${i}`,
            isAvailable: true,
            type: 'CuringPress'
        };
        await db.run(
            'INSERT INTO machines (id, name, isAvailable, type) VALUES (?, ?, ?, ?)',
            curingPress.id,
            curingPress.name,
            curingPress.isAvailable,
            curingPress.type
        );
    }
  }

  const shiftCount = await db.get('SELECT COUNT(*) as count FROM shifts');
  if (shiftCount.count === 0) {
    for (const s of shifts) {
      await db.run(
        'INSERT INTO shifts (name, startTime, endTime) VALUES (?, ?, ?)',
        s.name,
        s.startTime,
        s.endTime
      );
    }
  }

  const planCount = await db.get(
    'SELECT COUNT(*) as count FROM productionPlanItems'
  );
  if (planCount.count === 0) {
    for (const p of initialProductionPlan) {
      for (const sku of p.skus) {
        await db.run(
          'INSERT INTO productionPlanItems (machineId, sku, sapCode, quantity) VALUES (?, ?, ?, ?)',
          p.machineId,
          sku.sku,
          sku.sapCode,
          sku.quantity
        );
      }
    }
  }
}

connect();
