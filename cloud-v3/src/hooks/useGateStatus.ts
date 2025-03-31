import useSWR from 'swr';
import { GateStatus } from '@/types/gate';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch gate status');
  }
  return res.json();
};

export function useGateStatus(includeHistory: boolean = false) {
  const { data, error, isLoading, mutate } = useSWR<GateStatus>(
    `/api/gate${includeHistory ? '?history=true' : ''}`,
    fetcher,
    {
      refreshInterval: 5000, // Poll every 5 seconds
    }
  );

  return {
    gateStatus: data,
    isLoading,
    isError: error,
    mutate,
  };
}

// Helper functions for mutations
export async function updateGateStatus(action: 'open' | 'close') {
  const res = await fetch('/api/gate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  });

  if (!res.ok) {
    throw new Error('Failed to update gate status');
  }

  return res.json();
} 