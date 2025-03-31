import { NextResponse } from 'next/server';
import { getGateStatus, updateLastContact } from '@/services/gate';

export async function POST() {
  // This endpoint is specifically for the gate agent to take the current status and update last contact
  await updateLastContact();
  const data = await getGateStatus(false); // Gate agent doesn't need history
  return NextResponse.json(data);
} 