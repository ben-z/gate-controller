import { NextRequest } from 'next/server';
import { ensureSession } from '@/lib/auth/ensure-session';
import { getGateStatus, updateGateStatus } from '@/lib/db';

// Get gate status
export async function GET(request: NextRequest) {
  try {
    // Ensure user is authenticated
    await ensureSession();

    // Get URL parameters
    const includeHistory = request.nextUrl.searchParams.get('includeHistory') === 'true';

    // Get gate status
    const status = getGateStatus(includeHistory);

    return Response.json(status);
  } catch (error) {
    console.error('Error getting gate status:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Update gate status
export async function POST(request: NextRequest) {
  try {
    // Ensure user is authenticated
    const { user } = await ensureSession();

    // Get request body
    const body = await request.json();
    const action = body.action as 'open' | 'close';

    if (action !== 'open' && action !== 'close') {
      return new Response('Invalid action', { status: 400 });
    }

    // Update gate status
    updateGateStatus(action, 'manual', user.username);

    return Response.json({ status: action, timestamp: Date.now() });
  } catch (error) {
    console.error('Error updating gate status:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 