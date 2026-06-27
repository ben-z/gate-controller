import { NextRequest } from 'next/server';
import { getGateStatus, updateGateStatus } from '@/lib/db';
import {
  apiError,
  readJsonBody,
  requireApiSession,
  requireGateAction,
  requireObject,
} from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    await requireApiSession();

    const includeHistory = request.nextUrl.searchParams.get('history') === 'true';
    const status = getGateStatus(includeHistory);

    return Response.json(status);
  } catch (error) {
    return apiError(error, 'Error getting gate status:');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireApiSession();
    const body = requireObject(await readJsonBody(request));
    const action = requireGateAction(body.action);

    updateGateStatus(action, 'user', user.username);

    return Response.json({ status: action, timestamp: Date.now() });
  } catch (error) {
    return apiError(error, 'Error updating gate status:');
  }
}
