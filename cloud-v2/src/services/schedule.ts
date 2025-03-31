import { CronJob } from 'cron';
import { updateGateStatus } from './gate';
import { config } from '@/config';
import * as db from './db';

export interface Schedule {
  id: number;
  name: string;
  cronExpression: string;
  action: 'open' | 'close';
  enabled: boolean;
  created_by?: number;
}

// Map to store active cron jobs
const cronJobs = new Map<string, CronJob>();

/**
 * Initializes all enabled schedules from the database
 */
export function initializeSchedules(): void {
  const schedules = db.getSchedules();
  console.log(`Initializing ${schedules.length} schedules...`);
  
  schedules.forEach(schedule => {
    if (schedule.enabled) {
      console.log(`Starting schedule: ${schedule.name}`);
      startSchedule(schedule);
    }
  });
}

/**
 * Validates a cron expression
 */
function validateCronExpression(expression: string): boolean {
  try {
    // Create a test job with a dummy function
    const job = new CronJob(expression, () => {}, null, true, config.controllerTimezone);
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
    const job = new CronJob(expression, () => {}, null, true, config.controllerTimezone);
    const nextDate = job.nextDate();
    job.stop();
    return new Date(nextDate.valueOf());
  } catch (error) {
    console.error('Error getting next execution time:', error);
    throw new Error(`Invalid cron expression: ${expression}`);
  }
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
  stopSchedule(schedule.id.toString());

  // Create new cron job
  const job = new CronJob(
    schedule.cronExpression,
    () => {
      updateGateStatus(schedule.action, false, 'schedule');
    },
    null,
    true,
    config.controllerTimezone
  );

  cronJobs.set(schedule.id.toString(), job);
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

/**
 * Gets a specific schedule
 */
export function getSchedule(id: number): Schedule | null {
  return db.getSchedule(id);
}

/**
 * Creates a new schedule
 */
export function createSchedule(schedule: Omit<Schedule, 'id'>, userId: number): Schedule {
  if (!validateCronExpression(schedule.cronExpression)) {
    throw new Error(`Invalid cron expression: ${schedule.cronExpression}`);
  }

  const newSchedule = db.createSchedule({ ...schedule, created_by: userId });
  
  if (newSchedule.enabled) {
    startSchedule(newSchedule);
  }

  return newSchedule;
}

/**
 * Updates an existing schedule
 */
export function updateSchedule(id: number, updates: Partial<Omit<Schedule, 'id'>>): Schedule {
  if (updates.cronExpression && !validateCronExpression(updates.cronExpression)) {
    throw new Error(`Invalid cron expression: ${updates.cronExpression}`);
  }

  // Stop existing job if it exists
  stopSchedule(id.toString());

  const updatedSchedule = db.updateSchedule(id, updates);

  // Handle cron job if enabled status changed
  if (updates.enabled !== undefined) {
    if (updates.enabled) {
      startSchedule(updatedSchedule);
    } else {
      stopSchedule(updatedSchedule.id.toString());
    }
  }
  // Handle cron job if schedule parameters changed
  else if (updates.cronExpression || updates.action) {
    if (updatedSchedule.enabled) {
      startSchedule(updatedSchedule);
    }
  }

  return updatedSchedule;
}

/**
 * Deletes a schedule
 */
export function deleteSchedule(id: number): void {
  stopSchedule(id.toString());
  db.deleteSchedule(id);
} 