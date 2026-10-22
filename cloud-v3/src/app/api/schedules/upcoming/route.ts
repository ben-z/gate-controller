import { NextResponse } from 'next/server';
import { getUpcomingSchedules } from '@/lib/scheduler';
import { getSchedules } from '@/lib/db';
import { apiError, requireApiSession } from '@/lib/api';
import { publicConfig } from '@/config';
import { formatScheduleExecution } from '@/lib/schedule-display';
import type { UpcomingSchedule } from '@/types/schedule';

export async function GET() {
  try {
    await requireApiSession();
    const schedules = getSchedules();
    const upcoming = await getUpcomingSchedules(schedules);
    const response: UpcomingSchedule[] = upcoming.map(
      ({ schedule, nextExecution }) => {
        const { timestamp, date, time } = formatScheduleExecution(
          nextExecution.toISOString(),
          publicConfig.controllerTimezone,
        );
        return { schedule, nextExecution: timestamp, date, time };
      },
    );
    return NextResponse.json(response);
  } catch (error) {
    return apiError(error, 'Error getting upcoming schedules:');
  }
}
