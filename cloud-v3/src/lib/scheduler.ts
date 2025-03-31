import { CronJob } from 'cron';
import { Schedule } from '@/types/schedule';
import { updateGateStatus } from './db';
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
  // Stop existing job if it exists
  stopSchedule(schedule.id.toString());

  // Create new cron job
  const job = new CronJob(
    schedule.cron_expression,
    () => {
      console.log(`Executing schedule: ${schedule.name}`);
      updateGateStatus(schedule.action, 'schedule', schedule.name);
    },
    null, // onComplete
    true, // start
    config.controllerTimezone // timezone
  );

  cronJobs.set(schedule.id.toString(), job);
}

/**
 * Stops a schedule's cron job
 */
export function stopSchedule(id: string): void {
  const job = cronJobs.get(id);
  if (job) {
    job.stop();
    cronJobs.delete(id);
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
    stopSchedule(schedule.id.toString());
  }
}

/**
 * Stops all cron jobs
 */
export function stopAllSchedules(): void {
  cronJobs.forEach((job, id) => {
    console.log(`Stopping schedule: ${id}`);
    job.stop();
  });
  cronJobs.clear();
} 