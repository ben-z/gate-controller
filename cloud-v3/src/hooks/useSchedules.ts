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

export function useSchedule(id: number) {
  const { data, error, isLoading, mutate } = useSWR<Schedule>(
    id ? `/api/schedules/${id}` : null,
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
export async function createSchedule(schedule: Omit<Schedule, 'id'>) {
  const res = await fetch('/api/schedules', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(schedule),
  });

  if (!res.ok) {
    throw new Error('Failed to create schedule');
  }

  return res.json();
}

export async function updateSchedule(id: number, updates: Partial<Omit<Schedule, 'id'>>) {
  const res = await fetch(`/api/schedules`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, ...updates }),
  });

  if (!res.ok) {
    throw new Error('Failed to update schedule');
  }

  return res.json();
}

export async function deleteSchedule(id: number) {
  const res = await fetch(`/api/schedules?id=${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    throw new Error('Failed to delete schedule');
  }
} 