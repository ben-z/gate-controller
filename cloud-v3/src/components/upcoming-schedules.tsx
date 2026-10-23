'use client';

import type { UpcomingSchedule } from '@/types/schedule';
import { TimeDisplay } from './time-display';
import { Icon } from './icon';
import useSWR from 'swr';
import { useCallback, useLayoutEffect, useRef } from 'react';

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
  const emptyState = useRef<HTMLDivElement>(null);
  const upcomingList = useRef<HTMLOListElement>(null);
  const retryWasFocused = useRef(false);
  const retryRef = useCallback((button: HTMLButtonElement | null) => {
    if (!button) return;
    // Automatic recovery also removes Retry; capture focus before DOM removal.
    return () => {
      retryWasFocused.current = document.activeElement === button;
    };
  }, []);

  useLayoutEffect(() => {
    if (error || !retryWasFocused.current) return;
    retryWasFocused.current = false;
    (upcomingList.current ?? emptyState.current)?.focus();
  }, [error]);

  if (error)
    return (
      <div className="card-body inline-alert" role="alert">
        {error.message}
        <button
          ref={retryRef}
          className="button button-secondary"
          onClick={() => mutate()}
        >
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
      <div
        ref={emptyState}
        tabIndex={-1}
        role="group"
        aria-label="No upcoming gate commands"
        className="empty-state upcoming-empty"
      >
        <span className="empty-icon">
          <Icon name="calendar" />
        </span>
        <h3>No upcoming schedules</h3>
        <p>Add or enable a schedule.</p>
      </div>
    );

  return (
    <ol
      ref={upcomingList}
      className="upcoming-list"
      tabIndex={0}
      aria-label="Upcoming gate commands"
    >
      {upcoming.map(({ schedule, nextExecution, date, time }, index) => (
        <li className="upcoming-row" key={`${schedule.name}-${nextExecution}`}>
          <span className={`timeline-dot ${index === 0 ? 'next' : ''}`} />
          <div className="upcoming-copy">
            <div className="upcoming-date">
              <time dateTime={nextExecution}>{date}</time>
              <TimeDisplay
                timestamp={new Date(nextExecution).getTime()}
                format="relative"
              />
            </div>
            <h3>{schedule.name}</h3>
            <div className="upcoming-time">
              <time dateTime={nextExecution}>{time}</time>
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
