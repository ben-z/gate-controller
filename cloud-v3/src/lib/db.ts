import { config, secrets } from "@/config";
import { GateStatus, HistoryEntry } from "@/types/gate";
import { Schedule } from "@/types/schedule";
import { Session } from "@/types/session";
import {
  CreateUserParams,
  UpdateUserParams,
  User,
  UserCredentials,
} from "@/types/user";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import crypto from "crypto";
import { mkdir } from "fs/promises";
import path from "path";

const SESSION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30; // 30 days

// MARK: Ensure data directory exists
await mkdir(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);

// MARK: Initialize database

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at INTEGER NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  session_key TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (username) REFERENCES users(username)
);

CREATE TABLE IF NOT EXISTS gate_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL CHECK(action IN ('open', 'close')),
  timestamp INTEGER NOT NULL,
  actor TEXT NOT NULL CHECK(actor IN ('user', 'schedule', 'system')),
  actor_name TEXT
);

CREATE TABLE IF NOT EXISTS last_contact (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  name TEXT PRIMARY KEY,
  cron_expression TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('open', 'close')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);
`);

// Create indexes
db.exec(`
CREATE INDEX IF NOT EXISTS idx_gate_history_timestamp ON gate_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_schedules_created_by ON schedules(created_by);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`);

// MARK: Bootstrap database
function bootstrapDB() {
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
    const { username, password } = secrets.initialAdminCredentials;
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    const now = Date.now();

    insertUserStmt.run(username, passwordHash, "admin", now);
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
  "SELECT action, timestamp, actor, actor_name FROM gate_history ORDER BY timestamp DESC LIMIT 50"
);
const insertHistoryStmt = db.prepare(
  "INSERT INTO gate_history (action, timestamp, actor, actor_name) VALUES (?, ?, ?, ?)"
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
  actor: "user" | "schedule" | "system" = "user",
  actor_name?: string
): void {
  const now = Date.now();

  // Add to history
  insertHistoryStmt.run(
    newAction,
    now,
    actor,
    actor_name
  );
}

export function updateLastContact(): void {
  updateLastContactStmt.run(Date.now());
}

// MARK: Users
const countUsersStmt = db.prepare("SELECT COUNT(*) as count FROM users");
const getUsersStmt = db.prepare("SELECT * FROM users ORDER BY created_at DESC");
const getUserByUsernameStmt = db.prepare(
  "SELECT * FROM users WHERE username = ?"
);
const getUserStmt = db.prepare("SELECT * FROM users WHERE username = ?");
const insertUserStmt = db.prepare(`
  INSERT INTO users (username, password_hash, role, created_at)
  VALUES (?, ?, ?, ?)
`);
const updateUserStmt = db.prepare(`
  UPDATE users 
  SET password_hash = ?, role = ?
  WHERE username = ?
`);
const deleteUserStmt = db.prepare("DELETE FROM users WHERE username = ?");
const insertSessionStmt = db.prepare(`
  INSERT INTO sessions (session_key, username, created_at, expires_at)
  VALUES (?, ?, ?, ?)
`);
const updateSessionStmt = db.prepare(`
  UPDATE sessions 
  SET session_key = ?, username = ?, created_at = ?, expires_at = ?
  WHERE session_key = ?
