'use client';

import { Schedule } from '@/types/schedule';
import { publicConfig } from '@/config';
import { TimeDisplay } from './time-display';
import { Icon } from './icon';
import { formatInTimeZone } from 'date-fns-tz';
import useSWR from 'swr';

type UpcomingSchedule = { schedule: Schedule; nextExecution: string };

async function fetcher(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Unable to load upcoming schedules.');
  return response.json();
}

export function UpcomingSchedules() {
  const {
    data: upcoming,
    error,
    mutate,
  } = useSWR<UpcomingSchedule[]>('/api/schedules/upcoming', fetcher, {
    refreshInterval: 5000,
  });

  if (error)
    return (
      <div className="card-body inline-alert" role="alert">
        {error.message}
        <button className="button button-secondary" onClick={() => mutate()}>
          Try again
        </button>
      </div>
    );
  if (!upcoming)
    return (
      <div className="empty-state" role="status">
        Loading upcoming schedules…
      </div>
    );
  if (!upcoming.length)
    return (
      <div className="empty-state upcoming-empty">
        <span className="empty-icon">
          <Icon name="calendar" />
        </span>
        <h3>Your time. Your routine.</h3>
        <p>Add a schedule and your next gate command will appear here.</p>
      </div>
    );

  return (
    <ol className="upcoming-list">
      {upcoming.map(({ schedule, nextExecution }, index) => (
        <li className="upcoming-row" key={`${schedule.name}-${nextExecution}`}>
          <span className={`timeline-dot ${index === 0 ? 'next' : ''}`} />
          <div className="upcoming-copy">
            <div className="upcoming-date">
              {formatInTimeZone(
                nextExecution,
                publicConfig.controllerTimezone,
                'yyyy-MM-dd EEE',
              )}
              <TimeDisplay
                timestamp={new Date(nextExecution).getTime()}
                format="relative"
              />
            </div>
            <h3>{schedule.name}</h3>
            <div className="upcoming-time">
              {formatInTimeZone(
                nextExecution,
                publicConfig.controllerTimezone,
                'h:mm a',
              )}
              <span>
                {schedule.action === 'open' ? 'Open gate' : 'Close gate'}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
