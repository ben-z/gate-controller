'use client';

import { useState } from 'react';
import {
  createSchedule,
  deleteSchedule,
  draftSchedules,
  updateSchedule,
  useSchedules,
} from '@/hooks/useSchedules';
import { publicConfig } from '@/config';
import cronstrue from 'cronstrue';
import {
  Schedule,
  ScheduleDraft,
  ScheduleDraftResponse,
  ScheduleInput,
} from '@/types/schedule';

const DEFAULT_FORM_DATA: ScheduleInput = Object.freeze({
  name: '',
  cron_expression: '',
  action: 'close',
  enabled: true,
});

const PROMPT_EXAMPLES = [
  'Open weekdays at 7:30 AM',
  'Close every night at 6 PM',
  'Open Saturday and Sunday at 9 AM',
];

export function ScheduleManager() {
  const { schedules, isLoading, isError, mutate } = useSchedules();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<ScheduleInput>(DEFAULT_FORM_DATA);
  const [cronError, setCronError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [draftResult, setDraftResult] = useState<ScheduleDraftResponse | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [applyingDraft, setApplyingDraft] = useState<string | null>(null);

  const validateCronExpression = (expression: string): boolean => {
    try {
      if (expression.trim().split(/\s+/).length !== 5) {
        throw new Error('Expected five cron fields');
      }
      cronstrue.toString(expression);
      setCronError(null);
      return true;
    } catch {
      setCronError('Invalid cron expression');
      return false;
    }
  };

  const handleDraftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    try {
      setError(null);
      setIsDrafting(true);
      setDraftResult(await draftSchedules(trimmedPrompt));
    } catch (error) {
      console.error('Failed to draft schedules:', error);
      setError(error instanceof Error ? error.message : 'Failed to draft schedules');
    } finally {
      setIsDrafting(false);
    }
  };

  const handleApplyDraft = async (draft: ScheduleDraft) => {
    try {
      setError(null);
      setApplyingDraft(draft.name);
      await createSchedule(toScheduleInput(draft));
      setDraftResult((current) => {
        if (!current) return current;
        const drafts = current.drafts.filter((item) => item.name !== draft.name);
        return drafts.length ? { ...current, drafts } : null;
      });
      await mutate();
    } catch (error) {
      console.error('Failed to apply schedule draft:', error);
      setError(error instanceof Error ? error.message : 'Failed to apply schedule draft');
    } finally {
      setApplyingDraft(null);
    }
  };

  const handleApplyAllDrafts = async () => {
    if (!draftResult?.drafts.length) return;

    try {
      setError(null);
      setApplyingDraft('all');
      for (const draft of draftResult.drafts) {
        await createSchedule(toScheduleInput(draft));
      }
      setDraftResult(null);
      setPrompt('');
      await mutate();
    } catch (error) {
      console.error('Failed to apply schedule drafts:', error);
      setError(error instanceof Error ? error.message : 'Failed to apply schedule drafts');
    } finally {
      setApplyingDraft(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateCronExpression(formData.cron_expression)) {
      return;
    }

    try {
      if (editingName) {
        await updateSchedule(editingName, formData);
      } else {
        await createSchedule(formData);
      }
      setEditingName(null);
      setIsFormOpen(false);
      setFormData(DEFAULT_FORM_DATA);
      await mutate();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      setError(error instanceof Error ? error.message : 'Failed to save schedule');
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setIsFormOpen(true);
    setEditingName(schedule.name);
    setFormData({
      name: schedule.name,
      cron_expression: schedule.cron_expression,
      action: schedule.action,
      enabled: schedule.enabled,
    });
  };

  const handleEditDraft = (draft: ScheduleDraft) => {
    setIsFormOpen(true);
    setEditingName(null);
    setFormData(toScheduleInput(draft));
  };

  const handleDelete = async (name: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      setError(null);
      await deleteSchedule(name);
      mutate();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete schedule');
    }
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingName(null);
    setFormData(DEFAULT_FORM_DATA);
    setCronError(null);
  };

  const handleCronChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, cron_expression: value });
    if (value) {
      validateCronExpression(value);
    } else {
      setCronError(null);
    }
  };

  const getCronDescription = (cron_expression: string) => {
    try {
      if (cron_expression.trim().split(/\s+/).length !== 5) {
        throw new Error('Expected five cron fields');
      }
      return cronstrue.toString(cron_expression);
    } catch {
      return `Invalid cron expression: ${cron_expression}`;
    }
  };

  if (isError) {
    return <div>Error loading schedules</div>;
  }

  if (isLoading && !schedules) {
    return <div>Loading schedules...</div>;
  }

  if (!schedules) {
    return <div>No schedules available</div>;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/50 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">Schedules</h2>
        {!isFormOpen && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            Add Schedule
          </button>
        )}
      </div>

      <form
        onSubmit={handleDraftSubmit}
        className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
      >
        <label htmlFor="schedule-prompt" className="block text-sm font-medium">
          Describe schedule
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <textarea
            id="schedule-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            className="min-h-20 flex-1 resize-y rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
            placeholder="Open weekdays at 7:30 AM and close at 6 PM"
          />
          <button
            type="submit"
            disabled={isDrafting || !prompt.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400 sm:self-start"
          >
            {isDrafting ? 'Drafting...' : 'Draft'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {PROMPT_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setPrompt(example)}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-700 transition-colors hover:bg-white dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      {draftResult && (
        <DraftReview
          result={draftResult}
          applyingDraft={applyingDraft}
          onApply={handleApplyDraft}
          onApplyAll={handleApplyAllDrafts}
          onEdit={handleEditDraft}
        />
      )}

      {isFormOpen && (
        <ScheduleForm
          cronError={cronError}
          editingName={editingName}
          formData={formData}
          getCronDescription={getCronDescription}
          onCancel={handleCancel}
          onCronChange={handleCronChange}
          onSubmit={handleSubmit}
          setFormData={setFormData}
        />
      )}

      {schedules.length > 0 ? (
        <ScheduleList
          schedules={schedules}
          getCronDescription={getCronDescription}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      ) : (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">
          No schedules found.
        </div>
      )}
    </div>
  );
}

