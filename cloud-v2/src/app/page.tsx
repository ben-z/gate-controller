'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [gateStatus, setGateStatus] = useState('closed');
  const [isLoading, setIsLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/gate');
      const data = await response.json();
      setGateStatus(data.status);
    } catch (error) {
      console.error('Error fetching gate status:', error);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll for status updates every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateGateStatus = async (newStatus: 'open' | 'closed') => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/gate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await response.json();
      setGateStatus(data.status);
    } catch (error) {
      console.error('Error updating gate status:', error);
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 font-[family-name:var(--font-geist-sans)] safe-top safe-bottom">
      <main className="flex flex-col items-center gap-12">
        <h1 className="text-3xl font-bold">Gate Controller</h1>
        
        <div className="text-xl">
          Current Status: <span className={`font-bold ${gateStatus === 'open' ? 'text-green-600' : 'text-red-600'}`}>
            {gateStatus.toUpperCase()}
          </span>
        </div>

        <div className="flex flex-col gap-8 sm:flex-row sm:gap-4">
          <button
            onClick={() => updateGateStatus('open')}
            disabled={isLoading || gateStatus === 'open'}
            className={`w-36 h-36 text-lg rounded-2xl text-white font-bold transition-transform active:scale-95 ${
              isLoading || gateStatus === 'open'
                ? 'bg-gray-400'
                : 'bg-green-600 active:bg-green-700'
            }`}
          >
            Open Gate
          </button>

          <button
            onClick={() => updateGateStatus('closed')}
            disabled={isLoading || gateStatus === 'closed'}
            className={`w-36 h-36 text-lg rounded-2xl text-white font-bold transition-transform active:scale-95 ${
              isLoading || gateStatus === 'closed'
                ? 'bg-gray-400'
                : 'bg-red-600 active:bg-red-700'
            }`}
          >
            Close Gate
          </button>
        </div>

        <div className="h-6 mt-4 text-gray-600">
          {isLoading && "Updating gate status..."}
        </div>
      </main>
    </div>
  );
}
