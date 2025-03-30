export interface HistoryEntry {
  action: 'open' | 'closed';
  timestamp: number; // Unix timestamp in milliseconds
}

export interface GateStatus {
  status: 'open' | 'closed';
  history: HistoryEntry[];
} 