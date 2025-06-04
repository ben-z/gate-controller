import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = ':memory:';
  process.env.INITIAL_ADMIN_CREDENTIALS = '{"username":"admin","password":"adminpass"}';
});

describe('scheduler operations', () => {
  it('starts and stops schedules', async () => {
    const db = await import('../src/lib/db');
    const { startSchedule, stopSchedule, updateSchedule, initializeSchedules, getUpcomingSchedules } = await import('../src/lib/scheduler');

    const schedule = db.createSchedule({ name: 'test', cron_expression: '* * * * *', action: 'open', enabled: true, created_by: 'test' });

    await startSchedule(schedule);
    await updateSchedule({ ...schedule, action: 'close' });
    await updateSchedule({ ...schedule, enabled: false });
    await initializeSchedules([schedule]);
    await stopSchedule('test');

    const upcoming = await getUpcomingSchedules([schedule]);
    expect(upcoming).toEqual([]);

    db.default.close();
  });
});
