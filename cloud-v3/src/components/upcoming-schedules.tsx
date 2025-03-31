'use client';

import { Schedule } from '@/types/schedule';
import { TimeDisplay } from '@/components/time-display';
import useSWR from 'swr';

type UpcomingSchedule = {
  schedule: Schedule;
  nextExecution: string; // ISO string
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch upcoming schedules');
  }
  return response.json();
};

export function UpcomingSchedules() {
  const { data: upcoming, error, isLoading } = useSWR<UpcomingSchedule[]>(
    '/api/schedules/upcoming',
    fetcher,
    {
      refreshInterval: 5000, // Refresh every 5 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  );

  if (isLoading) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
        Loading upcoming schedules...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4 text-red-500 dark:text-red-400">
        {error.message}
      </div>
    );
  }

  if (!upcoming || upcoming.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
        No upcoming schedules
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {upcoming.map(({ schedule, nextExecution }) => (
        <div key={schedule.id} className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              schedule.action === 'open' ? 'bg-red-500 dark:bg-red-400' : 'bg-green-500 dark:bg-green-400'
            }`} />
            <span className="font-medium">{schedule.name}</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({schedule.action})
            </span>
          </div>
          <TimeDisplay
            timestamp={new Date(nextExecution).getTime()}
            format="relative"
            className="text-sm text-gray-600 dark:text-gray-400"
          />
        </div>
      ))}
    </div>
  );
} 