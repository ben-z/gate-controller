'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { GateStatus } from '@/types/gate';
import { config } from '@/config';

/**
 * Time display format options:
 * - relative: Shows time relative to now (e.g., "2 minutes ago")
 * - controller: Shows time in controller's timezone
 */
type TimeFormat = 'relative' | 'controller';

/**
 * Displays a timestamp in various formats.
 * 
 * Note on time synchronization:
 * To handle potential clock differences between server and client, we compare
 * the server timestamp with client's current time. If server time appears to be
 * in the future (due to clock mismatch), we use client's time instead to avoid
 * showing confusing "in X seconds" messages.
 * 
 * A more robust solution would be to:
 * 1. Have server send its current time alongside timestamps
 * 2. Calculate and store the server-client time offset
 * 3. Apply this offset when displaying times
 * However, for this use case, the current approach is sufficient.
 */
function TimeDisplay({ timestamp, isClient, format: timeFormat }: { 
  timestamp: number; // Unix timestamp in milliseconds
  isClient: boolean;
  format: TimeFormat;
}) {
  const [, forceUpdate] = useState({});

  // Update the relative time display every minute
  useEffect(() => {
    const timer = setInterval(() => forceUpdate({}), 60000);
    return () => clearInterval(timer);
  }, []);

  // Create Date objects from Unix timestamps
  const date = new Date(timestamp);
  const clientNow = new Date();
  
  // Ensure the timestamp is valid
  if (isNaN(date.getTime())) {
    console.error('Invalid timestamp:', timestamp);
    return <span>Invalid time</span>;
  }

  // If the server time is in the future relative to client time,
  // use the client's time instead to avoid "in X seconds" messages
  const displayDate = date > clientNow ? clientNow : date;

  // Format relative time
  const relativeTime = formatDistanceToNow(displayDate, { 
    addSuffix: true,
    includeSeconds: true  // Show more precise times for recent events
  });
  
  // Format time using specified format string with controller timezone
  const formatStr = 'yyyy-MM-dd HH:mm:ss zzz';
  const controllerTime = formatInTimeZone(displayDate, config.controllerTimezone, formatStr);

  // During SSR, show controller time to avoid hydration mismatch
  if (!isClient) {
    return <span>{controllerTime}</span>;
  }

  const displayTime = {
    relative: relativeTime,
    controller: controllerTime
  }[timeFormat];

  return (
    <span title={controllerTime}>
      {displayTime}
    </span>
  );
}

interface GateControllerProps {
  initialData: GateStatus;
}

export function GateController({ initialData }: GateControllerProps) {
  const [gateStatus, setGateStatus] = useState(initialData.status);
  const [history, setHistory] = useState(initialData.history || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  // Initialize time format from localStorage if available
  // During SSR, use controller time to match the TimeDisplay component's SSR behavior
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('controller');

  // After hydration:
  // 1. Switch to client-side rendering
  // 2. Load time format preference from localStorage (default to controller time)
  useEffect(() => {
    setIsClient(true);
    const savedFormat = localStorage.getItem('timeFormat') as TimeFormat;
    setTimeFormat(savedFormat || 'controller');
  }, []);

  // Save time format preference to localStorage
  const handleTimeFormatChange = (format: TimeFormat) => {
    setTimeFormat(format);
    localStorage.setItem('timeFormat', format);
  };

  const fetchStatusAndHistory = async () => {
    try {
      const response = await fetch('/api/gate?includeHistory=true');
      const data = await response.json();
      setGateStatus(data.status);
      setHistory(data.history || []);
    } catch (error) {
      console.error('Error fetching gate status:', error);
    }
  };

  useEffect(() => {
    // Poll for status updates every 5 seconds
    const interval = setInterval(fetchStatusAndHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateGateStatus = async (newStatus: 'open' | 'closed') => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/gate?includeHistory=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();
      setGateStatus(data.status);
      setHistory(data.history || []);
    } catch (error) {
      console.error('Error updating gate status:', error);
    }
    setIsLoading(false);
  };

  return (
    <>
      <div className="text-xl flex items-center gap-2">
        <span>Current Status:</span>
        <span className={`font-bold ${gateStatus === 'open' ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`}>
          {gateStatus.toUpperCase()}
        </span>
      </div>

      <div className="flex flex-col gap-8 sm:flex-row sm:gap-4">
        <button
          onClick={() => updateGateStatus('open')}
          disabled={isLoading || gateStatus === 'open'}
          className={`w-36 h-36 text-lg rounded-2xl text-white font-bold transition-transform active:scale-95 ${
            isLoading || gateStatus === 'open'
              ? 'bg-gray-400 dark:bg-gray-600'
              : 'bg-red-500 active:bg-red-600 dark:bg-red-600 dark:active:bg-red-700'
          }`}
        >
          Open Gate
        </button>

        <button
          onClick={() => updateGateStatus('closed')}
          disabled={isLoading || gateStatus === 'closed'}
          className={`w-36 h-36 text-lg rounded-2xl text-white font-bold transition-transform active:scale-95 ${
            isLoading || gateStatus === 'closed'
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
              title="Select time format"
            >
              <option value="relative">Relative Time</option>
              <option value="controller">Controller Time ({config.controllerTimezone})</option>
            </select>
          </div>
        </div>
        <div className="h-48 overflow-y-auto">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {history.length === 0 ? (
              <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center">
                No actions yet
              </div>
            ) : (
              history.map((entry, index) => (
                <div key={index} className="px-4 py-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      entry.action === 'open' ? 'bg-red-500 dark:bg-red-400' : 'bg-green-500 dark:bg-green-400'
                    }`} />
                    <span className="font-medium">
                      {entry.action === 'open' ? 'Opened' : 'Closed'}
                    </span>
                  </div>
                  <time className="text-sm text-gray-500 dark:text-gray-400">
                    <TimeDisplay 
                      timestamp={entry.timestamp} 
                      isClient={isClient}
                      format={timeFormat}
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