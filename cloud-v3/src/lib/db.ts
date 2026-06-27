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
import { mkdirSync } from "fs";
import path from "path";

const SESSION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30; // 30 days

type UserRow = Omit<User, "created_by"> & { created_by: string | null };
type ScheduleRow = Omit<Schedule, "enabled" | "created_by"> & {
  enabled: 0 | 1;
  created_by: string | null;
};
type CountRow = { count: number };
type DatabaseConnection = Database.Database;
type Statements = ReturnType<typeof prepareStatements>;

type DbRuntime = {
  db: DatabaseConnection;
  statements: Statements;
};

const globalForDb = globalThis as typeof globalThis & {
  gateDbRuntime?: DbRuntime;
};

function getRuntime(): DbRuntime {
  if (!globalForDb.gateDbRuntime) {
    mkdirSync(path.dirname(config.dbPath), { recursive: true });

    const db = new Database(config.dbPath);
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");

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

CREATE INDEX IF NOT EXISTS idx_gate_history_timestamp ON gate_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_schedules_created_by ON schedules(created_by);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions(username);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`);

    const runtime = { db, statements: prepareStatements(db) };

    bootstrapDB(runtime);
    globalForDb.gateDbRuntime = runtime;
  }

  return globalForDb.gateDbRuntime;
}

function prepareStatements(db: DatabaseConnection) {
  return {
    countGateHistory: db.prepare("SELECT COUNT(*) as count FROM gate_history"),
    getLatestHistory: db.prepare(
      "SELECT action, timestamp FROM gate_history ORDER BY timestamp DESC LIMIT 1"
    ),
    getHistory: db.prepare(
      "SELECT action, timestamp, actor, actor_name FROM gate_history ORDER BY timestamp DESC LIMIT 50"
    ),
    insertHistory: db.prepare(
      "INSERT INTO gate_history (action, timestamp, actor, actor_name) VALUES (?, ?, ?, ?)"
    ),
    countLastContact: db.prepare("SELECT COUNT(*) as count FROM last_contact"),
    getLastContact: db.prepare("SELECT timestamp FROM last_contact WHERE id = 1"),
    updateLastContact: db.prepare(
      "UPDATE last_contact SET timestamp = ? WHERE id = 1"
    ),
    countUsers: db.prepare("SELECT COUNT(*) as count FROM users"),
    getUsers: db.prepare("SELECT * FROM users ORDER BY created_at DESC"),
    getUserByUsername: db.prepare("SELECT * FROM users WHERE username = ?"),
    insertUser: db.prepare(`
      INSERT INTO users (username, password_hash, role, created_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `),
    insertBootstrapUser: db.prepare(`
      INSERT OR IGNORE INTO users (username, password_hash, role, created_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `),
    updateUser: db.prepare(`
      UPDATE users
      SET password_hash = ?, role = ?
      WHERE username = ?
    `),
    deleteUser: db.prepare("DELETE FROM users WHERE username = ?"),
    insertSession: db.prepare(`
      INSERT INTO sessions (session_key, username, created_at, expires_at)
      VALUES (?, ?, ?, ?)
    `),
    updateSession: db.prepare(`
      UPDATE sessions
      SET expires_at = ?
      WHERE session_key = ?
    `),
    getSession: db.prepare("SELECT * FROM sessions WHERE session_key = ?"),
    deleteSession: db.prepare("DELETE FROM sessions WHERE session_key = ?"),
    deleteSessionsByUsername: db.prepare("DELETE FROM sessions WHERE username = ?"),
    countAdmins: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'"),
    getSchedules: db.prepare("SELECT * FROM schedules ORDER BY created_at DESC"),
    getSchedule: db.prepare("SELECT * FROM schedules WHERE name = ?"),
    insertSchedule: db.prepare(`
      INSERT INTO schedules (name, cron_expression, action, enabled, created_at, created_by)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `),
    updateSchedule: db.prepare(`
      UPDATE schedules
      SET cron_expression = ?, action = ?, enabled = ?, created_by = ?
      WHERE name = ?
    `),
    deleteSchedule: db.prepare("DELETE FROM schedules WHERE name = ?"),
  };
}

function bootstrapDB({ db, statements }: DbRuntime) {
  const gateHistoryCount = statements.countGateHistory.get() as CountRow;
  if (gateHistoryCount.count === 0) {
    statements.insertHistory.run("close", Date.now(), "system", null);
  }

  const lastContactCount = statements.countLastContact.get() as CountRow;
  if (lastContactCount.count === 0) {
    db.prepare(
      "INSERT OR IGNORE INTO last_contact (id, timestamp) VALUES (1, 0)"
    ).run();
  }

  const userCount = statements.countUsers.get() as CountRow;
  if (userCount.count === 0) {
    const { username, password } = secrets.initialAdminCredentials;
    const passwordHash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
    statements.insertBootstrapUser.run(
      username,
      passwordHash,
      "admin",
      Date.now(),
      null
    );
  }
}

export function getGateStatus(includeHistory: boolean = false): GateStatus {
  const { statements } = getRuntime();
  const latest = statements.getLatestHistory.get() as {
    action: "open" | "close";
    timestamp: number;
  };
  const lastContact = statements.getLastContact.get() as { timestamp: number };

  const result: GateStatus = {
    status: latest.action === "open" ? "open" : "closed",
    lastContactTimestamp: lastContact.timestamp,
  };

  if (includeHistory) {
    result.history = statements.getHistory.all() as HistoryEntry[];
  }

  return result;
}

export function updateGateStatus(
  newAction: "open" | "close",
  actor: "user" | "schedule" | "system" = "user",
  actor_name?: string
): void {
  getRuntime().statements.insertHistory.run(
    newAction,
    Date.now(),
    actor,
    actor_name ?? null
  );
}

export function updateLastContact(): void {
  getRuntime().statements.updateLastContact.run(Date.now());
}

export function getUsers(): User[] {
  return (getRuntime().statements.getUsers.all() as UserRow[]).map(toPublicUser);
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<{ user: User; session: Session } | null> {
  const { statements } = getRuntime();
  const now = Date.now();
  const user = statements.getUserByUsername.get(username) as
    | (UserCredentials & UserRow)
    | undefined;
  if (!user) return null;

  if (!(await bcrypt.compare(password, user.password_hash))) {
    return null;
  }

  const sessionKey = crypto.randomBytes(32).toString("hex");
  const expiresAt = now + SESSION_EXPIRATION_TIME;
  statements.insertSession.run(sessionKey, user.username, now, expiresAt);

  return {
    user: toPublicUser(user),
    session: {
      session_key: sessionKey,
      username: user.username,
      created_at: now,
      expires_at: expiresAt,
    },
  };
}

export function deleteSession(sessionKey: string): void {
  getRuntime().statements.deleteSession.run(sessionKey);
}

export function refreshSession(
  sessionKey: string
): { user: User; session: Session } | null {
  const { statements } = getRuntime();
  const now = Date.now();
  const session = statements.getSession.get(sessionKey) as Session | undefined;
  if (!session) return null;

  if (session.expires_at < now) {
    deleteSession(sessionKey);
    return null;
  }

  const user = statements.getUserByUsername.get(session.username) as
    | UserRow
    | undefined;
  if (!user) {
    throw new Error(`Session references missing user: ${session.username}`);
  }

  const expiresAt = now + SESSION_EXPIRATION_TIME;
  statements.updateSession.run(expiresAt, sessionKey);

  return {
    user: toPublicUser(user),
    session: {
      session_key: sessionKey,
      username: session.username,
      created_at: session.created_at,
      expires_at: expiresAt,
    },
  };
}

export function createUser(user: CreateUserParams): User {
  const { statements } = getRuntime();
  const now = Date.now();
  const passwordHash = bcrypt.hashSync(user.password, bcrypt.genSaltSync(10));

  statements.insertUser.run(
    user.username,
    passwordHash,
    user.role,
    now,
    user.created_by ?? null
  );

  return {
    username: user.username,
    role: user.role,
    created_at: now,
    created_by: user.created_by,
  };
}

export function updateUser(user: UpdateUserParams): void {
  const { statements } = getRuntime();
  const existing = statements.getUserByUsername.get(user.username) as
    | (UserRow & UserCredentials)
    | undefined;
  if (!existing) throw new Error(`User not found: ${user.username}`);

  const passwordHash = user.password
    ? bcrypt.hashSync(user.password, bcrypt.genSaltSync(10))
    : existing.password_hash;
  statements.updateUser.run(passwordHash, user.role ?? existing.role, user.username);
}

export function deleteUser(username: string): void {
  const { statements } = getRuntime();
  const existing = statements.getUserByUsername.get(username) as
    | UserRow
    | undefined;
  if (!existing) throw new Error(`User not found: ${username}`);

  if (existing.role === "admin") {
    const adminCount = statements.countAdmins.get() as CountRow;
    if (adminCount.count <= 1) {
      throw new Error("Cannot delete the last admin user");
    }
  }

  statements.deleteSessionsByUsername.run(username);
  statements.deleteUser.run(username);
}

export function getSchedules(): Schedule[] {
  return (getRuntime().statements.getSchedules.all() as ScheduleRow[]).map(
    rowToSchedule
  );
}

export function getSchedule(name: string): Schedule | null {
  const schedule = getRuntime().statements.getSchedule.get(name) as
    | ScheduleRow
    | undefined;
  return schedule ? rowToSchedule(schedule) : null;
}

export function createSchedule(
  schedule: Omit<Schedule, "name"> & { created_by: string; name: string }
): Schedule {
  getRuntime().statements.insertSchedule.run(
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
    created_by: schedule.created_by,
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
    name,
  };

  getRuntime().statements.updateSchedule.run(
    updatedSchedule.cron_expression,
    updatedSchedule.action,
    updatedSchedule.enabled ? 1 : 0,
    updatedSchedule.created_by,
    name
  );

  return updatedSchedule;
}

export function deleteSchedule(name: string): void {
  const result = getRuntime().statements.deleteSchedule.run(name);
  if (result.changes === 0) {
    throw new Error(`Schedule not found: ${name}`);
  }
}

function rowToSchedule(row: ScheduleRow): Schedule {
  return {
    name: row.name,
    cron_expression: row.cron_expression,
    action: row.action,
    enabled: Boolean(row.enabled),
    created_by: row.created_by ?? undefined,
  };
}

function toPublicUser(user: UserRow): User {
  return {
    username: user.username,
    role: user.role,
    created_at: user.created_at,
    created_by: user.created_by ?? undefined,
  };
}
