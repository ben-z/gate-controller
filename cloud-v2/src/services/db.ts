import Database from 'better-sqlite3';
import { join } from 'path';
import { HistoryEntry, GateStatus } from '@/types/gate';
import { Schedule } from '@/services/schedule';
import bcrypt from 'bcrypt';
import { mkdir } from 'fs/promises';
import { config } from '@/config';
// Ensure data directory exists
const dataDir = join(process.cwd(), 'data');
await mkdir(dataDir, { recursive: true });

const dbPath = join(dataDir, 'gate.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables with consistent schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at INTEGER NOT NULL,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS gate_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL CHECK(action IN ('open', 'closed')),
    timestamp INTEGER NOT NULL,
    actor TEXT NOT NULL CHECK(actor IN ('manual', 'schedule', 'system')),
    username TEXT,
    FOREIGN KEY (username) REFERENCES users(username)
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('open', 'close')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
`);

// Create indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_gate_status_timestamp ON gate_status(timestamp);
  CREATE INDEX IF NOT EXISTS idx_gate_history_timestamp ON gate_history(timestamp);
  CREATE INDEX IF NOT EXISTS idx_schedules_created_by ON schedules(created_by);
`);

// Initialize gate status if it doesn't exist
const gateStatusCount = db.prepare('SELECT COUNT(*) as count FROM gate_status').get() as { count: number };
if (gateStatusCount.count === 0) {
  db.exec(`
    INSERT INTO gate_status (id, status, timestamp) 
    VALUES (1, 'closed', ${Date.now()});
  `);
}

// Initialize admin account if no users exist
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const { username, password } = config.adminCredentials;
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = Date.now();
  
  try {
    db.prepare(`
      INSERT INTO users (username, password_hash, role, created_at)
      VALUES (?, ?, 'admin', ?)
    `).run(username, passwordHash, now);
  } catch (error) {
    console.error('Failed to create admin account:', error);
    // Don't throw here - we want the app to start even if admin creation fails
  }
}

// Prepare statements for better performance
const getStatusStmt = db.prepare('SELECT status, timestamp FROM gate_status WHERE id = 1');
const updateStatusStmt = db.prepare('UPDATE gate_status SET status = ?, timestamp = ? WHERE id = 1');
const updateLastContactStmt = db.prepare('UPDATE gate_status SET timestamp = ? WHERE id = 1');
const getHistoryStmt = db.prepare('SELECT action, timestamp, actor, username FROM gate_history ORDER BY timestamp DESC LIMIT 10');
const insertHistoryStmt = db.prepare('INSERT INTO gate_history (action, timestamp, actor, username) VALUES (?, ?, ?, ?)');

// Schedule statements
const getSchedulesStmt = db.prepare('SELECT * FROM schedules ORDER BY created_at DESC');
const getScheduleStmt = db.prepare('SELECT * FROM schedules WHERE id = ?');
const insertScheduleStmt = db.prepare(`
  INSERT INTO schedules (name, cron_expression, action, is_active, created_at, created_by)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const updateScheduleStmt = db.prepare(`
  UPDATE schedules 
  SET name = ?, cron_expression = ?, action = ?, is_active = ?
  WHERE id = ?
`);
const deleteScheduleStmt = db.prepare('DELETE FROM schedules WHERE id = ?');

export function getGateStatus(includeHistory: boolean = false): GateStatus {
  const status = getStatusStmt.get() as { 
    status: 'open' | 'closed';
    timestamp: number;
  };

  const result: GateStatus = { 
    status: status.status,
    lastContactTimestamp: status.timestamp
  };
  
  if (includeHistory) {
    result.history = getHistoryStmt.all() as HistoryEntry[];
  }
  
  return result;
}

export function updateGateStatus(newStatus: 'open' | 'closed', includeHistory: boolean = false, actor: 'manual' | 'schedule' | 'system' = 'manual', username?: string): GateStatus {
  const now = Date.now();
  
  // Update status
  updateStatusStmt.run(newStatus, now);
  
  // Add to history
  insertHistoryStmt.run(newStatus, now, actor, actor === 'manual' ? username : null);
  
  // Get updated state
  return getGateStatus(includeHistory);
}

export function updateLastContact(): void {
  updateLastContactStmt.run(Date.now());
}

// Schedule functions
export function getSchedules(): Schedule[] {
  return getSchedulesStmt.all() as Schedule[];
}

export function getSchedule(id: number): Schedule | null {
  const schedule = getScheduleStmt.get(id) as Schedule | undefined;
  return schedule || null;
}

export function createSchedule(schedule: Omit<Schedule, 'id'> & { created_by: number }): Schedule {
  const now = Date.now();
  
  const result = insertScheduleStmt.run(
    schedule.name,
    schedule.cronExpression,
    schedule.action,
    schedule.enabled ? 1 : 0,
    now,
    schedule.created_by
  );

  return {
    id: result.lastInsertRowid as number,
    name: schedule.name,
    cronExpression: schedule.cronExpression,
    action: schedule.action,
    enabled: schedule.enabled
  };
}

export function updateSchedule(id: number, updates: Partial<Omit<Schedule, 'id'>>): Schedule {
  const existing = getSchedule(id);
  if (!existing) throw new Error(`Schedule not found: ${id}`);

  const updated = {
    ...existing,
    ...updates
  };

  updateScheduleStmt.run(
    updated.name,
    updated.cronExpression,
    updated.action,
    updated.enabled ? 1 : 0,
    id
  );

  return updated;
}

export function deleteSchedule(id: number): void {
  const result = deleteScheduleStmt.run(id);
  if (result.changes === 0) {
    throw new Error(`Schedule not found: ${id}`);
  }
}

export default db; 