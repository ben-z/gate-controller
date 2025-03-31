export interface Schedule {
  name: string;
  cron_expression: string;
  action: 'open' | 'close';
  enabled: boolean;
  created_by?: string;
}