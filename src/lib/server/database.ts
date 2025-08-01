import sqlite3 from 'sqlite3';
import {open} from 'sqlite';
import {
  initialOperators,
  initialMachines,
  shifts,
  initialProductionPlan,
} from '../data';

// This is a top-level await, which is supported in modern TypeScript and Node.js.
// It ensures that the database is connected before any other module that imports this file can use it.
export const db = await open({
  filename: './database.db',
  driver: sqlite3.Database,
});

async function setup() {
  await db.exec(`
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
      isAvailable BOOLEAN
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
      quantity INTEGER,
      operatorId TEXT,
      remark TEXT,
      trolleyNo TEXT,
      UNIQUE(date, shiftName, round, machineId)
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
  `);

  // Check if the old remark and trolleyNo columns exist and drop them if they do
  // to avoid issues with schema changes during development.
  const columns = await db.all("PRAGMA table_info(productionLogEntries);");
  const columnNames = columns.map(c => c.name);
  if (columnNames.includes('remark') || columnNames.includes('trolleyNo')) {
     // To simplify, we'll just recreate the table without them.
     await db.exec('DROP TABLE IF EXISTS productionLogEntries;');
     await db.exec(`
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
        quantity INTEGER,
        operatorId TEXT,
        UNIQUE(date, shiftName, round, machineId)
      );
     `);
  }


  // Drop the old problematic table if it exists
  await db.exec('DROP TABLE IF EXISTS productionLogs;');

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

  const machineCount = await db.get('SELECT COUNT(*) as count FROM machines');
  if (machineCount.count === 0) {
    for (const m of initialMachines) {
      await db.run(
        'INSERT INTO machines (id, name, isAvailable) VALUES (?, ?, ?)',
        m.id,
        m.name,
        m.isAvailable
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

setup();
