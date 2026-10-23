import { formatInTimeZone } from 'date-fns-tz';
import type { ScheduleExecution } from '@/types/schedule';

export function formatScheduleExecution(
  timestamp: string,
  timezone: string,
): ScheduleExecution {
  return {
    timestamp,
    date: formatInTimeZone(timestamp, timezone, 'yyyy-MM-dd EEE'),
    time: formatInTimeZone(timestamp, timezone, 'h:mm a'),
  };
}
