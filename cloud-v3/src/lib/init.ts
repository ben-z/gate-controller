import { getSchedules } from './db';
import { initializeSchedules } from './scheduler';

export function initializeApp() {
  // Initialize all enabled schedules
  const schedules = getSchedules();
  initializeSchedules(schedules);
} 