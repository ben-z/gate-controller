import { SWRConfig } from 'swr';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        refreshInterval: 0, // Disable automatic polling by default
        revalidateOnFocus: true, // Revalidate when window regains focus
        revalidateOnReconnect: true, // Revalidate when browser regains network connection
      }}
    >
      {children}
    </SWRConfig>
  );
} 