import { GateStatus } from '@/types/gate';
import * as db from './db';

// Runtime variable to track last contact with the gate agent
// Initialize to 0 to represent no contact yet
let lastContactTimestamp = 0;

export async function getGateStatus(includeHistory: boolean = false): Promise<GateStatus> {
  const status = await db.getGateStatus(includeHistory);
  return {
    ...status,
    lastContactTimestamp
  };
}

export async function updateGateStatus(
  newAction: 'open' | 'close',
  includeHistory: boolean = false,
  actor: 'manual' | 'schedule' | 'system' = 'manual',
  username?: string
): Promise<GateStatus> {
  if (newAction !== 'open' && newAction !== 'close') {
    throw new Error(`Invalid action: ${newAction}`);
  }
  return db.updateGateStatus(newAction, includeHistory, actor, username);
}

export async function updateLastContact(): Promise<void> {
  lastContactTimestamp = Date.now();
} 