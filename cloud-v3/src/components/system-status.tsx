'use client';

import type { ReactNode } from 'react';
import { useGateStatus } from '@/hooks/useGateStatus';
import { publicConfig } from '@/config';
import { DiagnosticGrid } from './diagnostic-grid';
import { TimeDisplay } from './time-display';

export function SystemStatus({ version }: { version: string }) {
  const { gateStatus, isLoading, isError } = useGateStatus();
  let apiStatus = 'Connected';
  if (isError) apiStatus = 'Unavailable';
  else if (isLoading) apiStatus = 'Checking…';

  let lastContact: ReactNode = 'Checking…';
  if (gateStatus) {
    lastContact = gateStatus.lastContactTimestamp === 0 ? 'Never connected' : (
      <>
        <TimeDisplay
          timestamp={gateStatus.lastContactTimestamp}
          format={publicConfig.controllerTimezone}
        />
        <br />
        <TimeDisplay timestamp={gateStatus.lastContactTimestamp} format="relative" />
      </>
    );
  }

  return (
    <>
      <DiagnosticGrid items={[
        ['App version', <code key="version">{version}</code>],
        ['Controller timezone', publicConfig.controllerTimezone],
        ['Controller API', apiStatus],
        ['Last agent sync', lastContact],
      ]} />
      {isError && (
        <p className="inline-alert" role="alert">
          Unable to refresh system status.
        </p>
      )}
    </>
  );
}
