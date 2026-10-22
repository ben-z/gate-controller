'use client';

import { type ReactNode, useLayoutEffect, useState } from 'react';

export function ViewContent({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => setReady(true), []);

  return (
    <>
      {!ready && (
        <p className="field-hint" role="status">
          Loading controls…
        </p>
      )}
      <div className="view-content" inert={!ready} aria-busy={!ready}>
        {children}
      </div>
      <noscript>
        <p className="inline-alert">
          JavaScript is required to use these controls.
        </p>
      </noscript>
    </>
  );
}
