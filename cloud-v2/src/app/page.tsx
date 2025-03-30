import { GateController } from '@/components/gate-controller';
import { ScheduleManager } from '@/components/schedule-manager';
import { getGateStatus } from '@/services/gate';
import { GateStatus } from '@/types/gate';

export default async function Home() {
  const initialData: GateStatus = await getGateStatus(true);

  return (
    <div className="flex flex-col min-h-screen p-4 font-[family-name:var(--font-geist-sans)] safe-top safe-bottom bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <main className="flex flex-col items-center gap-12 flex-1">
        <h1 className="text-3xl font-bold">Gate Controller</h1>
        <GateController initialData={initialData} />
        <ScheduleManager />
      </main>
    </div>
  );
}
