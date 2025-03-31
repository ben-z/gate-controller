'use client';

import { useState } from 'react';
import cronstrue from 'cronstrue';

interface Schedule {
  id: number;
  name: string;
  cronExpression: string;
  action: 'open' | 'close';
  enabled: boolean;
}

interface ScheduleFormData {
  name: string;
  cronExpression: string;
  action: 'open' | 'close';
  enabled: boolean;
}

export function ScheduleManager() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSchedule, setNewSchedule] = useState<ScheduleFormData>({
    name: '',
    cronExpression: '',
    action: 'close',
    enabled: true
  });

  // Fetch schedules
  const fetchSchedules = async () => {
    try {
      const response = await fetch('/api/schedules');
      if (!response.ok) throw new Error('Failed to fetch schedules');
      const data = await response.json();
      setSchedules(data);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  // Create schedule
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSchedule),
      });
      if (!response.ok) throw new Error('Failed to create schedule');
      await fetchSchedules();
      setIsCreating(false);
      setNewSchedule({ name: '', cronExpression: '', action: 'close', enabled: true });
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    }
  };

  // Update schedule
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;
    setError(null);
    try {
      const response = await fetch(`/api/schedules/${editingSchedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSchedule),
      });
      if (!response.ok) throw new Error('Failed to update schedule');
      await fetchSchedules();
      setEditingSchedule(null);
      setNewSchedule({ name: '', cronExpression: '', action: 'close', enabled: true });
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    }
  };

  // Delete schedule
  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    setError(null);
    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete schedule');
      await fetchSchedules();
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    }
  };

  // Toggle schedule enabled state
  const handleToggleEnabled = async (schedule: Schedule) => {
    setError(null);
    try {
      const response = await fetch(`/api/schedules/${schedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...schedule, enabled: !schedule.enabled }),
      });
      if (!response.ok) throw new Error('Failed to update schedule');
      await fetchSchedules();
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    }
  };

  // Edit schedule
  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setNewSchedule({
      name: schedule.name,
      cronExpression: schedule.cronExpression,
      action: schedule.action,
      enabled: schedule.enabled
    });
  };

  // Reset form
  const resetForm = () => {
    setNewSchedule({
      name: '',
      cronExpression: '',
      action: 'close',
      enabled: true
    });
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Schedule Manager</h2>
        {!isCreating && !editingSchedule && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Create Schedule
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {(isCreating || editingSchedule) && (
        <form onSubmit={isCreating ? handleCreate : handleUpdate} className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              {isCreating ? 'Create New Schedule' : 'Edit Schedule'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setEditingSchedule(null);
                resetForm();
              }}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={newSchedule.name}
              onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cron Expression</label>
            <input
              type="text"
              value={newSchedule.cronExpression}
              onChange={(e) => setNewSchedule({ ...newSchedule, cronExpression: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
              placeholder="e.g., 0 8 * * *"
              required
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {newSchedule.cronExpression && (() => {
                try {
                  return cronstrue.toString(newSchedule.cronExpression);
                } catch {
                  return 'Invalid cron expression';
                }
              })()}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Action</label>
            <select
              value={newSchedule.action}
              onChange={(e) => setNewSchedule({ ...newSchedule, action: e.target.value as 'open' | 'close' })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="open">Open Gate</option>
              <option value="close">Close Gate</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={newSchedule.enabled}
              onChange={(e) => setNewSchedule({ ...newSchedule, enabled: e.target.checked })}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="enabled" className="text-sm font-medium">Enabled</label>
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {isCreating ? 'Create' : 'Save Changes'}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{schedule.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {(() => {
                    try {
                      return cronstrue.toString(schedule.cronExpression, { verbose: true });
                    } catch {
                      return 'Invalid cron expression';
                    }
                  })()}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Action: {schedule.action === 'open' ? 'Open Gate' : 'Close Gate'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Status: <span className={schedule.enabled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                    {schedule.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleEnabled(schedule)}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    schedule.enabled
                      ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  } transition-colors`}
                >
                  {schedule.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => handleEdit(schedule)}
                  className="px-3 py-1 rounded-lg text-sm bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(schedule.id)}
                  className="px-3 py-1 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 