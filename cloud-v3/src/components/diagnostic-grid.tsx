type DiagnosticItem = readonly [label: string, value: string];

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
