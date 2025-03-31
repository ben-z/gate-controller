'use client';

import { useGateStatus, updateGateStatus } from '@/hooks/useGateStatus';
import { TimeDisplay, TimeFormat } from '@/components/time-display';
import { UpcomingSchedules } from '@/components/upcoming-schedules';
import { config } from '@/config';
import { useState, useEffect } from 'react';

export function GateController() {
  const { gateStatus, isLoading, isError, mutate } = useGateStatus(true);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('controller');

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

  const handleGateAction = async (action: 'open' | 'close') => {
    try {
      await updateGateStatus(action);
      await mutate();
    } catch (error) {
      console.error('Error updating gate status:', error);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isError) {
    return <div>Error loading gate status</div>;
  }

  if (!gateStatus) {
    return <div>No gate status available</div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-xl flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <span>Current Status:</span>
          <span className={`font-bold ${gateStatus.status === 'open' ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`}>
            {gateStatus.status.toUpperCase()}
          </span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
          <span>Last contact with gate:</span>
          <span className="font-medium">
            <TimeDisplay 
              timestamp={gateStatus.lastContactTimestamp} 
              format="relative" 
              className={gateStatus.lastContactTimestamp === 0 || Date.now() - gateStatus.lastContactTimestamp > 60000 ? "text-red-500 dark:text-red-400" : ""} 
            />
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-8 sm:flex-row sm:gap-4 justify-center items-center">
        <button
          onClick={() => handleGateAction('open')}
          disabled={isLoading || gateStatus.status === 'open'}
          className={`w-36 h-36 text-lg rounded-2xl text-white font-bold transition-transform active:scale-95 ${
            isLoading || gateStatus.status === 'open'
              ? 'bg-gray-400 dark:bg-gray-600'
              : 'bg-red-500 active:bg-red-600 dark:bg-red-600 dark:active:bg-red-700'
          }`}
        >
          Open Gate
        </button>

        <button
          onClick={() => handleGateAction('close')}
          disabled={isLoading || gateStatus.status === 'closed'}
          className={`w-36 h-36 text-lg rounded-2xl text-white font-bold transition-transform active:scale-95 ${
            isLoading || gateStatus.status === 'closed'
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

      <div>
        <h3 className="text-lg font-medium mb-3">Upcoming Schedules</h3>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <UpcomingSchedules />
        </div>
      </div>

      {gateStatus.history && (
        <div>
          <h3 className="text-lg font-medium mb-3">Recent Activity</h3>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        Time
                        <select 
                          value={timeFormat}
                          onChange={(e) => handleTimeFormatChange(e.target.value as TimeFormat)}
                          className="text-xs bg-transparent border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                          title={`Select time format (Controller timezone: ${config.controllerTimezone})`}
                        >
                          <option value="relative">Relative</option>
                          <option value="controller">Controller</option>
                        </select>
                      </div>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actor</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {gateStatus.history.map((entry, index) => (
                    <tr key={index} className="hover:bg-gray-100 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          entry.action === 'open' 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        <TimeDisplay
                          timestamp={entry.timestamp}
                          format={timeFormat === 'relative' ? 'relative' : config.controllerTimezone}
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {entry.actor}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {entry.actor_name || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 