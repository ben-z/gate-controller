'use client';

import { useEffect, useState } from 'react';
import { DiagnosticGrid } from './diagnostic-grid';

type StorageState = {
  persistent?: boolean;
  quota?: number;
  usage?: number;
  error?: string;
};

export function BrowserDiagnostics() {
  const [storage, setStorage] = useState<StorageState>({});

  useEffect(() => {
    let cancelled = false;

    async function loadStorageState() {
      try {
        const [persistent, estimate] = await Promise.all([
          navigator.storage?.persisted?.() ?? false,
          navigator.storage?.estimate?.() ?? {},
        ]);

        if (!cancelled) {
          setStorage({
            persistent,
            quota: estimate.quota,
            usage: estimate.usage,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setStorage({
            error: error instanceof Error ? error.message : 'Unavailable',
          });
        }
      }
    }

    loadStorageState();

    return () => {
      cancelled = true;
    };
  }, []);

  const storageDiagnostics = [
    ['Persistent storage', storage.error ?? formatBoolean(storage.persistent)],
    ['Storage usage', `${formatBytes(storage.usage)} / ${formatBytes(storage.quota)}`],
  ] as const;

  return <DiagnosticGrid items={storageDiagnostics} />;
}

function formatBoolean(value: boolean | undefined) {
  if (value === undefined) return 'checking';
  return value ? 'enabled' : 'disabled';
}

function formatBytes(value: number | undefined) {
  if (value === undefined) return 'unknown';
  if (value < 1024) return `${value} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let amount = value / 1024;
  let unitIndex = 0;

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  return `${amount.toFixed(1)} ${units[unitIndex]}`;
}
