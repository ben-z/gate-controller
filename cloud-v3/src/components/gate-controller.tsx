'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGateStatus, updateGateStatus } from '@/hooks/useGateStatus';
import { TimeDisplay } from './time-display';
import { UpcomingSchedules } from './upcoming-schedules';
import { GateIllustration } from './gate-illustration';
import { Icon } from './icon';
import { publicConfig } from '@/config';

export function GateController() {
  const { gateStatus, isLoading, isError, mutate } = useGateStatus(true);
  const [pendingAction, setPendingAction] = useState<'open' | 'close' | null>(
    null,
  );
  const [feedback, setFeedback] = useState<{
    error: boolean;
    message: string;
  } | null>(null);
  const [, refreshContactAge] = useState(0);
  const lastContactTimestamp = gateStatus?.lastContactTimestamp;

  useEffect(() => {
    if (!lastContactTimestamp) return;
    const remaining =
      lastContactTimestamp + publicConfig.gateContactStaleAfterMs - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(
      () => refreshContactAge((age) => age + 1),
      remaining + 1,
    );
    return () => clearTimeout(timer);
  }, [lastContactTimestamp]);

  async function handleGateAction(action: 'open' | 'close') {
    setPendingAction(action);
    setFeedback(null);
    let saved = false;
    try {
      await updateGateStatus(action);
      saved = true;
      await mutate(
        (current) => {
          if (!current)
            throw new Error(
              'Gate status disappeared after the command was saved.',
            );
          return { ...current, status: action === 'open' ? 'open' : 'closed' };
        },
        { revalidate: false },
      );
      setFeedback({
        error: false,
        message: `${action === 'open' ? 'Open' : 'Close'} command saved. The gate agent applies it at its next sync.`,
      });
      await mutate();
    } catch (error) {
      const failureMessage =
        error instanceof Error ? error.message : 'The gate command failed.';
      setFeedback({
        error: true,
        message: saved
          ? 'The command was saved, but the latest gate details could not be loaded.'
          : failureMessage,
      });
    } finally {
      setPendingAction(null);
    }
  }

  if (!gateStatus) {
    return (
      <div
        className={isError ? 'inline-alert' : 'empty-state'}
        role={isError ? 'alert' : 'status'}
      >
        {isError
          ? 'Unable to load the gate. Check your connection and try again.'
          : 'Loading your gate…'}
        {isError && (
          <button className="button button-secondary" onClick={() => mutate()}>
            Try again
          </button>
        )}
      </div>
    );
  }

  const isOpen = gateStatus.status === 'open';
  const recentlySynced =
    gateStatus.lastContactTimestamp > 0 &&
    Date.now() - gateStatus.lastContactTimestamp <
      publicConfig.gateContactStaleAfterMs;

  return (
    <div className="overview-layout">
      <section className="card gate-card" aria-labelledby="gate-heading">
        <div className="card-header">
          <h2 className="section-heading" id="gate-heading">
            <Icon name="gate" /> Main gate
          </h2>
          <span className={`sync-status ${recentlySynced ? 'synced' : ''}`}>
            <span className="status-dot" />
            {recentlySynced ? 'Recent agent sync' : 'Awaiting agent sync'}
          </span>
        </div>
        <div className={`gate-stage ${isOpen ? 'gate-stage-open' : ''}`}>
          <p className="eyebrow">Requested state</p>
          <div className="gate-state" aria-live="polite">
            {isOpen ? 'Open' : 'Closed'}
          </div>
          <div className="gate-actions">
            <div className="gate-action-buttons">
              {(['open', 'close'] as const).map((action) => (
                <button
                  key={action}
                  className={`button ${action === 'open' ? 'button-primary' : 'button-secondary'}`}
                  onClick={() => handleGateAction(action)}
                  disabled={
                    (action === 'open' ? isOpen : !isOpen) ||
                    pendingAction !== null ||
                    !!isError ||
                    isLoading
                  }
                  aria-busy={pendingAction === action}
                >
                  <Icon
                    name={
                      action === 'open' ? 'arrow-up-right' : 'arrow-down-right'
                    }
                  />
                  {pendingAction === action
                    ? 'Saving command…'
                    : `${action === 'open' ? 'Open' : 'Close'} Gate`}
                </button>
              ))}
            </div>
            <p className="field-hint">
              Commands take effect when the gate agent syncs. Physical position
              is not reported.
            </p>
            {isError && (
              <p className="inline-alert" role="alert">
                Connection lost. Controls are paused until the gate status
                refreshes.
              </p>
            )}
            {feedback && (
              <p
                role={feedback.error ? 'alert' : 'status'}
                className={feedback.error ? 'inline-alert' : 'feedback-success'}
              >
                {feedback.message}
              </p>
            )}
          </div>
          <GateIllustration open={isOpen} />
          <p className="gate-sync">
            <Icon name="refresh" />
            Last agent sync:{' '}
            {gateStatus.lastContactTimestamp === 0 ? (
              'Not yet connected'
            ) : (
              <TimeDisplay
                timestamp={gateStatus.lastContactTimestamp}
                format="relative"
              />
            )}
          </p>
        </div>
      </section>
      <section
        className="card upcoming-card"
        aria-labelledby="upcoming-heading"
      >
        <div className="card-header">
          <h2 className="section-heading" id="upcoming-heading">
            <Icon name="calendar" /> Up next
          </h2>
          <span className="small-label">AUTOMATION</span>
        </div>
        <UpcomingSchedules />
        <div className="upcoming-footer">
          <span className="field-hint">
            Times in {publicConfig.controllerTimezone.replaceAll('_', ' ')}
          </span>
          <Link
            className="button button-ghost"
            href="/dashboard?view=schedules"
          >
            Manage schedules <Icon name="chevron-right" />
          </Link>
        </div>
      </section>
      <section
        className="card activity-card"
        aria-labelledby="activity-heading"
      >
        <div className="card-header">
          <h2 className="section-heading" id="activity-heading">
            <Icon name="activity" /> Recent activity
          </h2>
          <span className="small-label">COMMAND HISTORY</span>
        </div>
        {gateStatus.history?.length ? (
          <ul
            className="activity-list"
            tabIndex={0}
            aria-label="Recent command history"
          >
            {gateStatus.history.map((entry, index) => (
              <li className="activity-row" key={`${entry.timestamp}-${index}`}>
                <span
                  className={`activity-icon ${entry.action === 'open' ? 'opening' : ''}`}
                >
                  <Icon
                    name={
                      entry.action === 'open'
                        ? 'arrow-up-right'
                        : 'arrow-down-right'
                    }
                  />
                </span>
                <div className="activity-copy">
                  <span>
                    {entry.action === 'open' ? 'Open' : 'Close'} command
                  </span>
                  <span className="muted">
                    {entry.actor_name ||
                      (entry.actor === 'system' ? 'System' : 'Schedule')}
                    <span className="activity-separator">·</span>
                    {entry.actor === 'user' ? 'Manual control' : entry.actor}
                  </span>
                </div>
                <div className="activity-times">
                  <TimeDisplay
                    timestamp={entry.timestamp}
                    format="relative"
                    className="activity-time"
                  />
                  <TimeDisplay
                    timestamp={entry.timestamp}
                    format={publicConfig.controllerTimezone}
                    className="activity-exact"
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <Icon name="activity" />
            <h3>A fresh start.</h3>
            <p>Gate commands will appear here as they happen.</p>
          </div>
        )}
      </section>
    </div>
  );
}
