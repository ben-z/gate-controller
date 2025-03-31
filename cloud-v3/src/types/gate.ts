export type GateStatus = {
  status: 'open' | 'closed';
  history?: HistoryEntry[];
  lastContactTimestamp: number; // Unix timestamp in milliseconds, managed at runtime
};

export type HistoryEntry = {
  action: 'open' | 'close';
  timestamp: number; // Unix timestamp in milliseconds
  actor: 'manual' | 'schedule' | 'system';
  username?: string; // Username for manual actions
}; 