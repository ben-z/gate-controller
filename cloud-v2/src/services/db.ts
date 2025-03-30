import Database from 'better-sqlite3';
import { join } from 'path';
import { HistoryEntry } from '@/types/gate';

// Initialize database
const db = new Database(join(process.cwd(), 'gate.db'));

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
    timestamp INTEGER NOT NULL
  );

  -- Insert initial status if not exists
  INSERT OR IGNORE INTO gate_status (id, status, updated_at) 
  VALUES (1, 'closed', ${Date.now()});
`);

// Prepare statements for better performance
const getStatusStmt = db.prepare('SELECT status FROM gate_status WHERE id = 1');
const updateStatusStmt = db.prepare('UPDATE gate_status SET status = ?, updated_at = ? WHERE id = 1');
const getHistoryStmt = db.prepare('SELECT action, timestamp FROM gate_history ORDER BY timestamp DESC LIMIT 10');
const insertHistoryStmt = db.prepare('INSERT INTO gate_history (action, timestamp) VALUES (?, ?)');

export function getGateStatus(): { status: 'open' | 'closed'; history: HistoryEntry[] } {
  const status = getStatusStmt.get() as { status: 'open' | 'closed' };
  const history = getHistoryStmt.all() as HistoryEntry[];
  return { status: status.status, history };
}

export function updateGateStatus(newStatus: 'open' | 'closed'): { status: 'open' | 'closed'; history: HistoryEntry[] } {
  const now = Date.now();
  
  // Update status
  updateStatusStmt.run(newStatus, now);
  
  // Add to history
  insertHistoryStmt.run(newStatus, now);
  
  // Get updated state
  return getGateStatus();
} 