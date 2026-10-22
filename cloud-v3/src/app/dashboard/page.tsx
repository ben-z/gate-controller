import { ensureSession } from '@/lib/auth/ensure-session';
import { Dashboard, getDashboardNavigation } from '@/components/dashboard';
import type { Metadata } from 'next';
import { DiagnosticsPanel } from '@/components/diagnostics-panel';
import { getGateStatus, getSchedules, getUsers } from '@/lib/db';
import { SWRConfig } from 'swr';

type DashboardPageProps = { searchParams: Promise<{ view?: string }> };

export async function generateMetadata({
  searchParams,
}: DashboardPageProps): Promise<Metadata> {
  const [{ view }, { user }] = await Promise.all([
    searchParams,
    ensureSession(),
  ]);
  const { current } = getDashboardNavigation(view, user.role === 'admin');
  return { title: `${current.label} · Gate Controller` };
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { view } = await searchParams;
  const { user } = await ensureSession();
  const isAdmin = user.role === 'admin';
  const { current } = getDashboardNavigation(view, isAdmin);
  const fallback: Record<string, unknown> = {};
  switch (current.id) {
    case 'overview':
      fallback['/api/gate?history=true'] = getGateStatus(true);
      break;
    case 'schedules':
      fallback['/api/schedules'] = getSchedules();
      break;
    case 'access':
      fallback['/api/users'] = getUsers();
      break;
  }

  return (
    <SWRConfig
      value={{
        fallback,
      }}
    >
      <Dashboard
        username={user.username}
        isAdmin={isAdmin}
        view={view}
        diagnostics={current.id === 'system' ? <DiagnosticsPanel /> : null}
      />
    </SWRConfig>
  );
}
