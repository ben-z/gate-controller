import { config } from "@/config";
import { GateStatus, HistoryEntry } from "@/types/gate";
import { Schedule } from "@/types/schedule";
import { CreateUserParams, UpdateUserParams, User } from "@/types/user";
import bcrypt from "bcrypt";
import Database from "better-sqlite3";
import { mkdir } from "fs/promises";
import path from "path";

// MARK: Ensure data directory exists
await mkdir(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);

// MARK: Initialize database
function initializeDB() {
  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Create tables
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
    created_at INTEGER NOT NULL,
    created_by TEXT,
    FOREIGN KEY (created_by) REFERENCES users(username)
  );

  CREATE TABLE IF NOT EXISTS gate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL CHECK(action IN ('open', 'close')),
    timestamp INTEGER NOT NULL,
    actor TEXT NOT NULL CHECK(actor IN ('manual', 'schedule', 'system')),
    username TEXT,
    FOREIGN KEY (username) REFERENCES users(username)
  );

  CREATE TABLE IF NOT EXISTS last_contact (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('open', 'close')),
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(username)
  );
`);

  // Create indexes
  db.exec(`
  CREATE INDEX IF NOT EXISTS idx_gate_history_timestamp ON gate_history(timestamp);
  CREATE INDEX IF NOT EXISTS idx_schedules_created_by ON schedules(created_by);
`);

  // Initialize gate history if it doesn't exist
  const gateHistoryCount = countGateHistoryStmt.get() as { count: number };
  if (gateHistoryCount.count === 0) {
    db.exec(`
    INSERT INTO gate_history (action, timestamp, actor) 
    VALUES ('close', ${Date.now()}, 'system');
  `);
  }

  // Initialize last contact if it doesn't exist
  const lastContactCount = countLastContactStmt.get() as { count: number };
  if (lastContactCount.count === 0) {
    db.exec(`
    INSERT INTO last_contact (id, timestamp) 
    VALUES (1, 0);
  `);
  }

  // Initialize admin account if no users exist
  const userCount = countUsersStmt.get() as { count: number };
  if (userCount.count === 0) {
    const { username, password } = config.adminCredentials;
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const now = Date.now();

    insertUserStmt.run(username, passwordHash, salt, "admin", now);
  }
}

// MARK: Gate Status
const countGateHistoryStmt = db.prepare(
  "SELECT COUNT(*) as count FROM gate_history"
);
const getLatestHistoryStmt = db.prepare(
  "SELECT action, timestamp FROM gate_history ORDER BY timestamp DESC LIMIT 1"
);
const getHistoryStmt = db.prepare(
  "SELECT action, timestamp, actor, username FROM gate_history ORDER BY timestamp DESC LIMIT 50"
);
const insertHistoryStmt = db.prepare(
  "INSERT INTO gate_history (action, timestamp, actor, username) VALUES (?, ?, ?, ?)"
);
const countLastContactStmt = db.prepare(
  "SELECT COUNT(*) as count FROM last_contact"
);
const getLastContactStmt = db.prepare(
  "SELECT timestamp FROM last_contact WHERE id = 1"
);
const updateLastContactStmt = db.prepare(
  "UPDATE last_contact SET timestamp = ? WHERE id = 1"
);

export function getGateStatus(includeHistory: boolean = false): GateStatus {
  const latest = getLatestHistoryStmt.get() as {
    action: "open" | "close";
    timestamp: number;
  };

  const lastContact = getLastContactStmt.get() as { timestamp: number };

  const result: GateStatus = {
    status: latest.action === "open" ? "open" : "closed",
    lastContactTimestamp: lastContact.timestamp,
  };

  if (includeHistory) {
    result.history = getHistoryStmt.all() as HistoryEntry[];
  }

  return result;
}

export function updateGateStatus(
  newAction: "open" | "close",
  actor: "manual" | "schedule" | "system" = "manual",
  username?: string
): void {
  const now = Date.now();

  // Add to history
  insertHistoryStmt.run(
    newAction,
    now,
    actor,
    actor === "manual" ? username : null
  );
}

export function updateLastContact(): void {
  updateLastContactStmt.run(Date.now());
}

// MARK: Users
const countUsersStmt = db.prepare("SELECT COUNT(*) as count FROM users");
const getUsersStmt = db.prepare("SELECT * FROM users ORDER BY created_at DESC");
const getUserStmt = db.prepare("SELECT * FROM users WHERE id = ?");
const insertUserStmt = db.prepare(`
  INSERT INTO users (username, password_hash, salt, role, created_at)
  VALUES (?, ?, ?, ?, ?)
`);
const updateUserStmt = db.prepare(`
  UPDATE users 
  SET password_hash = ?, salt = ?, role = ?
  WHERE id = ?
`);
const deleteUserStmt = db.prepare("DELETE FROM users WHERE id = ?");

export function getUsers(): User[] {
  return (getUsersStmt.all() as User[]).map((user) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    created_at: user.created_at,
    created_by: user.created_by,
  }));
}

export function getUser(id: number): User | null {
  const user = getUserStmt.get(id) as User | undefined;
  return user ? {
    id: user.id,
    username: user.username,
    role: user.role,
    created_at: user.created_at,
    created_by: user.created_by,
  } : null;
}

export function createUser(user: CreateUserParams): User {
  const now = Date.now();
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(user.password, salt);

  const result = insertUserStmt.run(
    user.username,
    passwordHash,
    salt,
    user.role,
    now
  );

  return {
    id: result.lastInsertRowid as number,
    username: user.username,
    role: user.role,
    created_at: now,
    created_by: user.created_by,
  };
}

export function updateUser(user: UpdateUserParams): void {
  updateUserStmt.run(
    user.password,
    user.role,
    user.id
  );
}

export function deleteUser(id: number): void {
  deleteUserStmt.run(id);
}

// MARK: Schedules
const getSchedulesStmt = db.prepare(
  "SELECT * FROM schedules ORDER BY created_at DESC"
);
const getScheduleStmt = db.prepare("SELECT * FROM schedules WHERE id = ?");
const insertScheduleStmt = db.prepare(`
  INSERT INTO schedules (name, cron_expression, action, enabled, created_at, created_by)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const updateScheduleStmt = db.prepare(`
  UPDATE schedules 
  SET name = ?, cron_expression = ?, action = ?, enabled = ?
  WHERE id = ?
`);
const deleteScheduleStmt = db.prepare("DELETE FROM schedules WHERE id = ?");

export function getSchedules(): Schedule[] {
  return getSchedulesStmt.all() as Schedule[];
}

export function getSchedule(id: number): Schedule | null {
  const schedule = getScheduleStmt.get(id) as Schedule | undefined;
  return schedule || null;
}

export function createSchedule(
  schedule: Omit<Schedule, "id"> & { created_by: number }
): Schedule {
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
    enabled: schedule.enabled,
  };
}

export function updateSchedule(
  id: number,
  updates: Partial<Omit<Schedule, "id">>
): Schedule {
  const existing = getSchedule(id);
  if (!existing) throw new Error(`Schedule not found: ${id}`);

  const updated = {
    ...existing,
    ...updates,
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

initializeDB();

export default db;
