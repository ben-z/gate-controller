import { describe, it, expect, vi } from 'vitest';

describe('logout action', () => {
  it('deletes session cookie and redirects', async () => {
    const cookieStore = {
      get: vi.fn(() => ({ value: 'key' })),
      delete: vi.fn()
    };
    vi.doMock('next/headers', () => ({ cookies: () => cookieStore }));
    const redirect = vi.fn();
    vi.doMock('next/navigation', () => ({ redirect }));
    const deleteSession = vi.fn();
    vi.doMock('../src/lib/db', () => ({ deleteSession }));

    const { logout } = await import('../src/lib/auth/logout');
    await logout();
    expect(deleteSession).toHaveBeenCalledWith('key');
    expect(cookieStore.delete).toHaveBeenCalledWith('session_key');
    expect(redirect).toHaveBeenCalledWith('/login');

    vi.resetModules();
    vi.clearAllMocks();
  });

  it('no cookie results in no action', async () => {
    const cookieStore = { get: vi.fn(() => null), delete: vi.fn() };
    vi.doMock('next/headers', () => ({ cookies: () => cookieStore }));
    const redirect = vi.fn();
    vi.doMock('next/navigation', () => ({ redirect }));
    const { logout } = await import('../src/lib/auth/logout');
    await logout();
    expect(redirect).not.toHaveBeenCalled();
    vi.resetModules();
    vi.clearAllMocks();
  });
});
