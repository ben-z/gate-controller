import type { ReactNode } from 'react';

type DiagnosticItem = readonly [label: string, value: ReactNode];

export function DiagnosticGrid({
  items,
}: {
  items: readonly DiagnosticItem[];
}) {
  return (
    <dl className="diagnostic-grid">
      {items.map(([label, value]) => (
        <div key={label} className="diagnostic-item">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
