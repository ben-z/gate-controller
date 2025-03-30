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
    <div className="flex flex-col items-center justify-center min-h-screen p-8 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col items-center gap-8">
        <h1 className="text-4xl font-bold mb-8">Gate Controller</h1>
        
        <div className="text-xl mb-4">
          Current Status: <span className={`font-bold ${gateStatus === 'open' ? 'text-green-600' : 'text-red-600'}`}>
            {gateStatus.toUpperCase()}
          </span>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => updateGateStatus('open')}
            disabled={isLoading || gateStatus === 'open'}
            className={`px-6 py-3 rounded-lg text-white font-bold ${
              isLoading || gateStatus === 'open'
                ? 'bg-gray-400'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            Open Gate
          </button>

          <button
            onClick={() => updateGateStatus('closed')}
            disabled={isLoading || gateStatus === 'closed'}
            className={`px-6 py-3 rounded-lg text-white font-bold ${
              isLoading || gateStatus === 'closed'
                ? 'bg-gray-400'
                : 'bg-red-600 hover:bg-red-700'
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
