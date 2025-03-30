import { NextResponse } from 'next/server';

// In a real application, this would be stored in a database
let gateStatus = 'closed';

export async function GET() {
  return NextResponse.json({ status: gateStatus });
}

export async function POST(request: Request) {
  const data = await request.json();
  if (data.status && (data.status === 'open' || data.status === 'closed')) {
    gateStatus = data.status;
    return NextResponse.json({ status: gateStatus });
  }
  return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
}