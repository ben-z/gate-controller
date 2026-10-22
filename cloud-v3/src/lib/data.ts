import { getGateStatus, getSchedules, getUsers } from './db';
import { getUpcomingSchedules } from './scheduler';

export async function getInitialData(includeUsers: boolean) {
  const [gateStatus, schedules, users] = await Promise.all([
    getGateStatus(true),
    getSchedules(),
    includeUsers ? getUsers() : [],
  ]);

  const upcomingSchedules = await getUpcomingSchedules(schedules);

  return {
    gateStatus,
    schedules,
    users,
    upcomingSchedules,
  };
}
