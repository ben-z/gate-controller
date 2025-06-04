import { describe, it, expect, beforeEach } from 'vitest';

beforeEach(() => {
  process.env.DB_PATH = ':memory:';
  process.env.INITIAL_ADMIN_CREDENTIALS = '{"username":"admin","password":"adminpass"}';
});

describe('gate status', () => {
  it('updates and retrieves gate status with history', async () => {
    const dbModule = await import('../src/lib/db');
    const { updateGateStatus, getGateStatus } = dbModule;

    updateGateStatus('open', 'user', 'tester');
    const status = getGateStatus(true);
    expect(status.status).toBe('open');
    expect(status.history?.[0].actor_name).toBe('tester');

    dbModule.default.close();
  });
});
