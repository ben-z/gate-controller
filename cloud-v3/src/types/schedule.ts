export interface Schedule {
  id: number;
  name: string;
  cronExpression: string;
  action: 'open' | 'close';
  enabled: boolean;
  created_by?: string;
}