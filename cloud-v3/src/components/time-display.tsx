'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export function TimeDisplay({
  timestamp,
  format,
  className,
}: {
  timestamp: number;
  format: string;
  className?: string;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (format !== 'relative') return;
    const timer = setInterval(() => setTick((tick) => tick + 1), 60_000);
    return () => clearInterval(timer);
  }, [format]);

  const date = new Date(timestamp);
  if (format === 'relative') {
    return (
      <time dateTime={date.toISOString()} className={className}>
        {formatDistanceToNow(date, { addSuffix: true })}
      </time>
    );
  }
  const absoluteTime = formatInTimeZone(
    date,
    format,
    'yyyy-MM-dd HH:mm:ss zzz',
  );

  return (
    <time
      dateTime={date.toISOString()}
      title={absoluteTime}
      className={className}
    >
      {absoluteTime}
    </time>
  );
}
