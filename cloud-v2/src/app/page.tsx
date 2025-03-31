import { getGateStatus } from '@/services/gate';
import { GateStatus } from '@/types/gate';
import { ClientPage } from '@/components/client-page';
import { SWRConfig } from 'swr';

export default async function Home() {
  const fallback = {
    '/api/gate?includeHistory=true': await getGateStatus(true)
  }

  return (
    <SWRConfig value={{ fallback }}>
      <ClientPage />
    </SWRConfig>
  );
}
