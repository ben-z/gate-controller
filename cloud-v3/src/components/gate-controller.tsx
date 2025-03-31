'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { config } from '@/config';

interface GateStatus {
  status: 'open' | 'closed';
  lastContactTimestamp: number;
  history: Array<{
    timestamp: number;
    action: 'open' | 'close';
    actor: 'manual' | 'schedule';
    username?: string;
  }>;
}

export function GateController() {
  const [timeFormat, setTimeFormat] = useState<'relative' | 'controller'>('controller');
  const [isLoading, setIsLoading] = useState(false);
  const [gateStatus, setGateStatus] = useState<GateStatus>({
    status: 'closed',
    lastContactTimestamp: 0,
    history: []
  });

  // Initialize time format from localStorage if available
  useEffect(() => {
    const savedFormat = localStorage.getItem('timeFormat') as 'relative' | 'controller';
    setTimeFormat(savedFormat || 'controller');
  }, []);

  // Save time format preference to localStorage
  const handleTimeFormatChange = (format: 'relative' | 'controller') => {
    setTimeFormat(format);
    localStorage.setItem('timeFormat', format);
  };

  // Fetch gate status
  const fetchGateStatus = async () => {
    try {
      const response = await fetch('/api/gate?includeHistory=true');
      if (!response.ok) throw new Error('Failed to fetch gate status');
      const data = await response.json();
      setGateStatus(data);
    } catch (error) {
      console.error('Error fetching gate status:', error);
    }
  };

  // Update gate status
  const updateGateStatus = async (action: 'open' | 'close') => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error('Failed to update gate status');
      await fetchGateStatus();
    } catch (error) {
      console.error('Error updating gate status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch status periodically
  useEffect(() => {
    fetchGateStatus();
    const interval = setInterval(fetchGateStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const { status, lastContactTimestamp, history } = gateStatus;

  return (
    <div className="space-y-6">
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
            {formatDistanceToNow(new Date(lastContactTimestamp), { addSuffix: true })}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-8 sm:flex-row sm:gap-4 justify-center">
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

      <div className="h-6 text-center text-gray-600 dark:text-gray-400">
        {isLoading && "Updating gate status..."}
      </div>

      <div className="w-full max-w-sm mx-auto border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">History</h2>
            <select 
              value={timeFormat}
              onChange={(e) => handleTimeFormatChange(e.target.value as 'relative' | 'controller')}
              className="text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded px-2 py-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
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
                    {timeFormat === 'relative' 
                      ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })
                      : formatInTimeZone(new Date(entry.timestamp), config.controllerTimezone, 'yyyy-MM-dd HH:mm:ss')
                    }
                  </time>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 