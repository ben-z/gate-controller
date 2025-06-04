import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  process.env.DB_PATH = ':memory:';
  process.env.INITIAL_ADMIN_CREDENTIALS = '{"username":"admin","password":"adminpass"}';
});

describe('schedule CRUD', () => {
  it('creates, updates and deletes schedules', async () => {
    const dbModule = await import('../src/lib/db');
    const { createSchedule, getSchedule, updateSchedule, deleteSchedule } = dbModule;

    createSchedule({
      name: 'morning',
      cron_expression: '0 9 * * *',
      action: 'open',
      enabled: true,
      created_by: 'test'
    });

    let schedule = getSchedule('morning');
    expect(schedule?.action).toBe('open');

    updateSchedule('morning', { action: 'close', enabled: false });
    schedule = getSchedule('morning');
    expect(schedule?.action).toBe('close');
    expect(Boolean(schedule?.enabled)).toBe(false);

    deleteSchedule('morning');
    expect(getSchedule('morning')).toBeNull();

    dbModule.default.close();
  });
});
