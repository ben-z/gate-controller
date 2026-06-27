type DiagnosticItem = readonly [label: string, value: string];

export function DiagnosticGrid({ items }: { items: readonly DiagnosticItem[] }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="border-t border-gray-200 pt-3 dark:border-gray-700"
        >
          <dt className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
            {label}
          </dt>
          <dd className="mt-1 font-mono text-gray-900 dark:text-gray-100">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
