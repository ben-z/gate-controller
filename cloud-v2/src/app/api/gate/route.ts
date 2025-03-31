import { NextResponse } from 'next/server';
import { getGateStatus, updateGateStatus } from '@/services/gate';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeHistory = searchParams.get('includeHistory') === 'true';

  const data = await getGateStatus(includeHistory);
  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeHistory = searchParams.get('includeHistory') === 'true';
  const data = await request.json();
  if (data.action && (data.action === 'open' || data.action === 'close')) {
    try {
      const result = await updateGateStatus(data.action, includeHistory, 'manual', data.username);
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });
    } catch {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}