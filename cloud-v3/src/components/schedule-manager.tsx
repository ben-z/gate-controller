'use client';

import { useRef, useState } from 'react';
import { useSWRConfig } from 'swr';
import cronstrue from 'cronstrue';
import { formatInTimeZone } from 'date-fns-tz';
import { Icon } from '@/components/icon';
import { publicConfig } from '@/config';
import {
  createSchedule,
  deleteSchedule,
  draftSchedules,
  updateSchedule,
  useSchedules,
} from '@/hooks/useSchedules';
import {
  ScheduleDraft,
  ScheduleDraftProgress,
  ScheduleDraftResponse,
  ScheduleInput,
} from '@/types/schedule';

const EMPTY_SCHEDULE: ScheduleInput = Object.freeze({
  name: '',
  cron_expression: '',
  action: 'close',
  enabled: true,
});

const PROMPT_EXAMPLES = [
  'Open weekdays at 7:30 AM',
  'Close every night at 6 PM',
  'Open weekends at 9 AM',
];

type Editor = {
  originalName: string | null;
  draftName: string | null;
  data: ScheduleInput;
};

export function ScheduleManager() {
  const { schedules, isError, mutate } = useSchedules();
  const { mutate: revalidate } = useSWRConfig();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [draftResult, setDraftResult] = useState<ScheduleDraftResponse | null>(
    null,
  );
  const [draftProgress, setDraftProgress] =
    useState<ScheduleDraftProgress | null>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const editorInput = useRef<HTMLInputElement>(null);
  const busy = pending !== null;

  async function refreshSchedules() {
    await Promise.all([mutate(), revalidate('/api/schedules/upcoming')]);
  }

  async function runAction(operation: string, action: () => Promise<void>) {
    setPending(operation);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'The schedule could not be updated.',
      );
    } finally {
      setPending(null);
    }
  }

  function removeAppliedDraft(name: string) {
    setDraftResult((current) => {
      if (!current) return null;
      const drafts = current.drafts.filter((draft) => draft.name !== name);
      return drafts.length ? { ...current, drafts } : null;
    });
  }

  function openEditor(next: Editor) {
    setEditor(next);
    setError(null);
    requestAnimationFrame(() => {
      const input = editorInput.current;
      input?.scrollIntoView({ block: 'center' });
      input?.focus({ preventScroll: true });
    });
  }

  function handleDraftSubmit(event: React.FormEvent) {
    event.preventDefault();
    void runAction('draft', async () => {
      setDraftResult(null);
      setDraftProgress({
        title: 'Starting draft',
        detail: 'Preparing your schedule.',
      });
      try {
        setDraftResult(await draftSchedules(prompt.trim(), setDraftProgress));
      } finally {
        setDraftProgress(null);
      }
    });
  }

  function applyDrafts(drafts: ScheduleDraft[], operation: string) {
    void runAction(operation, async () => {
      for (const draft of drafts) {
        await createSchedule(toScheduleInput(draft));
        removeAppliedDraft(draft.name);
        await refreshSchedules();
      }
      setNotice(
        drafts.length === 1
          ? 'Schedule added.'
          : `${drafts.length} schedules added.`,
      );
      setPrompt('');
    });
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!editor || cronDescription(editor.data.cron_expression).invalid) return;
    void runAction('save', async () => {
      if (editor.originalName) {
        await updateSchedule(editor.originalName, editor.data);
      } else {
        await createSchedule(editor.data);
      }
      if (editor.draftName) removeAppliedDraft(editor.draftName);
      setEditor(null);
      await refreshSchedules();
      setNotice(editor.originalName ? 'Schedule updated.' : 'Schedule added.');
    });
  }

  function handleDelete(name: string) {
    if (!confirm(`Delete schedule “${name}”?`)) return;
    void runAction(`delete:${name}`, async () => {
      await deleteSchedule(name);
      if (editor?.originalName === name) setEditor(null);
      await refreshSchedules();
      setNotice('Schedule deleted.');
    });
  }

  if (isError) {
    return (
      <div role="alert" className="inline-alert">
        Schedules could not be loaded. Refresh the page to try again.
      </div>
    );
  }
  if (!schedules) {
    return (
      <div role="status" className="empty-state">
        Loading schedules…
      </div>
    );
  }

  const cron = editor ? cronDescription(editor.data.cron_expression) : null;

  return (
    <div className="space-y-6">
      <div className="section-heading">
        <div>
          <p className="eyebrow">AUTOMATION</p>
          <h2>Schedules</h2>
          <p className="muted">
            Set recurring times to open and close your gate.
          </p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          disabled={busy || editor !== null}
          onClick={() =>
            openEditor({
              originalName: null,
              draftName: null,
              data: EMPTY_SCHEDULE,
            })
          }
        >
          <Icon name="plus" /> Add Schedule
        </button>
      </div>

      {error && (
        <div role="alert" className="inline-alert">
          <Icon name="alert" />
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="success-notice">
          <Icon name="check" />
          {notice}
        </p>
      )}

      {editor && (
        <section className="card" aria-labelledby="schedule-editor-title">
          <div className="card-header">
            <div>
              <h3 id="schedule-editor-title">
                {editor.originalName
                  ? 'Edit schedule'
                  : 'Add a schedule manually'}
              </h3>
              <p className="muted">
                Times use {publicConfig.controllerTimezone}.
              </p>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close schedule editor"
              disabled={busy}
              onClick={() => setEditor(null)}
            >
              <Icon name="close" />
            </button>
          </div>
          <form onSubmit={handleSave} className="card-body">
            <fieldset disabled={busy} className="form-grid">
              <div>
                <label htmlFor="schedule-name" className="field-label">
                  Name
                </label>
                <input
                  ref={editor.originalName ? undefined : editorInput}
                  id="schedule-name"
                  className="field"
                  value={editor.data.name}
                  disabled={editor.originalName !== null}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      data: { ...editor.data, name: event.target.value },
                    })
                  }
                  placeholder="Weekday arrival"
                  required
                />
              </div>
              <div>
                <label htmlFor="schedule-action" className="field-label">
                  Action
                </label>
                <select
                  id="schedule-action"
                  className="field"
                  value={editor.data.action}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      data: {
                        ...editor.data,
                        action: event.target.value as 'open' | 'close',
                      },
                    })
                  }
                >
                  <option value="close">Close</option>
                  <option value="open">Open</option>
                </select>
              </div>
              <div className="field-wide">
                <label htmlFor="schedule-cron" className="field-label">
                  Cron Expression
                </label>
                <input
                  ref={editor.originalName ? editorInput : undefined}
                  id="schedule-cron"
                  className="field font-mono"
                  value={editor.data.cron_expression}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      data: {
                        ...editor.data,
                        cron_expression: event.target.value,
                      },
                    })
                  }
                  placeholder="0 8 * * 1-5"
                  aria-invalid={cron?.invalid}
                  aria-describedby="schedule-cron-help"
                  required
                />
                <p
                  id="schedule-cron-help"
                  className={
                    cron?.invalid ? 'field-hint text-red-700' : 'field-hint'
                  }
                >
                  {cron?.description}
                </p>
              </div>
              <label
                className="check-field field-wide"
                htmlFor="schedule-enabled"
              >
                <input
                  id="schedule-enabled"
                  type="checkbox"
                  checked={editor.data.enabled}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      data: { ...editor.data, enabled: event.target.checked },
                    })
                  }
                />
                Enable this schedule
              </label>
              <div className="form-actions field-wide">
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={cron?.invalid}
                >
                  {pending === 'save'
                    ? 'Saving…'
                    : `${editor.originalName ? 'Update' : 'Create'} Schedule`}
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}

      <section
        className="card schedule-composer"
        aria-labelledby="schedule-compose-title"
      >
        <form onSubmit={handleDraftSubmit} className="card-body space-y-4">
          <div className="flex items-start gap-3">
            <span className="schedule-icon">
              <Icon name="sparkle" />
            </span>
            <div>
              <h3 id="schedule-compose-title">Tell us your routine</h3>
              <p className="muted">
                Describe it in your own words. Review the times before adding
                them.
              </p>
            </div>
          </div>
          <div>
            <label htmlFor="schedule-prompt" className="field-label">
              Describe schedule
            </label>
            <textarea
              ref={promptInput}
              id="schedule-prompt"
              className="field min-h-28 resize-y"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Open on weekdays at 7:30 AM and close at 6 PM…"
              rows={3}
              disabled={busy}
              aria-describedby="schedule-timezone"
              required
            />
          </div>
          <div className="prompt-examples">
            {PROMPT_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="prompt-example"
                disabled={busy}
                onClick={() => {
                  setPrompt(example);
                  promptInput.current?.focus();
                }}
              >
                {example}
                <Icon name="plus" />
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id="schedule-timezone" className="field-hint">
              <Icon name="clock" />
              All times in {publicConfig.controllerTimezone}
            </p>
            <button
              type="submit"
              className="button button-primary"
              disabled={busy || !prompt.trim()}
            >
              <Icon name="sparkle" />
              {pending === 'draft' ? 'Drafting…' : 'Draft'}
            </button>
          </div>
          {draftProgress && (
            <div role="status" className="draft-progress" aria-live="polite">
              <span className="status-dot animate-pulse" />
              <div>
                <strong>{draftProgress.title}</strong>
                <p>{draftProgress.detail}</p>
                <p className="field-hint">No gate command is being sent.</p>
              </div>
            </div>
          )}
        </form>
      </section>

      {draftResult && (
        <section
          className="card schedule-review"
          aria-labelledby="draft-review-title"
        >
          <div className="card-header">
            <div>
              <p className="eyebrow">READY TO REVIEW</p>
              <h3 id="draft-review-title">Review Drafts</h3>
              <p className="muted">{draftResult.interpretation}</p>
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="button button-ghost"
                disabled={busy}
                onClick={() => setDraftResult(null)}
              >
                Dismiss
              </button>
              {draftResult.drafts.length > 0 && (
                <button
                  type="button"
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => applyDrafts(draftResult.drafts, 'apply:all')}
                >
                  {pending === 'apply:all' ? 'Applying…' : 'Apply All'}
                </button>
              )}
            </div>
          </div>
          <div className="card-body space-y-4">
            {draftResult.questions.length > 0 && (
              <ul className="inline-alert">
                {draftResult.questions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            )}
            {draftResult.warnings.length > 0 && (
              <ul className="field-hint">
                {draftResult.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            <div className="draft-grid">
              {draftResult.drafts.map((draft) => (
                <article key={draft.name} className="draft-card">
                  <div className="flex items-start justify-between gap-3">
                    <h4>{draft.name}</h4>
                    <span className="status-pill neutral">
                      {draft.action === 'open' ? 'Open' : 'Close'} gate
                    </span>
                  </div>
                  <p className="muted mt-2">
                    {draft.summary || draft.description}
                  </p>
                  <p className="field-hint mt-3 font-mono">
                    {draft.cron_expression}
                  </p>
                  <ul className="space-y-1 mt-3 text-sm">
                    {draft.nextExecutions.slice(0, 3).map((execution) => (
                      <li key={execution}>{formatExecution(execution)}</li>
                    ))}
                  </ul>
                  <div className="form-actions mt-4">
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={busy}
                      onClick={() =>
                        applyDrafts([draft], `apply:${draft.name}`)
                      }
                    >
                      {pending === `apply:${draft.name}`
                        ? 'Applying…'
                        : 'Apply'}
                    </button>
                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() =>
                        openEditor({
                          originalName: null,
                          draftName: draft.name,
                          data: toScheduleInput(draft),
                        })
                      }
                    >
                      Edit
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {draftResult.drafts.length === 0 && (
              <p className="muted">
                Add more detail to your description to create a schedule.
              </p>
            )}
          </div>
        </section>
      )}

      <section className="card" aria-labelledby="saved-schedules-title">
        <div className="card-header">
          <div>
            <h3 id="saved-schedules-title">
              Your schedules <span className="muted">({schedules.length})</span>
            </h3>
            <p className="muted">
              {schedules.filter((schedule) => schedule.enabled).length} active ·{' '}
              {publicConfig.controllerTimezone}
            </p>
          </div>
          <Icon name="calendar" />
        </div>
        {schedules.length === 0 ? (
          <div className="empty-state">
            <Icon name="calendar" />
            <h4>Your routine starts here</h4>
            <p>
              Describe when your gate should open or close to add your first
              schedule.
            </p>
          </div>
        ) : (
          <ul className="schedule-list">
            {schedules.map((schedule) => (
              <li key={schedule.name} className="schedule-row">
                <span className="schedule-icon">
                  <Icon
                    name={
                      schedule.action === 'open'
                        ? 'arrow-up-right'
                        : 'arrow-down-right'
                    }
                  />
                </span>
                <div className="schedule-copy">
                  <h4>{schedule.name}</h4>
                  <p className="muted">
                    {schedule.action === 'open' ? 'Open' : 'Close'} gate ·{' '}
                    {cronDescription(schedule.cron_expression).description}
                  </p>
                  <p className="field-hint font-mono">
                    {schedule.cron_expression}
                  </p>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={schedule.enabled}
                    aria-label={`Enable ${schedule.name}`}
                    className="schedule-switch"
                    disabled={busy}
                    onClick={() =>
                      void runAction(`toggle:${schedule.name}`, async () => {
                        await updateSchedule(schedule.name, {
                          enabled: !schedule.enabled,
                        });
                        await refreshSchedules();
                        setNotice(
                          `${schedule.name} ${schedule.enabled ? 'paused' : 'enabled'}.`,
                        );
                      })
                    }
                  >
                    <span />
                    <span className="sr-only">
                      {schedule.enabled ? 'Enabled' : 'Paused'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Edit ${schedule.name}`}
                    disabled={busy}
                    onClick={() =>
                      openEditor({
                        originalName: schedule.name,
                        draftName: null,
                        data: toScheduleInput(schedule),
                      })
                    }
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete ${schedule.name}`}
                    disabled={busy}
                    onClick={() => handleDelete(schedule.name)}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function cronDescription(expression: string) {
  if (!expression.trim())
    return {
      description: 'Five fields: minute, hour, day, month, weekday.',
      invalid: false,
    };
  try {
    if (expression.trim().split(/\s+/).length !== 5)
      throw new Error('Expected five cron fields');
    return { description: cronstrue.toString(expression), invalid: false };
  } catch {
    return {
      description: 'Enter a valid five-field cron expression.',
      invalid: true,
    };
  }
}

function toScheduleInput(schedule: ScheduleInput): ScheduleInput {
  return {
    name: schedule.name,
    cron_expression: schedule.cron_expression,
    action: schedule.action,
    enabled: schedule.enabled,
  };
}

function formatExecution(execution: string): string {
  return formatInTimeZone(
    execution,
    publicConfig.controllerTimezone,
    'yyyy-MM-dd EEE h:mm a',
  );
}
