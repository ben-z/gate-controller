export type GateStatus = {
  status: 'open' | 'closed';
  history?: HistoryEntry[];
  lastContactTimestamp: number; // Unix timestamp in milliseconds, managed at runtime
};

export type HistoryEntry = {
  action: 'open' | 'close';
  timestamp: number; // Unix timestamp in milliseconds
  actor: 'user' | 'schedule' | 'system';
  actor_name?: string; // Username for user actions, or schedule name for schedule actions
}; 