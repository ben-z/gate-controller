export interface Schedule {
  name: string;
  cron_expression: string;
  action: 'open' | 'close';
  enabled: boolean;
  created_by?: string;
}

export type ScheduleInput = Pick<
  Schedule,
  'name' | 'cron_expression' | 'action' | 'enabled'
>;
