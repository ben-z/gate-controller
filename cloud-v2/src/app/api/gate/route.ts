import { NextResponse } from 'next/server';
import { getGateStatus, updateGateStatus } from '@/services/gate';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeHistory = searchParams.get('includeHistory') === 'true';

  const data = await getGateStatus(includeHistory);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const data = await request.json();
  if (data.status && (data.status === 'open' || data.status === 'closed')) {
    try {
      const result = await updateGateStatus(data.status);
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
  }
  return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
}