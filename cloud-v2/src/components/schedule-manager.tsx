'use client';

import { useState, useEffect } from 'react';
import { Schedule } from '@/services/schedule';
import { formatDistanceToNow } from 'date-fns';
import cronstrue from 'cronstrue';
import { config } from '@/config';

interface ScheduleFormData {
  name: string;
  cronExpression: string;
  action: 'open' | 'closed';
  enabled: boolean;
}

interface UpcomingExecution {
  schedule: Schedule;
  nextExecution: string;
}

export function ScheduleManager() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [upcomingExecutions, setUpcomingExecutions] = useState<UpcomingExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState<ScheduleFormData>({
    name: '',
    cronExpression: '',
    action: 'closed',
    enabled: true,
  });

  useEffect(() => {
    fetchSchedules();
    fetchUpcomingExecutions();
    // Update upcoming executions every minute
    const interval = setInterval(fetchUpcomingExecutions, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/schedules');
      if (!response.ok) throw new Error('Failed to fetch schedules');
      const data = await response.json();
      setSchedules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch schedules');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUpcomingExecutions = async () => {
    try {
      const response = await fetch('/api/schedules/upcoming');
      if (!response.ok) throw new Error('Failed to fetch upcoming executions');
      const data = await response.json();
      setUpcomingExecutions(data);
    } catch (err) {
      console.error('Error fetching upcoming executions:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (editingSchedule) {
        const response = await fetch('/api/schedules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingSchedule.id,
            ...formData,
          }),
        });
        if (!response.ok) throw new Error('Failed to update schedule');
      } else {
        const response = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) throw new Error('Failed to create schedule');
      }

      await fetchSchedules();
      await fetchUpcomingExecutions();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/schedules?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete schedule');
      await fetchSchedules();
      await fetchUpcomingExecutions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schedule');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      name: schedule.name,
      cronExpression: schedule.cronExpression,
      action: schedule.action,
      enabled: schedule.enabled,
    });
  };

  const resetForm = () => {
    setEditingSchedule(null);
    setFormData({
      name: '',
      cronExpression: '',
      action: 'closed',
      enabled: true,
    });
  };

  const handleToggleEnabled = async (schedule: Schedule) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: schedule.id,
          enabled: !schedule.enabled,
        }),
      });
      if (!response.ok) throw new Error('Failed to update schedule');
      await fetchSchedules();
      await fetchUpcomingExecutions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && schedules.length === 0) {
    return <div>Loading schedules...</div>;
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">Schedule Manager</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Cron Expression</label>
          <input
            type="text"
            value={formData.cronExpression}
            onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
            className="w-full px-3 py-2 border rounded"
            placeholder="* * * * *"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Format: minute hour day month weekday (Controller timezone: {config.controllerTimezone})
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Action</label>
          <select
            value={formData.action}
            onChange={(e) => setFormData({ ...formData, action: e.target.value as 'open' | 'closed' })}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="open">Open Gate</option>
            <option value="closed">Close Gate</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {editingSchedule ? 'Update' : 'Create'} Schedule
          </button>
          {editingSchedule && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="mt-8">
        <h3 className="text-lg font-medium mb-4">Upcoming Actions</h3>
        <p className="text-sm text-gray-500 mb-2">All times shown in controller timezone ({config.controllerTimezone})</p>
        <div className="space-y-2">
          {upcomingExecutions.length === 0 ? (
            <p className="text-gray-500">No upcoming actions scheduled</p>
          ) : (
            upcomingExecutions.map(({ schedule, nextExecution }) => {
              const nextExecutionDate = new Date(nextExecution);
              return (
                <div
                  key={`${schedule.id}-${nextExecution}`}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border"
                >
                  <div>
                    <h4 className="font-medium">{schedule.name}</h4>
                    <p className="text-sm text-gray-500">
                      {schedule.action} - {formatDistanceToNow(nextExecutionDate, { addSuffix: true })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {nextExecutionDate.toLocaleString(undefined, { timeZone: config.controllerTimezone })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-medium mb-4">All Schedules</h3>
        <p className="text-sm text-gray-500 mb-2">All times shown in controller timezone ({config.controllerTimezone})</p>
        <div className="space-y-2">
          {schedules.length === 0 ? (
            <p className="text-gray-500">No schedules configured</p>
          ) : (
            schedules.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border"
              >
                <div>
                  <h4 className="font-medium">{schedule.name}</h4>
                  <p className="text-sm text-gray-500">
                    {schedule.cronExpression} - {schedule.action}
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    {cronstrue.toString(schedule.cronExpression, { verbose: true })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {schedule.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(schedule)}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleEnabled(schedule)}
                    className={`px-3 py-1 text-sm rounded ${
                      schedule.enabled
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    {schedule.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 