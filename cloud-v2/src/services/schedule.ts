import cron from 'cron';
import { updateGateStatus } from './gate';
import { config } from '@/config';
import * as db from './db';

export interface Schedule {
  id: string;
  name: string;
  cronExpression: string;
  action: 'open' | 'closed';
  enabled: boolean;
}

// Map to store cron jobs
const cronJobs = new Map<string, cron.CronJob>();

/**
 * Initializes all enabled schedules from the database
 */
export function initializeSchedules(): void {
  const schedules = getSchedules();
  console.log(`Initializing ${schedules.length} schedules...`);
  
  for (const schedule of schedules) {
    if (schedule.enabled) {
      console.log(`Starting schedule: ${schedule.name}`);
      startSchedule(schedule);
    }
  }
}

/**
 * Validates a cron expression
 */
function validateCronExpression(expression: string): boolean {
  try {
    // Create a test job with a dummy function
    const job = new cron.CronJob(expression, () => {}, null, true, config.controllerTimezone);
    // If we get here, the expression is valid
    job.stop();
    return true;
  } catch (error) {
    console.error('Invalid cron expression:', error);
    return false;
  }
}

/**
 * Gets the next execution time for a cron expression
 */
function getNextExecutionTime(expression: string): Date {
  try {
    const job = new cron.CronJob(expression, () => {}, null, true, config.controllerTimezone);
    const nextDate = job.nextDate();
    job.stop();
    return new Date(nextDate.valueOf());
  } catch (error) {
    console.error('Error getting next execution time:', error);
    throw new Error(`Invalid cron expression: ${expression}`);
  }
}

/**
 * Creates a new schedule
 */
export function createSchedule(schedule: Omit<Schedule, 'id'>): Schedule {
  if (!validateCronExpression(schedule.cronExpression)) {
    throw new Error(`Invalid cron expression: ${schedule.cronExpression}`);
  }

  const newSchedule = db.createSchedule(schedule);
  
  if (newSchedule.enabled) {
    startSchedule(newSchedule);
  }

  return newSchedule;
}

/**
 * Updates an existing schedule
 */
export function updateSchedule(id: string, updates: Partial<Omit<Schedule, 'id'>>): Schedule {
  if (updates.cronExpression && !validateCronExpression(updates.cronExpression)) {
    throw new Error(`Invalid cron expression: ${updates.cronExpression}`);
  }

  // Stop existing job if it exists
  stopSchedule(id);

  const updatedSchedule = db.updateSchedule(id, updates);

  if (updatedSchedule.enabled) {
    startSchedule(updatedSchedule);
  }

  return updatedSchedule;
}

/**
 * Deletes a schedule
 */
export function deleteSchedule(id: string): void {
  stopSchedule(id);
  db.deleteSchedule(id);
}

/**
 * Gets all schedules
 */
export function getSchedules(): Schedule[] {
  return db.getSchedules();
}

/**
 * Gets upcoming schedule executions
 */
export function getUpcomingExecutions(limit: number = 5): Array<{ schedule: Schedule; nextExecution: Date }> {
  const now = new Date();
  const upcoming = getSchedules()
    .filter(s => s.enabled)
    .map(schedule => ({
      schedule,
      nextExecution: getNextExecutionTime(schedule.cronExpression)
    }))
    .filter(({ nextExecution }) => nextExecution.getTime() > now.getTime())
    .sort((a, b) => a.nextExecution.getTime() - b.nextExecution.getTime());

  return upcoming.slice(0, limit);
}

/**
 * Starts a schedule's cron job
 */
function startSchedule(schedule: Schedule): void {
  // Stop existing job if it exists
  stopSchedule(schedule.id);

  // Create new cron job
  const job = new cron.CronJob(
    schedule.cronExpression,
    async () => {
      try {
        await updateGateStatus(schedule.action, false, 'schedule');
        console.log(`Executed scheduled action: ${schedule.name} (${schedule.action})`);
      } catch (error) {
        console.error(`Failed to execute scheduled action: ${schedule.name}`, error);
      }
    },
    null, // onComplete
    true, // start
    config.controllerTimezone // timeZone
  );

  cronJobs.set(schedule.id, job);
}

/**
 * Stops a schedule's cron job
 */
function stopSchedule(id: string): void {
  const job = cronJobs.get(id);
  if (job) {
    job.stop();
    cronJobs.delete(id);
  }
}

/**
 * Stops all cron jobs
 */
export function stopAllSchedules(): void {
  for (const [id] of cronJobs) {
    stopSchedule(id);
  }
} 