`);
const getSessionStmt = db.prepare(
  "SELECT * FROM sessions WHERE session_key = ?"
);
const deleteSessionStmt = db.prepare(
  "DELETE FROM sessions WHERE session_key = ?"
);
const deleteSessionsByUsernameStmt = db.prepare(
  "DELETE FROM sessions WHERE username = ?"
);

export function getUsers(): User[] {
  return (getUsersStmt.all() as User[]).map((user) => ({
    username: user.username,
    role: user.role,
    created_at: user.created_at,
    created_by: user.created_by,
  }));
}

export function getUser(id: number): User | null {
  const user = getUserStmt.get(id) as User | undefined;
  return user
    ? {
        username: user.username,
        role: user.role,
        created_at: user.created_at,
        created_by: user.created_by,
      }
    : null;
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<{ user: User; session: Session } | null> {
  const now = Date.now();

  const user = getUserByUsernameStmt.get(username) as
    | (UserCredentials & User)
    | undefined;
  if (!user) return null;

  if (await bcrypt.compare(password, user.password_hash)) {
    const sessionKey = crypto.randomBytes(32).toString("hex");
    insertSessionStmt.run(
      sessionKey,
      user.username,
      now,
      now + SESSION_EXPIRATION_TIME
    );

    return {
      user: {
        username: user.username,
        role: user.role,
        created_at: user.created_at,
        created_by: user.created_by,
      },
      session: {
        session_key: sessionKey,
        username: user.username,
        created_at: now,
        expires_at: now + SESSION_EXPIRATION_TIME,
      },
    };
  }

  return null;
}

export function deleteSession(sessionKey: string): void {
  deleteSessionStmt.run(sessionKey);
}

export function refreshSession(
  sessionKey: string
): { user: User; session: Session } | null {
  const now = Date.now();
  const session = getSessionStmt.get(sessionKey) as Session | undefined;
  if (!session) return null;

  if (session.expires_at < now) {
    deleteSession(sessionKey);
    return null;
  }

  const user = getUserByUsernameStmt.get(session.username) as User | undefined;
  if (!user) {
    throw new Error(`User not found: ${session.username}. This should never happen because we have a foreign key constraint on the sessions table.`);
  }

  updateSessionStmt.run(
    sessionKey,
    session.username,
    session.created_at,
    now + SESSION_EXPIRATION_TIME,
    sessionKey
  );

  return {
    user: {
      username: session.username,
      role: user.role,
      created_at: user.created_at,
      created_by: user.created_by,
    },
    session: {
      session_key: sessionKey,
      username: session.username,
      created_at: session.created_at,
      expires_at: now + SESSION_EXPIRATION_TIME,
    },
  };
}

export function createUser(user: CreateUserParams): User {
  const now = Date.now();
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(user.password, salt);

  insertUserStmt.run(user.username, passwordHash, user.role, now);

  return {
    username: user.username,
    role: user.role,
    created_at: now,
    created_by: user.created_by,
  };
}

export function updateUser(user: UpdateUserParams): void {
  const existing = getUserByUsernameStmt.get(user.username) as (User & UserCredentials) | undefined;
  if (!existing) throw new Error(`User not found: ${user.username}`);

  const passwordHash = user.password ? bcrypt.hashSync(user.password, bcrypt.genSaltSync(10)) : existing.password_hash;

  updateUserStmt.run(passwordHash, user.role, user.username);
}

export function deleteUser(username: string): void {
  // Clear sessions for this user
  deleteSessionsByUsernameStmt.run(username);

  deleteUserStmt.run(username);
}

// MARK: Schedules
const getSchedulesStmt = db.prepare(
  "SELECT * FROM schedules ORDER BY created_at DESC"
);

const getScheduleStmt = db.prepare("SELECT * FROM schedules WHERE name = ?");
const insertScheduleStmt = db.prepare(`
  INSERT INTO schedules (name, cron_expression, action, enabled, created_at, created_by)
  VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
`);

const updateScheduleStmt = db.prepare(`
  UPDATE schedules
  SET cron_expression = ?, action = ?, enabled = ?, created_by = ?
  WHERE name = ?
`);

const deleteScheduleStmt = db.prepare("DELETE FROM schedules WHERE name = ?");

export function getSchedules(): Schedule[] {
  return getSchedulesStmt.all() as Schedule[];
}

export function getSchedule(name: string): Schedule | null {
  const schedule = getScheduleStmt.get(name) as Schedule | undefined;
  return schedule || null;
}

export function createSchedule(
  schedule: Omit<Schedule, "name"> & { created_by: string; name: string }
): Schedule {
  insertScheduleStmt.run(
    schedule.name,
    schedule.cron_expression,
    schedule.action,
    schedule.enabled ? 1 : 0,
    schedule.created_by
  );

  return {
    name: schedule.name,
    cron_expression: schedule.cron_expression,
    action: schedule.action,
    enabled: schedule.enabled,
    created_by: schedule.created_by
  };
}

export function updateSchedule(
  name: string,
  updates: Partial<Omit<Schedule, "name">>
): Schedule {
  const existing = getSchedule(name);
  if (!existing) throw new Error(`Schedule not found: ${name}`);

  const updatedSchedule = {
    ...existing,
    ...updates,
    name // Keep the original name as it's the primary key
  };

  updateScheduleStmt.run(
    updatedSchedule.cron_expression,
    updatedSchedule.action,
    updatedSchedule.enabled ? 1 : 0,
    updatedSchedule.created_by,
    name
  );

  return updatedSchedule;
}

export function deleteSchedule(name: string): void {
  const result = deleteScheduleStmt.run(name);
  if (result.changes === 0) {
    throw new Error(`Schedule not found: ${name}`);
  }
}

bootstrapDB();

export default db;
