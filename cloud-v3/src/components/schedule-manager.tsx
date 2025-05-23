'use client';

import { useState } from 'react';
import { useSchedules, createSchedule, updateSchedule, deleteSchedule } from '@/hooks/useSchedules';
import cronstrue from 'cronstrue';
import { Schedule } from '@/types/schedule';

const DEFAULT_FORM_DATA: Partial<Schedule> = Object.freeze({
  name: '',
  cron_expression: '',
  action: 'close',
  enabled: true
});

export function ScheduleManager() {
  const { schedules, isLoading, isError, mutate } = useSchedules();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Schedule>>(DEFAULT_FORM_DATA);
  const [cronError, setCronError] = useState<string | null>(null);

  const validateCronExpression = (expression: string): boolean => {
    try {
      cronstrue.toString(expression);
      setCronError(null);
      return true;
    } catch {
      setCronError('Invalid cron expression');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingName) {
        await updateSchedule(editingName, formData);
      } else {
        await createSchedule(formData as Schedule);
      }
      setEditingName(null);
      setFormData(DEFAULT_FORM_DATA);
      mutate();
    } catch (error) {
      console.error('Failed to save schedule:', error);
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setIsFormOpen(true);
    setEditingName(schedule.name);
    setFormData({
      name: schedule.name,
      cron_expression: schedule.cron_expression,
      action: schedule.action,
      enabled: schedule.enabled
    });
  };

  const handleDelete = async (name: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      setError(null);
      await deleteSchedule(name);
      mutate();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete schedule');
    }
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingName(null);
    setFormData(DEFAULT_FORM_DATA);
  };

  const handleCronChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, cron_expression: value });
    if (value) {
      validateCronExpression(value);
    } else {
      setCronError(null);
    }
  };

  const getCronDescription = (cron_expression: string) => {
    try {
      return cronstrue.toString(cron_expression);
    } catch {
      return `Invalid cron expression: ${cron_expression}`;
    }
  };

  if (isError) {
    return <div>Error loading schedules</div>;
  }

  if (isLoading && !schedules) {
    return <div>Loading schedules...</div>;
  }

  if (!schedules) {
    return <div>No schedules available</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Schedule Manager</h2>
          {!isFormOpen && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Schedule
            </button>
          )}
        </div>

        {isFormOpen && (
          <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                disabled={!!editingName}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 ${
                  !!editingName 
                    ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400' 
                    : 'border-gray-300 dark:border-gray-700'
                }`}
                required
              />
              {
                editingName && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Schedule name cannot be changed after creation
                  </p>
                )
              }
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cron Expression</label>
              <input
                type="text"
                value={formData.cron_expression}
                onChange={handleCronChange}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 ${
                  cronError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'
                }`}
                placeholder="* * * * *"
                required
              />
              {formData.cron_expression && (
                <p className={`mt-1 text-sm ${
                  cronError ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {cronError || getCronDescription(formData.cron_expression)}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Format: minute hour day month weekday (e.g., &quot;0 8 * * 1-5&quot; for weekdays at 8 AM)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Action</label>
              <select
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value as 'open' | 'close' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
              >
                <option value="close">Close</option>
                <option value="open">Open</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="enabled" className="ml-2 block text-sm">
                Enabled
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingName ? 'Update' : 'Create'} Schedule
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {schedules && schedules.length > 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cron Expression
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-gray-700">
                {schedules.map((schedule) => (
                  <tr key={schedule.name}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {schedule.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div>{schedule.cron_expression}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {getCronDescription(schedule.cron_expression)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {schedule.action}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          schedule.enabled
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200'
                        }`}
                      >
                        {schedule.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <button
                        onClick={() => handleEdit(schedule)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(schedule.name)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No schedules found. Click &quot;Add Schedule&quot; to create one.
          </div>
        )}
      </div>
    </div>
  );
} 