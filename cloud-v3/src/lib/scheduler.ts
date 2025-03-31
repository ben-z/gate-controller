import { CronJob } from 'cron';
import { Schedule } from '@/types/schedule';
import { getSchedule, updateGateStatus } from './db';
import { config } from '@/config';

// Map to store active cron jobs
const cronJobs = new Map<string, CronJob>();

/**
 * Validates a cron expression
 */
export function validateCronExpression(expression: string): boolean {
  try {
    // Create a test job with a dummy function
    const job = new CronJob(expression, () => {}, null, true);
    // If we get here, the expression is valid
    job.stop();
    return true;
  } catch (error) {
    console.error('Invalid cron expression:', error);
    return false;
  }
}

/**
 * Starts a schedule's cron job
 */
export function startSchedule(schedule: Schedule): void {
  // Stop any existing job for this schedule
  if (cronJobs.has(schedule.name)) {
    stopSchedule(schedule.name);
  }

  const job = new CronJob(
    schedule.cron_expression,
    () => {
      // Back up solution to stop the job, in case the cron job didn't get stopped in stopSchedule.
      // This happens in development, when we start the server. The cronJobs variable seems to be dfferent
      // during initialization and when stopSchedule is called.
      console.log(`Executing schedule: "${schedule.name}"`);
      const s = getSchedule(schedule.name);
      if (!s) {
        console.error(`Schedule "${schedule.name}" not found in database. Stopping schedule.`);
        job.stop();
        return;
      }
      updateGateStatus(s.action, "schedule", s.name);
    },
    null, // onComplete
    true, // start
    config.controllerTimezone // timezone
  );

  cronJobs.set(schedule.name, job);
}

/**
 * Stops a schedule's cron job
 */
export function stopSchedule(name: string): void {
  const job = cronJobs.get(name);
  console.log(`Stopping schedule: "${name}". Found job: ${!!job}. Total number of cron jobs: ${cronJobs.size}`);
  if (job) {
    job.stop();
    cronJobs.delete(name);
  }
}

/**
 * Initializes all enabled schedules from the database
 */
export function initializeSchedules(schedules: Schedule[]): void {
  console.log(`Initializing ${schedules.length} schedules...`);
  
  schedules.forEach(schedule => {
    if (schedule.enabled) {
      console.log(`Starting schedule: ${schedule.name}`);
      startSchedule(schedule);
    }
  });
}

/**
 * Updates a schedule's cron job
 */
export function updateSchedule(schedule: Schedule): void {
  if (schedule.enabled) {
    startSchedule(schedule);
  } else {
    stopSchedule(schedule.name);
  }
}

/**
 * Stops all cron jobs
 */
export function stopAllSchedules(): void {
  for (const [name, job] of cronJobs.entries()) {
    console.log(`Stopping schedule: ${name}`);
    job.stop();
    cronJobs.delete(name);
  }
}

/**
 * Gets the next execution time for a cron expression
 */
export function getNextExecutionTime(expression: string): Date | null {
  try {
    const job = new CronJob(expression, () => {}, null, true, config.controllerTimezone);
    const nextDate = job.nextDate();
    job.stop();
    return nextDate.toJSDate();
  } catch (error) {
    console.error('Error getting next execution time:', error);
    return null;
  }
}

/**
 * Gets upcoming schedule executions
 */
export function getUpcomingSchedules(schedules: Schedule[], count: number = 5): Array<{ schedule: Schedule; nextExecution: Date }> {
  const now = new Date();
  const upcoming = schedules
    .filter(schedule => schedule.enabled)
    .map(schedule => ({
      schedule,
      nextExecution: getNextExecutionTime(schedule.cron_expression)
    }))
    .filter((item): item is { schedule: Schedule; nextExecution: Date } => 
      item.nextExecution !== null && item.nextExecution > now
    )
    .sort((a, b) => a.nextExecution.getTime() - b.nextExecution.getTime())
    .slice(0, count);

  return upcoming;
} 