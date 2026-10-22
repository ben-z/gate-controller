'use client';

import { useRef, useState } from 'react';
import { useSWRConfig } from 'swr';
import cronstrue from 'cronstrue';
import { formatInTimeZone } from 'date-fns-tz';
import { Icon } from '@/components/icon';
import { publicConfig } from '@/config';
import { useFocusAfterCommit } from '@/hooks/useFocusAfterCommit';
import {
  createSchedule,
  deleteSchedule,
  draftSchedules,
  updateSchedule,
  useSchedules,
} from '@/hooks/useSchedules';
import {
  Schedule,
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
  original: Readonly<ScheduleInput> | null;
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
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const actionError = useRef<HTMLDivElement>(null);
  const editorTrigger = useRef<HTMLButtonElement | null>(null);
  const manualTrigger = useRef<HTMLButtonElement>(null);
  const retryButton = useRef<HTMLButtonElement>(null);
  const busy = pending !== null;
  const focusAfterCommit = useFocusAfterCommit(busy);
  const outsideEditorDisabled = busy || editor !== null;

  async function retrySchedules() {
    const initiatingFocus = document.activeElement;
    await mutate();
    void revalidate('/api/schedules/upcoming');
    focusAfterCommit(() => {
      if (
        document.activeElement !== document.body &&
        document.activeElement !== initiatingFocus
      ) return;
      if (retryButton.current) return;
      if (editorInput.current) {
        editorInput.current.focus();
      } else {
        manualTrigger.current?.focus();
      }
    });
  }

  if (!schedules) {
    return (
      <div
        role={isError ? 'alert' : 'status'}
        className={isError ? 'inline-alert' : 'empty-state'}
      >
        {isError ? 'Schedules could not be loaded.' : 'Loading schedules…'}
        {isError && (
          <button
            ref={retryButton}
            type="button"
            className="button button-secondary"
            onClick={() => void retrySchedules()}
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const displayedSchedules = schedules;

  function refreshSchedules() {
    // Revalidation errors remain separate from the confirmed write in SWR.
    void mutate();
    void revalidate('/api/schedules/upcoming');
  }

  async function showConfirmedSchedules(
    nextSchedules: Schedule[],
    message: string,
  ) {
    await mutate(nextSchedules, { revalidate: false });
    setNotice(message);
  }

  async function runAction(operation: string, action: () => Promise<void>) {
    if (busy) return;
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
      focusAfterCommit(() => actionError.current?.focus());
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

  function focusReviewOrPrompt() {
    (reviewTitle.current ?? promptInput.current)?.focus();
  }

  function openEditor(next: Editor, trigger: HTMLButtonElement) {
    if (outsideEditorDisabled) return;
    editorTrigger.current = trigger;
    setEditor(next);
    setError(null);
    focusAfterCommit(() => {
      const input = editorInput.current;
      input?.scrollIntoView({ block: 'center' });
      input?.focus({ preventScroll: true });
    });
  }

  function closeEditor() {
    setEditor(null);
    focusAfterCommit(() => {
      if (editorTrigger.current?.isConnected) {
        editorTrigger.current.focus();
      } else {
        focusReviewOrPrompt();
      }
    });
  }

  function handleDraftSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (outsideEditorDisabled) return;
    void runAction('draft', async () => {
      setDraftResult(null);
      setDraftProgress({
        title: 'Starting draft',
        detail: 'Preparing your schedule.',
      });
      try {
        setDraftResult(await draftSchedules(prompt.trim(), setDraftProgress));
        focusAfterCommit(() => reviewTitle.current?.focus());
      } finally {
        setDraftProgress(null);
      }
    });
  }

  function applyDrafts(drafts: ScheduleDraft[], operation: string) {
    if (outsideEditorDisabled) return;
    void runAction(operation, async () => {
      let confirmedSchedules = displayedSchedules;
      let added = 0;
      for (const draft of drafts) {
        const saved = await createSchedule(toScheduleInput(draft));
        confirmedSchedules = withSavedSchedule(confirmedSchedules, saved);
        removeAppliedDraft(draft.name);
        added += 1;
        await showConfirmedSchedules(
          confirmedSchedules,
          added === 1 ? 'Schedule added.' : `${added} schedules added.`,
        );
        refreshSchedules();
      }
      if (operation === 'apply:all') setPrompt('');
      focusAfterCommit(focusReviewOrPrompt);
    });
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!editor || cronDescription(editor.data.cron_expression).invalid) return;
    void runAction('save', async () => {
      let saved: Schedule;
      if (editor.original) {
        const changes: Partial<Omit<ScheduleInput, 'name'>> = {};
        if (editor.data.cron_expression !== editor.original.cron_expression) {
          changes.cron_expression = editor.data.cron_expression;
        }
        if (editor.data.action !== editor.original.action) {
          changes.action = editor.data.action;
        }
        if (editor.data.enabled !== editor.original.enabled) {
          changes.enabled = editor.data.enabled;
        }
        saved = await updateSchedule(editor.original.name, changes);
      } else {
        saved = await createSchedule(editor.data);
      }
      await showConfirmedSchedules(
        withSavedSchedule(displayedSchedules, saved),
        editor.original ? 'Schedule updated.' : 'Schedule added.',
      );
      if (editor.draftName) removeAppliedDraft(editor.draftName);
      closeEditor();
      refreshSchedules();
    });
  }

  function handleDelete(name: string) {
    if (outsideEditorDisabled) return;
    if (!confirm(`Delete schedule “${name}”?`)) return;
    void runAction(`delete:${name}`, async () => {
      await deleteSchedule(name);
      await showConfirmedSchedules(
        displayedSchedules.filter((schedule) => schedule.name !== name),
        'Schedule deleted.',
      );
      focusAfterCommit(() => manualTrigger.current?.focus());
      refreshSchedules();
    });
  }

  const cron = editor ? cronDescription(editor.data.cron_expression) : null;

  return (
    <div className="space-y-6">
      {error && (
        <div ref={actionError} tabIndex={-1} role="alert" className="inline-alert">
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
      {isError && (
        <div role="alert" className="inline-alert">
          <Icon name="alert" />
          <p className="min-w-0 flex-1">
            Schedules could not be refreshed. Showing cached schedules.
          </p>
          <button
            ref={retryButton}
            type="button"
            className="button button-secondary"
            disabled={busy}
            onClick={() => void retrySchedules()}
          >
            Try again
          </button>
        </div>
      )}

      {editor && (
        <section className="card" aria-labelledby="schedule-editor-title">
          <div className="card-header">
            <div>
              <h2 id="schedule-editor-title" className="section-heading">
                {editor.original
                  ? 'Edit schedule'
                  : 'Add schedule'}
              </h2>
              <p className="muted">
                Times use {publicConfig.controllerTimezone}.
              </p>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close schedule editor"
              disabled={busy}
              onClick={closeEditor}
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
                  ref={editor.original ? undefined : editorInput}
                  id="schedule-name"
                  className="field"
                  value={editor.data.name}
                  disabled={editor.original !== null}
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
                  ref={editor.original ? editorInput : undefined}
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
                    : `${editor.original ? 'Update' : 'Create'} Schedule`}
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={closeEditor}
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
          <div className="schedule-compose-heading">
            <div className="schedule-compose-copy flex items-start gap-3">
              <span className="schedule-icon">
                <Icon name="sparkle" />
              </span>
              <div className="min-w-0">
                <h2 id="schedule-compose-title" className="section-heading">Create a schedule</h2>
                <p className="muted">
                  Describe when to open or close the gate, then review the draft.
                </p>
              </div>
            </div>
            <button
              ref={manualTrigger}
              type="button"
              className="button button-secondary"
              disabled={outsideEditorDisabled}
              onClick={(event) =>
                openEditor(
                  { original: null, draftName: null, data: EMPTY_SCHEDULE },
                  event.currentTarget,
                )
              }
            >
              Add manually
            </button>
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
              disabled={outsideEditorDisabled}
              aria-describedby="schedule-timezone"
              required
            />
          </div>
          <p id="schedule-examples-hint" className="field-hint">
            Choose an example to replace your description.
          </p>
          <div
            className="prompt-examples"
            aria-describedby="schedule-examples-hint"
          >
            {PROMPT_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="prompt-example"
                disabled={outsideEditorDisabled}
                onClick={() => {
                  setPrompt(example);
                  promptInput.current?.focus();
                }}
              >
                {example}
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
              disabled={outsideEditorDisabled || !prompt.trim()}
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
              <h2
                id="draft-review-title"
                className="section-heading"
                ref={reviewTitle}
                tabIndex={-1}
              >
                Review Drafts
              </h2>
              <p className="muted">{draftResult.interpretation}</p>
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="button button-ghost"
                disabled={outsideEditorDisabled}
                onClick={() => {
                  setDraftResult(null);
                  focusAfterCommit(focusReviewOrPrompt);
                }}
              >
                Dismiss
              </button>
              {draftResult.drafts.length > 0 && (
                <button
                  type="button"
                  className="button button-primary"
                  disabled={outsideEditorDisabled}
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
                    <h3>{draft.name}</h3>
                    <span className="status-pill neutral">
                      {draft.action === 'open' ? 'Open' : 'Close'} gate
                    </span>
                  </div>
                  <p className="muted mt-2">{draft.description}</p>
                  <p className="field-hint mt-3">
                    Saves as{' '}
                    <span
                      className={`status-pill ${draft.enabled ? 'positive' : 'neutral'}`}
                    >
                      {draft.enabled ? 'Enabled' : 'Paused'}
                    </span>
                  </p>
                  <p className="field-hint mt-3 font-mono">
                    {draft.cron_expression}
                  </p>
                  <p className="field-hint mt-3">
                    {draft.enabled
                      ? 'Next scheduled times'
                      : 'Next times if enabled'}
                  </p>
                  <ul className="space-y-1 mt-1 text-sm">
                    {draft.nextExecutions.slice(0, 3).map((execution) => (
                      <li key={execution}>{formatExecution(execution)}</li>
                    ))}
                  </ul>
                  <div className="form-actions mt-4">
                    <button
                      type="button"
                      className="button button-primary"
                      disabled={outsideEditorDisabled}
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
                      disabled={outsideEditorDisabled}
                      onClick={(event) =>
                        openEditor(
                          {
                            original: null,
                            draftName: draft.name,
                            data: toScheduleInput(draft),
                          },
                          event.currentTarget,
                        )
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
            <h2 id="saved-schedules-title" className="section-heading">
              Schedules <span className="muted">({schedules.length})</span>
            </h2>
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
            <h3>No schedules</h3>
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
                  <h3>{schedule.name}</h3>
                  <p className="muted">
                    {schedule.action === 'open' ? 'Open' : 'Close'} gate ·{' '}
                    {cronDescription(schedule.cron_expression).description}
                  </p>
                  <p className="field-hint font-mono">
                    {schedule.cron_expression}
                  </p>
                </div>
                <div className="row-actions">
                  <span
                    className={`status-pill ${schedule.enabled ? 'positive' : 'neutral'}`}
                  >
                    {schedule.enabled ? 'Enabled' : 'Paused'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={schedule.enabled}
                    aria-label={`Enable ${schedule.name}`}
                    className="schedule-switch"
                    disabled={outsideEditorDisabled}
                    onClick={() =>
                      void runAction(`toggle:${schedule.name}`, async () => {
                        const saved = await updateSchedule(schedule.name, {
                          enabled: !schedule.enabled,
                        });
                        await showConfirmedSchedules(
                          withSavedSchedule(displayedSchedules, saved),
                          `${schedule.name} ${schedule.enabled ? 'paused' : 'enabled'}.`,
                        );
                        refreshSchedules();
                      })
                    }
                  >
                    <span />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Edit ${schedule.name}`}
                    disabled={outsideEditorDisabled}
                    onClick={(event) => {
                      const original = Object.freeze(toScheduleInput(schedule));
                      openEditor(
                        {
                          original,
                          draftName: null,
                          data: original,
                        },
                        event.currentTarget,
                      );
                    }}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete ${schedule.name}`}
                    disabled={outsideEditorDisabled}
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

function withSavedSchedule(schedules: Schedule[], saved: Schedule): Schedule[] {
  if (schedules.some((schedule) => schedule.name === saved.name)) {
    return schedules.map((schedule) =>
      schedule.name === saved.name ? saved : schedule,
    );
  }
  return [saved, ...schedules];
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
