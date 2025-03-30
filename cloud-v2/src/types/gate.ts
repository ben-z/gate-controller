export type GateStatus = {
  status: 'open' | 'closed';
  history?: HistoryEntry[];
};

export type HistoryEntry = {
  action: 'open' | 'closed';
  timestamp: number; // Unix timestamp in milliseconds
  actor: 'manual' | 'schedule' | 'system';
}; 