import { NextResponse } from 'next/server';
import { getUpcomingSchedules } from '@/lib/scheduler';
import { getSchedules } from '@/lib/db';
import { apiError, requireApiSession } from '@/lib/api';

export async function GET() {
  try {
    await requireApiSession();
    const schedules = getSchedules();
    const upcoming = await getUpcomingSchedules(schedules);
    return NextResponse.json(upcoming);
  } catch (error) {
    return apiError(error, 'Error getting upcoming schedules:');
  }
}
