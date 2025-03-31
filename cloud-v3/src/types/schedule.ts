export interface Schedule {
  id: number;
  name: string;
  cron_expression: string;
  action: 'open' | 'close';
  enabled: boolean;
  created_by?: string;
}