import { NextResponse } from 'next/server';

interface HistoryEntry {
  action: 'open' | 'closed';
  timestamp: number; // Unix timestamp in milliseconds
}

// In a real application, these would be stored in a database
let gateStatus = 'closed';
let history: HistoryEntry[] = [];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeHistory = searchParams.get('includeHistory') === 'true';

  if (includeHistory) {
    return NextResponse.json({ status: gateStatus, history });
  }
  return NextResponse.json({ status: gateStatus });
}

export async function POST(request: Request) {
  const data = await request.json();
  if (data.status && (data.status === 'open' || data.status === 'closed')) {
    gateStatus = data.status;
    
    // Add to history
    const entry: HistoryEntry = {
      action: data.status,
      timestamp: Date.now(), // Unix timestamp in milliseconds
    };
    history = [entry, ...history.slice(0, 9)]; // Keep only last 10 entries
    
    return NextResponse.json({ status: gateStatus, history });
  }
  return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
}