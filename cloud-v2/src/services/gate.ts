import { GateStatus } from '@/types/gate';
import * as db from './db';

export async function getGateStatus(includeHistory: boolean = false): Promise<GateStatus> {
  return db.getGateStatus(includeHistory);
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
  return db.updateLastContact();
} 