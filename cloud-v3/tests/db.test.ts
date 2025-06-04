import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.DB_PATH = ':memory:';
  process.env.INITIAL_ADMIN_CREDENTIALS = '{"username":"admin","password":"adminpass"}';
});

describe('db user management', () => {
  it('creates and authenticates a user', async () => {
    const dbModule = await import('../src/lib/db');
    const { createUser, authenticateUser } = dbModule;

    createUser({ username: 'john', password: 'secret', role: 'user', created_by: 'test' });

    const result = await authenticateUser('john', 'secret');
    expect(result?.user.username).toBe('john');

    // close database
    dbModule.default.close();
  });
});
