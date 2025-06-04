import { describe, it, expect, vi } from 'vitest';

describe('ensureSession', () => {
  it('redirects when no session is found', async () => {
    vi.doMock('next/headers', () => ({ cookies: () => ({ get: () => null }) }));
    const redirect = vi.fn();
    vi.doMock('next/navigation', () => ({ redirect }));
    const { ensureSession } = await import('../src/lib/auth/ensure-session');
    await ensureSession();
    expect(redirect).toHaveBeenCalledWith('/login');
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns session when valid cookie is present', async () => {
    vi.doMock('next/headers', () => ({ cookies: () => ({ get: () => ({ value: 'key' }) }) }));
    vi.doMock('@/lib/db', () => ({ refreshSession: () => ({ user: { username: 'john' }, session: { session_key: 'key' } }) }));
    const { ensureSession } = await import('../src/lib/auth/ensure-session');
    const session = await ensureSession();
    expect(session?.user.username).toBe('john');
    vi.resetModules();
    vi.clearAllMocks();
  });
});
