import { getGateStatus, getSchedules, getUsers } from './db';
import { getUpcomingSchedules } from './scheduler';

export async function getInitialData() {
  const [gateStatus, schedules, users] = await Promise.all([
    getGateStatus(true),
    getSchedules(),
    getUsers(),
  ]);

  const upcomingSchedules = await getUpcomingSchedules(schedules);

  return {
    gateStatus,
    schedules,
    users,
    upcomingSchedules,
  };
} 