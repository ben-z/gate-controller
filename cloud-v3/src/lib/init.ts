import { getSchedules } from './db';
import { initializeSchedules } from './scheduler';

export async function initializeApp() {
  // Initialize all enabled schedules
  const schedules = getSchedules();
  await initializeSchedules(schedules);
}
