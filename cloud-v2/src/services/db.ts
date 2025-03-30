import Database from 'better-sqlite3';
import { join } from 'path';
import { HistoryEntry, GateStatus } from '@/types/gate';
import { Schedule } from '@/services/schedule';

// Initialize database
const db = new Database(join(process.cwd(), 'gate.db'));

interface ScheduleRow {
  id: string;
  name: string;
  cron_expression: string;
  action: 'open' | 'closed';
  enabled: number;
  created_at: number;
  updated_at: number;
}

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS gate_status (
    id INTEGER PRIMARY KEY,
    status TEXT NOT NULL CHECK(status IN ('open', 'closed')),
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS gate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL CHECK(action IN ('open', 'closed')),
    timestamp INTEGER NOT NULL,
    actor TEXT NOT NULL CHECK(actor IN ('manual', 'schedule', 'system'))
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('open', 'closed')),
    enabled INTEGER NOT NULL CHECK(enabled IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Insert initial status if not exists
  INSERT OR IGNORE INTO gate_status (id, status, updated_at) 
  VALUES (1, 'closed', ${Date.now()});
`);

// Prepare statements for better performance
const getStatusStmt = db.prepare('SELECT status FROM gate_status WHERE id = 1');
const updateStatusStmt = db.prepare('UPDATE gate_status SET status = ?, updated_at = ? WHERE id = 1');
const getHistoryStmt = db.prepare('SELECT action, timestamp, actor FROM gate_history ORDER BY timestamp DESC LIMIT 10');
const insertHistoryStmt = db.prepare('INSERT INTO gate_history (action, timestamp, actor) VALUES (?, ?, ?)');

// Schedule statements
const getSchedulesStmt = db.prepare('SELECT * FROM schedules ORDER BY created_at DESC');
const getScheduleStmt = db.prepare('SELECT * FROM schedules WHERE id = ?');
const insertScheduleStmt = db.prepare(`
  INSERT INTO schedules (id, name, cron_expression, action, enabled, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const updateScheduleStmt = db.prepare(`
  UPDATE schedules 
  SET name = ?, cron_expression = ?, action = ?, enabled = ?, updated_at = ?
  WHERE id = ?
`);
const deleteScheduleStmt = db.prepare('DELETE FROM schedules WHERE id = ?');

export function getGateStatus(includeHistory: boolean = false): GateStatus {
  const status = getStatusStmt.get() as { status: 'open' | 'closed' };
  const result: GateStatus = { status: status.status };
  
  if (includeHistory) {
    result.history = getHistoryStmt.all() as HistoryEntry[];
  }
  
  return result;
}

export function updateGateStatus(newStatus: 'open' | 'closed', includeHistory: boolean = false, actor: 'manual' | 'schedule' | 'system' = 'manual'): GateStatus {
  const now = Date.now();
  
  // Update status
  updateStatusStmt.run(newStatus, now);
  
  // Add to history
  insertHistoryStmt.run(newStatus, now, actor);
  
  // Get updated state
  return getGateStatus(includeHistory);
}

// Schedule functions
export function getSchedules(): Schedule[] {
  return (getSchedulesStmt.all() as ScheduleRow[]).map(row => ({
    id: row.id,
    name: row.name,
    cronExpression: row.cron_expression,
    action: row.action,
    enabled: Boolean(row.enabled)
  }));
}

export function getSchedule(id: string): Schedule | null {
  const row = getScheduleStmt.get(id) as ScheduleRow | undefined;
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    cronExpression: row.cron_expression,
    action: row.action,
    enabled: Boolean(row.enabled)
  };
}

export function createSchedule(schedule: Omit<Schedule, 'id'>): Schedule {
  const now = Date.now();
  const id = crypto.randomUUID();
  
  insertScheduleStmt.run(
    id,
    schedule.name,
    schedule.cronExpression,
    schedule.action,
    schedule.enabled ? 1 : 0,
    now,
    now
  );
  
  return {
    ...schedule,
    id
  };
}

export function updateSchedule(id: string, updates: Partial<Omit<Schedule, 'id'>>): Schedule {
  const existing = getSchedule(id);
  if (!existing) throw new Error(`Schedule not found: ${id}`);
  
  const now = Date.now();
  const updated = {
    ...existing,
    ...updates,
    updated_at: now
  };
  
  updateScheduleStmt.run(
    updated.name,
    updated.cronExpression,
    updated.action,
    updated.enabled ? 1 : 0,
    now,
    id
  );
  
  return {
    id,
    name: updated.name,
    cronExpression: updated.cronExpression,
    action: updated.action,
    enabled: updated.enabled
  };
}

export function deleteSchedule(id: string): void {
  const result = deleteScheduleStmt.run(id);
  if (result.changes === 0) {
    throw new Error(`Schedule not found: ${id}`);
  }
} 