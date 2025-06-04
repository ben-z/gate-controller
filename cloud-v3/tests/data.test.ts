import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  process.env.DB_PATH = ':memory:';
  process.env.INITIAL_ADMIN_CREDENTIALS = '{"username":"admin","password":"adminpass"}';
});

describe('getInitialData', () => {
  it('aggregates data from the database', async () => {
    const scheduler = await import('../src/lib/scheduler');
    const upcomingSpy = vi.spyOn(scheduler, 'getUpcomingSchedules').mockResolvedValue([]);

    const dbModule = await import('../src/lib/db');
    dbModule.createUser({ username: 'john', password: 'pass', role: 'user', created_by: 'test' });
    dbModule.createSchedule({ name: 'morning', cron_expression: '* * * * *', action: 'open', enabled: true, created_by: 'test' });

    const dataModule = await import('../src/lib/data');
    const data = await dataModule.getInitialData();

    expect(data.schedules.length).toBe(1);
    expect(data.users.length).toBeGreaterThan(0);
    expect(upcomingSpy).toHaveBeenCalled();

    dbModule.default.close();
  });
});
