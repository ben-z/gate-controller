import { HistoryEntry, GateStatus } from '@/types/gate';

// In-memory state (in a real app, this would be in a database)
let gateStatus: 'open' | 'closed' = 'closed';
let history: HistoryEntry[] = [];

export async function getGateStatus(includeHistory: boolean): Promise<GateStatus> {
  if (includeHistory) {
    return { status: gateStatus, history };
  }
  return { status: gateStatus, history: [] };
}

export async function updateGateStatus(newStatus: 'open' | 'closed'): Promise<GateStatus> {
  if (newStatus !== 'open' && newStatus !== 'closed') {
    throw new Error('Invalid status');
  }

  gateStatus = newStatus;
  
  // Add to history
  const entry: HistoryEntry = {
    action: newStatus,
    timestamp: Date.now(),
  };
  history = [entry, ...history.slice(0, 9)]; // Keep only last 10 entries
  
  return { status: gateStatus, history };
} 