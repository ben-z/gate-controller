import { GateController } from '@/components/gate-controller';

interface HistoryEntry {
  action: 'open' | 'closed';
  timestamp: string;
}

async function getInitialData() {
  // Since this is a server component, we can directly access the server state
  // In a real app, this would be a database query
  const response = await fetch('http://localhost:53431/api/gate?includeHistory=true');
  const data = await response.json();
  return data;
}

export default async function Home() {
  const initialData = await getInitialData();

  return (
    <div className="flex flex-col min-h-screen p-4 font-[family-name:var(--font-geist-sans)] safe-top safe-bottom bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <main className="flex flex-col items-center gap-12 flex-1">
        <h1 className="text-3xl font-bold">Gate Controller</h1>
        <GateController initialData={initialData} />
      </main>
    </div>
  );
}
