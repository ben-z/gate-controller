'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow, format, isToday } from 'date-fns';

function TimeDisplay({ timestamp, isClient }: { timestamp: string, isClient: boolean }) {
  const [, forceUpdate] = useState({});

  // Update the relative time display every minute
  useEffect(() => {
    const timer = setInterval(() => forceUpdate({}), 60000);
    return () => clearInterval(timer);
  }, []);

  // Parse the ISO timestamp into a Date object
  const serverDate = new Date(timestamp);
  const clientNow = new Date();
  
  // Ensure the date is valid before proceeding
  if (isNaN(serverDate.getTime())) {
    console.error('Invalid timestamp:', timestamp);
    return <span>Invalid time</span>;
  }

  // If the server time is in the future relative to client time,
  // use the client's time instead to avoid "in X seconds" messages
  const date = serverDate > clientNow ? clientNow : serverDate;

  const relativeTime = formatDistanceToNow(date, { 
    addSuffix: true,
    includeSeconds: true  // Show more precise times for recent events
  });
  
  // Format absolute time based on how old it is
  const absoluteTime = isToday(date)
    ? format(date, 'h:mm:ss a')
    : format(date, 'MMM d, h:mm:ss a');
  
  // During SSR, show UTC time to avoid hydration mismatch
  const serverTime = format(date, 'h:mm:ss a');

  if (!isClient) {
    return <span>{serverTime} UTC</span>;
  }

  return (
    <span title={absoluteTime}>
      {relativeTime}
    </span>
  );
}

interface HistoryEntry {
  action: 'open' | 'closed';
  timestamp: string;
}

interface GateControllerProps {
  initialData: {
    status: 'open' | 'closed';
    history: HistoryEntry[];
  };
}

export function GateController({ initialData }: GateControllerProps) {
  const [gateStatus, setGateStatus] = useState(initialData.status);
  const [history, setHistory] = useState(initialData.history);
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // After hydration, switch to client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchStatusAndHistory = async () => {
    try {
      const response = await fetch('/api/gate?includeHistory=true');
      const data = await response.json();
      setGateStatus(data.status);
      setHistory(data.history);
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
      const response = await fetch('/api/gate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();
      setGateStatus(data.status);
      setHistory(data.history);
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
                    <TimeDisplay timestamp={entry.timestamp} isClient={isClient} />
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