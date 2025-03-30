import { getGateStatus } from '@/services/gate';
import { GateStatus } from '@/types/gate';
import { ClientPage } from '@/components/client-page';

export default async function Home() {
  const initialData: GateStatus = await getGateStatus(true);

  return <ClientPage initialData={initialData} />;
}
