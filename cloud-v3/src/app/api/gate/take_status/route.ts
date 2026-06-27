import { NextRequest, NextResponse } from 'next/server';
import { secrets } from '@/config';
import { getGateStatus, updateLastContact } from '@/lib/db';

export async function POST(request: NextRequest) {
  if (secrets.agentToken) {
    const expected = `Bearer ${secrets.agentToken}`;
    if (request.headers.get('authorization') !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // This endpoint is specifically for the gate agent to take the current status and update last contact
  updateLastContact();
  const data = getGateStatus(false);
  return NextResponse.json(data);
}
