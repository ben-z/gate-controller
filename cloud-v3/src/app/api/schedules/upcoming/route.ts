import { NextResponse } from 'next/server';
import { getUpcomingSchedules } from '@/lib/scheduler';
import { getSchedules } from '@/lib/db';

export async function GET() {
  try {
    const schedules = await getSchedules();
    const upcoming = await getUpcomingSchedules(schedules);
    return NextResponse.json(upcoming);
  } catch (error) {
    console.error('Error getting upcoming schedules:', error);
    return NextResponse.json({ error: 'Failed to get upcoming schedules' }, { status: 500 });
  }
} 