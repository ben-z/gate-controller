'use client';

import { useLayoutEffect, useState } from 'react';

export function useFocusAfterCommit(pending: boolean) {
  // State guarantees a DOM commit even when an asynchronous read already finished.
  const [request, setRequest] = useState<(() => void) | null>(null);

  useLayoutEffect(() => {
    if (pending || !request) return;
    setRequest(null);
    request();
  }, [pending, request]);

  return (focus: () => void) => setRequest(() => focus);
}
