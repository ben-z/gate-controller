import useSWR from 'swr';
import {
  Schedule,
  ScheduleDraftProgress,
  ScheduleDraftResponse,
  ScheduleDraftStreamEvent,
  ScheduleInput,
} from '@/types/schedule';

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

export async function createSchedule(schedule: ScheduleInput) {
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

export async function draftSchedules(
  prompt: string,
  onProgress?: (progress: ScheduleDraftProgress) => void
): Promise<ScheduleDraftResponse> {
  const res = await fetch('/api/schedules/draft/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to draft schedules');
  }

  if (!res.body) {
    throw new Error('Schedule draft stream is unavailable');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: ScheduleDraftResponse | null = null;

  const readEvent = (line: string) => {
    const event = JSON.parse(line) as ScheduleDraftStreamEvent;

    if (event.type === 'progress') {
      onProgress?.({ title: event.title, detail: event.detail });
      return;
    }

    if (event.type === 'result') {
      result = event.result;
      return;
    }

    if (event.type === 'error') {
      throw new Error(event.error);
    }

    throw new Error('Unknown schedule draft stream event');
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.trim()) readEvent(line);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) readEvent(buffer);
  if (!result) throw new Error('OpenAI returned no schedule draft');

  return result;
}

export async function updateSchedule(name: string, updates: Partial<ScheduleInput>) {
  const res = await fetch(`/api/schedules?name=${encodeURIComponent(name)}`, {
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
  const res = await fetch(`/api/schedules?name=${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || `Failed to delete schedule "${name}"`);
  }
}
