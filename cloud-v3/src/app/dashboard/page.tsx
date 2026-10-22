import { ensureSession } from '@/lib/auth/ensure-session';
import { Dashboard } from '@/components/dashboard';
import { DiagnosticsPanel } from '@/components/diagnostics-panel';
import { getInitialData } from '@/lib/data';
import { SWRConfig } from 'swr';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const { user } = await ensureSession();
  const isAdmin = user.role === 'admin';
  const initialData = await getInitialData(isAdmin);

  return (
    <SWRConfig
      value={{
        fallback: {
          '/api/gate?history=true': initialData.gateStatus,
          '/api/schedules': initialData.schedules,
          '/api/users': initialData.users,
          '/api/schedules/upcoming': initialData.upcomingSchedules,
        },
      }}
    >
      <Dashboard
        username={user.username}
        isAdmin={isAdmin}
        view={view}
        diagnostics={isAdmin ? <DiagnosticsPanel /> : null}
      />
    </SWRConfig>
  );
}
