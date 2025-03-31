'use client';

import { useGateStatus, updateGateStatus } from '@/hooks/useGateStatus';
import { formatInTimeZone } from 'date-fns-tz';
import { config } from '@/config';

export function GateController() {
  const { gateStatus, isLoading, isError, mutate } = useGateStatus(true);

  const handleAction = async (action: 'open' | 'close') => {
    try {
      await updateGateStatus(action);
      await mutate(); // Revalidate the data
    } catch (error) {
      console.error('Failed to update gate status:', error);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">Gate Control</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Current Status: <span className="font-medium">{gateStatus.status}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('open')}
            disabled={gateStatus.status === 'open'}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Open Gate
          </button>
          <button
            onClick={() => handleAction('close')}
            disabled={gateStatus.status === 'closed'}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Close Gate
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      {gateStatus.history && (
        <div>
          <h3 className="text-lg font-medium mb-3">Recent Activity</h3>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actor</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
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
                        {formatInTimeZone(entry.timestamp, config.controllerTimezone, 'yyyy-MM-dd HH:mm:ss zzz')}
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