'use client';

import { useState } from 'react';
import { Schedule } from '@/services/schedule';
import cronstrue from 'cronstrue';
import { config } from '@/config';
import { useAuth } from '@/contexts/auth-context';
import useSWR, { mutate } from 'swr';

interface ScheduleFormData {
  name: string;
  cronExpression: string;
  action: 'open' | 'close';
  enabled: boolean;
}

export function ScheduleManager() {
  const { username, currentPassword } = useAuth();
  const { data: schedules = [], isLoading } = useSWR<Schedule[]>('/api/schedules');
  const [error, setError] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newSchedule, setNewSchedule] = useState<ScheduleFormData>({
    name: '',
    cronExpression: '',
    action: 'open',
    enabled: true
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSchedule,
          username,
          password: currentPassword
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create schedule');
      }

      await mutate('/api/schedules');
      setNewSchedule({
        name: '',
        cronExpression: '',
        action: 'open',
        enabled: true
      });
      setIsCreating(false);
    } catch (error) {
      console.error('Error creating schedule:', error);
      setError(error instanceof Error ? error.message : 'Failed to create schedule');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch(`/api/schedules/${editingSchedule?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSchedule,
          username,
          password: currentPassword
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update schedule');
      }

      await mutate('/api/schedules');
      setEditingSchedule(null);
    } catch (error) {
      console.error('Error updating schedule:', error);
      setError(error instanceof Error ? error.message : 'Failed to update schedule');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    setError(null);
    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password: currentPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete schedule');
      }

      await mutate('/api/schedules');
    } catch (error) {
      console.error('Error deleting schedule:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete schedule');
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setNewSchedule({
      name: schedule.name,
      cronExpression: schedule.cronExpression,
      action: schedule.action === 'open' ? 'open' : 'close',
      enabled: schedule.enabled
    });
  };

  const resetForm = () => {
    setEditingSchedule(null);
    setNewSchedule({
      name: '',
      cronExpression: '',
      action: 'close',
      enabled: true,
    });
  };

  const handleToggleEnabled = async (schedule: Schedule) => {
    setError(null);
    try {
      const response = await fetch(`/api/schedules/${schedule.id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password: currentPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to toggle schedule');
      }

      await mutate('/api/schedules');
    } catch (error) {
      console.error('Error toggling schedule:', error);
      setError(error instanceof Error ? error.message : 'Failed to toggle schedule');
    }
  };

  if (isLoading && schedules.length === 0) {
    return <div>Loading schedules...</div>;
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Schedule Manager</h2>
        {!isCreating && !editingSchedule && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Create Schedule
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {(isCreating || editingSchedule) && (
        <form onSubmit={isCreating ? handleCreate : handleSubmit} className="space-y-4 p-4 border rounded">
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
              className="text-gray-500 hover:text-gray-700"
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
              className="w-full px-3 py-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Cron Expression</label>
            <input
              type="text"
              value={newSchedule.cronExpression}
              onChange={(e) => setNewSchedule({ ...newSchedule, cronExpression: e.target.value })}
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
              value={newSchedule.action}
              onChange={(e) => setNewSchedule({ ...newSchedule, action: e.target.value as 'open' | 'close' })}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="open">Open Gate</option>
              <option value="close">Close Gate</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={newSchedule.enabled}
              onChange={(e) => setNewSchedule({ ...newSchedule, enabled: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">Enabled</label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {isCreating ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="border rounded p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium">{schedule.name}</h3>
                <p className="text-sm text-gray-500">
                  {cronstrue.toString(schedule.cronExpression, { verbose: true })}
                </p>
                <p className="text-sm text-gray-500">
                  Action: {schedule.action === 'open' ? 'Open Gate' : 'Close Gate'}
                </p>
                <p className="text-sm text-gray-500">
                  Status: <span className={schedule.enabled ? 'text-green-600' : 'text-red-600'}>
                    {schedule.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleToggleEnabled(schedule)}
                  className={`px-3 py-1 rounded text-sm ${
                    schedule.enabled
                      ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {schedule.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => handleEdit(schedule)}
                  className="px-3 py-1 rounded text-sm bg-blue-500 text-white hover:bg-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(schedule.id)}
                  className="px-3 py-1 rounded text-sm bg-red-500 text-white hover:bg-red-600"
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