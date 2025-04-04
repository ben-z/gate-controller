'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { GateStatus } from '@/types/gate';
import { config } from '@/config';
import useSWR from 'swr';
import { useAuth } from '@/contexts/auth-context';

/**
 * Time display format options:
 * - relative: Shows time relative to now (e.g., "2 minutes ago")
 * - controller: Shows time in controller's timezone
 */
type TimeFormat = 'relative' | 'controller';

/**
 * Displays a timestamp in various formats.
 */
export function TimeDisplay({ 
  timestamp, 
  format, 
  className = "" 
}: { 
  timestamp: number; // Unix timestamp in milliseconds
  format: 'relative' | string; // 'relative' or timezone string
  className?: string;
}) {
  const [, forceUpdate] = useState({});

  // Update the relative time display every minute
  useEffect(() => {
    const timer = setInterval(() => forceUpdate({}), 60000);
    return () => clearInterval(timer);
  }, []);

  // Create Date object from Unix timestamp
  const date = new Date(timestamp);
  
  // Ensure the timestamp is valid
  if (isNaN(date.getTime())) {
    console.error('Invalid timestamp:', timestamp);
    return <span className={className}>invalid time</span>;
  }

  // Format relative time
  const relativeTime = formatDistanceToNow(date, { 
    addSuffix: true,
    includeSeconds: true  // Show more precise times for recent events
  });
  
  // Format time using specified timezone
  const formatStr = 'yyyy-MM-dd HH:mm:ss zzz';
  const zonedTime = formatInTimeZone(date, format === 'relative' ? 'UTC' : format, formatStr);

  const displayTime = format === 'relative' ? relativeTime : zonedTime;

  return (
    <span title={zonedTime} className={className}>
      {displayTime}
    </span>
  );
}

export function GateController() {
  const { username } = useAuth();
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('controller');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize time format from localStorage if available
  useEffect(() => {
    const savedFormat = localStorage.getItem('timeFormat') as TimeFormat;
    setTimeFormat(savedFormat || 'controller');
  }, []);

  // Save time format preference to localStorage
  const handleTimeFormatChange = (format: TimeFormat) => {
    setTimeFormat(format);
    localStorage.setItem('timeFormat', format);
  };

  // Fetch gate status and history using SWR
  const { data, mutate } = useSWR<GateStatus>(
    '/api/gate?includeHistory=true',
    async (url) => {
      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch gate status');
      }
      return response.json();
    },
    {
      refreshInterval: 5000, // Refresh every 5 seconds
      revalidateOnFocus: true, // Revalidate when window gets focused
      revalidateOnReconnect: true, // Revalidate when browser regains network connection
      dedupingInterval: 1000, // Dedupe requests within 1 second
      keepPreviousData: true, // Keep showing the old data while fetching
    }
  );

  const updateGateStatus = async (newAction: 'open' | 'close') => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/gate?includeHistory=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: newAction, username }),
      });
      const responseStatus = response.status;
      if (responseStatus !== 200) {
        throw new Error(`Failed to update gate status: ${responseStatus}, ${response.statusText}`);
      }
      const data = await response.json();
      await mutate(data); // Update the cache with new data
      console.log('data mutated', data);
    } catch (error) {
      console.error('Error updating gate status:', error);
    }
    setIsLoading(false);
  };

  // Early return if data is not available
  if (!data) {
    return <div>Loading...</div>;
  }

  const { status, history = [], lastContactTimestamp } = data;

  console.log('data', data);

  return (
    <>
      <div className="text-xl flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span>Current Status:</span>
          <span className={`font-bold ${status === 'open' ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`}>
            {status.toUpperCase()}
          </span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
          <span>Last contact with gate:</span>
          <span className="font-medium">
            <TimeDisplay 
              timestamp={lastContactTimestamp} 
              format="relative" 
              className={lastContactTimestamp === 0 || Date.now() - lastContactTimestamp > 60000 ? "text-red-500 dark:text-red-400" : ""} 
            />
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-8 sm:flex-row sm:gap-4">
        <button
          onClick={() => updateGateStatus('open')}
          disabled={isLoading || status === 'open'}
          className={`w-36 h-36 text-lg rounded-2xl text-white font-bold transition-transform active:scale-95 ${
            isLoading || status === 'open'
              ? 'bg-gray-400 dark:bg-gray-600'
              : 'bg-red-500 active:bg-red-600 dark:bg-red-600 dark:active:bg-red-700'
          }`}
        >
          Open Gate
        </button>

        <button
          onClick={() => updateGateStatus('close')}
          disabled={isLoading || status === 'closed'}
          className={`w-36 h-36 text-lg rounded-2xl text-white font-bold transition-transform active:scale-95 ${
            isLoading || status === 'closed'
              ? 'bg-gray-400 dark:bg-gray-600'
              : 'bg-green-500 active:bg-green-600 dark:bg-green-600 dark:active:bg-green-700'
          }`}
        >
          Close Gate
        </button>
      </div>

      <div className="h-6 mt-4 text-gray-600 dark:text-gray-400">
        {isLoading && "Updating gate status..."}
      </div>

      {/* 
      Disabled until the hydration issue is solved.
      https://github.com/pacocoursey/next-themes/issues/296#issuecomment-2764424676

      <div className="w-full max-w-sm mt-8">
        <ThemeToggle />
      </div>
      */}

      <div className="w-full max-w-sm mt-8 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">History</h2>
            <select 
              value={timeFormat}
              onChange={(e) => handleTimeFormatChange(e.target.value as TimeFormat)}
              className="text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded px-2 py-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
              title={`Select time format (Controller timezone: ${config.controllerTimezone})`}
            >
              <option value="relative">Relative Time</option>
              <option value="controller">Controller Time</option>
            </select>
          </div>
        </div>
        <div className="h-48 overflow-y-auto">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {history.length === 0 ? (
              <div className="px-4 py-3 text-gray-500 dark:text-gray-400">
                No actions yet
              </div>
            ) : (
              history.map((entry) => (
                <div key={entry.timestamp} className="px-4 py-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      entry.action === 'open' ? 'bg-red-500 dark:bg-red-400' : 'bg-green-500 dark:bg-green-400'
                    }`} />
                    <span className="font-medium">
                      {entry.action === 'open' ? 'Opened' : 'Closed'}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {entry.actor === 'manual' && entry.username ? (
                        `by ${entry.username}`
                      ) : (
                        `(${entry.actor})`
                      )}
                    </span>
                  </div>
                  <time className="text-sm text-gray-500 dark:text-gray-400">
                    <TimeDisplay
                      timestamp={entry.timestamp}
                      format={timeFormat === 'relative' ? 'relative' : config.controllerTimezone}
                    />
                  </time>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}