import { GateStatus } from '@/types/gate';
import * as db from './db';

export async function getGateStatus(includeHistory: boolean = false): Promise<GateStatus> {
  return db.getGateStatus(includeHistory);
}

export async function updateGateStatus(newStatus: 'open' | 'closed', includeHistory: boolean = false): Promise<GateStatus> {
  if (newStatus !== 'open' && newStatus !== 'closed') {
    throw new Error(`Invalid status: ${newStatus}`);
  }
  return db.updateGateStatus(newStatus, includeHistory);
} 