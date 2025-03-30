import { GateStatus } from '@/types/gate';
import * as db from './db';

export async function getGateStatus(): Promise<GateStatus> {
  return db.getGateStatus();
}

export async function updateGateStatus(newStatus: 'open' | 'closed'): Promise<GateStatus> {
  if (newStatus !== 'open' && newStatus !== 'closed') {
    throw new Error('Invalid status');
  }
  return db.updateGateStatus(newStatus);
} 