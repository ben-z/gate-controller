import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  process.env.DB_PATH = ':memory:';
  process.env.INITIAL_ADMIN_CREDENTIALS = '{"username":"admin","password":"adminpass"}';
});

describe('login action', () => {
  it('authenticates a user and sets cookie', async () => {
    const dbModule = await import('../src/lib/db');
    dbModule.createUser({ username: 'john', password: 'pass', role: 'user', created_by: 'test' });

    vi.doMock('next/headers', () => ({
      cookies: () => ({ set: vi.fn() })
    }));
    const redirect = vi.fn();
    vi.doMock('next/navigation', () => ({ redirect }));

    const { login } = await import('../src/lib/auth/login');

    const formData = new FormData();
    formData.set('username', 'john');
    formData.set('password', 'pass');

    await login(null, formData);

    expect(redirect).toHaveBeenCalledWith('/dashboard');

    dbModule.default.close();
    vi.resetModules();
    vi.clearAllMocks();
  });
});
