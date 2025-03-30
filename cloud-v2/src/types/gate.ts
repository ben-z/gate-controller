export type GateStatus = {
  status: 'open' | 'closed';
  history?: HistoryEntry[];
  lastContactTimestamp: number; // Unix timestamp in milliseconds
};

export type HistoryEntry = {
  action: 'open' | 'closed';
  timestamp: number; // Unix timestamp in milliseconds
  actor: 'manual' | 'schedule' | 'system';
}; 