export interface Schedule {
  name: string;
  cron_expression: string;
  action: 'open' | 'close';
  enabled: boolean;
  created_by?: string;
}

export type ScheduleDraft = ScheduleInput & {
  description: string;
  nextExecutions: string[];
  summary: string;
};

export type ScheduleDraftResponse = {
  interpretation: string;
  drafts: ScheduleDraft[];
  questions: string[];
  warnings: string[];
};

export type ScheduleInput = Pick<
  Schedule,
  'name' | 'cron_expression' | 'action' | 'enabled'
>;