function DraftReview({
  applyingDraft,
  onApply,
  onApplyAll,
  onEdit,
  result,
}: {
  applyingDraft: string | null;
  onApply: (draft: ScheduleDraft) => void;
  onApplyAll: () => void;
  onEdit: (draft: ScheduleDraft) => void;
  result: ScheduleDraftResponse;
}) {
  const hasDrafts = result.drafts.length > 0;

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-medium">Review Drafts</h3>
          {result.interpretation && (
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {result.interpretation}
            </p>
          )}
        </div>
        {hasDrafts && (
          <button
            type="button"
            onClick={onApplyAll}
            disabled={applyingDraft !== null}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {applyingDraft === 'all' ? 'Applying...' : 'Apply All'}
          </button>
        )}
      </div>

      <NoticeList tone="amber" items={result.questions} />
      <NoticeList tone="gray" items={result.warnings} />

      {hasDrafts ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {result.drafts.map((draft) => (
            <div
              key={draft.name}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{draft.name}</div>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {draft.summary || draft.description}
                  </div>
                </div>
                <ActionBadge action={draft.action} />
              </div>
              <div className="mt-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                {draft.cron_expression}
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                {draft.nextExecutions.slice(0, 3).map((execution) => (
                  <div key={execution}>{formatExecution(execution)}</div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => onApply(draft)}
                  disabled={applyingDraft !== null}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {applyingDraft === draft.name ? 'Applying...' : 'Apply'}
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(draft)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                >
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-white p-4 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-300">
          No draft schedules.
        </div>
      )}
    </div>
  );
}

function NoticeList({ items, tone }: { items: string[]; tone: 'amber' | 'gray' }) {
  if (items.length === 0) return null;

  const classes =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
      : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';

  return (
    <div className={`space-y-1 rounded-lg border p-3 text-sm ${classes}`}>
      {items.map((item) => (
        <div key={item}>{item}</div>
      ))}
    </div>
  );
}

function ScheduleForm({
  cronError,
  editingName,
  formData,
  getCronDescription,
  onCancel,
  onCronChange,
  onSubmit,
  setFormData,
}: {
  cronError: string | null;
  editingName: string | null;
  formData: ScheduleInput;
  getCronDescription: (cronExpression: string) => string;
  onCancel: () => void;
  onCronChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  setFormData: (data: ScheduleInput) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
    >
      <div>
        <label htmlFor="schedule-name" className="mb-1 block text-sm font-medium">
          Name
        </label>
        <input
          id="schedule-name"
          type="text"
          value={formData.name}
          disabled={!!editingName}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 ${
            !!editingName
              ? 'border-gray-300 bg-gray-100 text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400'
              : 'border-gray-300 dark:border-gray-700'
          }`}
          required
        />
      </div>
      <div>
        <label htmlFor="schedule-cron-expression" className="mb-1 block text-sm font-medium">
          Cron Expression
        </label>
        <input
          id="schedule-cron-expression"
          type="text"
          value={formData.cron_expression}
          onChange={onCronChange}
          className={`w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 ${
            cronError ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-700'
          }`}
          placeholder="0 8 * * 1-5"
          required
        />
        {formData.cron_expression && (
          <p
            className={`mt-1 text-sm ${
              cronError ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {cronError || getCronDescription(formData.cron_expression)}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="schedule-action" className="mb-1 block text-sm font-medium">
          Action
        </label>
        <select
          id="schedule-action"
          value={formData.action}
          onChange={(e) =>
            setFormData({ ...formData, action: e.target.value as 'open' | 'close' })
          }
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
        >
          <option value="close">Close</option>
          <option value="open">Open</option>
        </select>
      </div>
      <div className="flex items-center">
        <input
          type="checkbox"
          id="enabled"
          checked={formData.enabled}
          onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="enabled" className="ml-2 block text-sm">
          Enabled
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {editingName ? 'Update' : 'Create'} Schedule
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ScheduleList({
  getCronDescription,
  onDelete,
  onEdit,
  schedules,
}: {
  getCronDescription: (cronExpression: string) => string;
  onDelete: (name: string) => void;
  onEdit: (schedule: Schedule) => void;
  schedules: Schedule[];
}) {
  return (
    <>
      <div className="space-y-3 sm:hidden">
        {schedules.map((schedule) => (
          <div
            key={schedule.name}
            className="rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-800/50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{schedule.name}</div>
                <div className="mt-1 font-mono text-xs text-gray-600 dark:text-gray-400">
                  {schedule.cron_expression}
                </div>
              </div>
              <ScheduleStatus enabled={schedule.enabled} />
            </div>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {getCronDescription(schedule.cron_expression)}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">
                Action:{' '}
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {schedule.action}
                </span>
              </span>
              <div className="shrink-0 text-sm">
                <button
                  onClick={() => onEdit(schedule)}
                  className="mr-3 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(schedule.name)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg bg-gray-50 dark:bg-gray-800/50 sm:block">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <TableHeader>Schedule</TableHeader>
              <TableHeader>Cron Expression</TableHeader>
              <TableHeader>Action</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader align="right">Actions</TableHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-transparent">
            {schedules.map((schedule) => (
              <tr key={schedule.name}>
                <td className="whitespace-nowrap px-6 py-4 text-sm">{schedule.name}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <div>{schedule.cron_expression}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {getCronDescription(schedule.cron_expression)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">{schedule.action}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <ScheduleStatus enabled={schedule.enabled} />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                  <button
                    onClick={() => onEdit(schedule)}
                    className="mr-3 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(schedule.name)}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TableHeader({
  align = 'left',
  children,
}: {
  align?: 'left' | 'right';
  children: React.ReactNode;
}) {
  const alignClass = align === 'right' ? 'text-right' : 'text-left';

  return (
    <th
      className={`px-6 py-3 ${alignClass} text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400`}
    >
      {children}
    </th>
  );
}

function ActionBadge({ action }: { action: 'open' | 'close' }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        action === 'open'
          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
      }`}
    >
      {action}
    </span>
  );
}

function ScheduleStatus({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        enabled
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200'
      }`}
    >
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
}

function toScheduleInput(draft: ScheduleDraft): ScheduleInput {
  return {
    name: draft.name,
    cron_expression: draft.cron_expression,
    action: draft.action,
    enabled: draft.enabled,
  };
}

function formatExecution(execution: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: publicConfig.controllerTimezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(execution));
}
