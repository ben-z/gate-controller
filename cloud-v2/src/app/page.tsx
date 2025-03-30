'use client';

import { useState, useEffect } from 'react';

interface HistoryEntry {
  action: 'open' | 'closed';
  timestamp: Date;
}

export default function Home() {
  const [gateStatus, setGateStatus] = useState('closed');
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

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
      // Add to history
      setHistory(prev => [
        { action: newStatus, timestamp: new Date() },
        ...prev.slice(0, 9) // Keep only last 10 entries
      ]);
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
          Current Status: <span className={`font-bold ${gateStatus === 'open' ? 'text-red-600' : 'text-green-600'}`}>
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
                : 'bg-red-600 active:bg-red-700'
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
                : 'bg-green-600 active:bg-green-700'
            }`}
          >
            Close Gate
          </button>
        </div>

        <div className="h-6 mt-4 text-gray-600">
          {isLoading && "Updating gate status..."}
        </div>

        <div className="w-full max-w-sm mt-8 border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-700">History</h2>
          </div>
          <div className="divide-y divide-gray-200 max-h-48 overflow-y-auto">
            {history.length === 0 ? (
              <div className="px-4 py-3 text-gray-500 text-center">
                No actions yet
              </div>
            ) : (
              history.map((entry, index) => (
                <div key={index} className="px-4 py-3 flex justify-between items-center bg-white">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      entry.action === 'open' ? 'bg-red-500' : 'bg-green-500'
                    }`} />
                    <span className="font-medium">
                      {entry.action === 'open' ? 'Opened' : 'Closed'}
                    </span>
                  </div>
                  <time className="text-sm text-gray-500">
                    {entry.timestamp.toLocaleTimeString()}
                  </time>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
