import useSWR from 'swr';
import { Schedule } from '@/types/schedule';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch schedules');
  }
  return res.json();
};

export function useSchedules() {
  const { data, error, isLoading, mutate } = useSWR<Schedule[]>('/api/schedules', fetcher);

  return {
    schedules: data,
    isLoading,
    isError: error,
    mutate,
  };
}

export function useSchedule(name: string) {
  const { data, error, isLoading, mutate } = useSWR<Schedule>(
    name ? `/api/schedules?name=${name}` : null,
    fetcher
  );

  return {
    schedule: data,
    isLoading,
    isError: error,
    mutate,
  };
}

// Helper functions for mutations
export async function createSchedule(schedule: Omit<Schedule, 'name'>) {
  const res = await fetch('/api/schedules', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(schedule),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to create schedule');
  }

  return res.json();
}

export async function updateSchedule(name: string, updates: Partial<Omit<Schedule, 'name'>>) {
  const res = await fetch(`/api/schedules?name=${name}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || `Failed to update schedule "${name}"`);
  }

  return res.json();
}

export async function deleteSchedule(name: string) {
  const res = await fetch(`/api/schedules?name=${name}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || `Failed to delete schedule "${name}"`);
  }
} 