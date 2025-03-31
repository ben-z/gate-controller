'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * Time display format options:
 * - relative: Shows time relative to now (e.g., "2 minutes ago")
 * - controller: Shows time in controller's timezone
 */
export type TimeFormat = 'relative' | 'controller';

/**
 * Displays a timestamp in various formats.
 */
export function TimeDisplay({ 
  timestamp, 
  format, 
  className = "" 
}: { 
  timestamp: number; // Unix timestamp in milliseconds
  format: 'relative' | string; // 'relative' or timezone string
  className?: string;
}) {
  const [, forceUpdate] = useState({});

  // Update the relative time display every minute
  useEffect(() => {
    const timer = setInterval(() => forceUpdate({}), 60000);
    return () => clearInterval(timer);
  }, []);

  // Create Date object from Unix timestamp
  const date = new Date(timestamp);
  
  // Ensure the timestamp is valid
  if (isNaN(date.getTime())) {
    console.error('Invalid timestamp:', timestamp);
    return <span className={className}>invalid time</span>;
  }

  // Format relative time
  const relativeTime = formatDistanceToNow(date, { 
    addSuffix: true,
    includeSeconds: true  // Show more precise times for recent events
  });
  
  // Format time using specified timezone
  const formatStr = 'yyyy-MM-dd HH:mm:ss zzz';
  const zonedTime = formatInTimeZone(date, format === 'relative' ? 'UTC' : format, formatStr);

  const displayTime = format === 'relative' ? relativeTime : zonedTime;

  return (
    <span title={zonedTime} className={className}>
      {displayTime}
    </span>
  );
} 