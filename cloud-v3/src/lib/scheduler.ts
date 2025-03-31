import { config } from "@/config";
import { Schedule } from "@/types/schedule";
import { Queue, QueueEvents, Worker } from "bullmq";
import cronstrue from "cronstrue";
import { getSchedule, updateGateStatus } from "./db";

const REDIS_CONNECTION_CONFIG = {
  host: config.redis.host,
  port: config.redis.port,
};

// Create a queue for gate control jobs
const gateQueue = new Queue("gate-control", {
  connection: REDIS_CONNECTION_CONFIG,
});

// Create a worker to process the jobs
new Worker(
  gateQueue.name,
  async (job) => {
    console.log(`Executing schedule: ${job.data.scheduleName}`);

    // Here we fetch the schedule from the database again to be extra sure that the job is valid.
    const schedule = await getSchedule(job.data.scheduleName);
    if (!schedule) {
      throw new Error(
        `Schedule "${job.data.scheduleName}" not found, but job was scheduled.`
      );
    }
    if (schedule.action !== job.data.action) {
      throw new Error(
        `Schedule "${job.data.scheduleName}" action mismatch. Database action: ${schedule.action}, Job action: ${job.data.action}`
      );
    }
    await updateGateStatus(schedule.action, "schedule", schedule.name);
  },
  {
    connection: REDIS_CONNECTION_CONFIG,
  }
);

// Create queue events listener
const queueEvents = new QueueEvents(gateQueue.name, {
  connection: REDIS_CONNECTION_CONFIG,
});

// Log failed jobs
queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed:`, failedReason);
});

/**
 * Validates a cron expression
 */
export function validateCronExpression(expression: string): boolean {
  try {
    cronstrue.toString(expression);
    return true;
  } catch (error) {
    console.error("Invalid cron expression:", error);
    return false;
  }
}

/**
 * Starts a schedule's job
 */
export async function startSchedule(schedule: Schedule): Promise<void> {
  console.log(`Starting schedule: ${schedule.name}`);

  // Create or update the job scheduler
  await gateQueue.upsertJobScheduler(
    `schedule-${schedule.name}`,
    {
      pattern: schedule.cron_expression,
      tz: config.controllerTimezone,
    },
    {
      name: schedule.name,
      data: { scheduleName: schedule.name, action: schedule.action },
      opts: {
        removeOnComplete: true,
        removeOnFail: 1000, // Keep failed jobs for 1000ms
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    }
  );
}

/**
 * Stops a schedule's job
 */
export async function stopSchedule(name: string): Promise<void> {
  console.log(`Stopping schedule: ${name}`);
  await gateQueue.removeJobScheduler(`schedule-${name}`);
}

/**
 * Initializes all enabled schedules from the database
 */
export async function initializeSchedules(
  schedules: Schedule[]
): Promise<void> {
  console.log(`Initializing ${schedules.length} schedules...`);

  for (const schedule of schedules) {
    if (schedule.enabled) {
      await startSchedule(schedule);
    }
  }
}

/**
 * Updates a schedule's job
 */
export async function updateSchedule(schedule: Schedule): Promise<void> {
  if (schedule.enabled) {
    await startSchedule(schedule);
  } else {
    await stopSchedule(schedule.name);
  }
}

/**
 * Gets upcoming schedule executions
 */
export async function getUpcomingSchedules(
  schedules: Schedule[]
): Promise<Array<{ schedule: Schedule; nextExecution: Date }>> {
  const delayedJobs = await gateQueue.getDelayed();

  const upcoming = delayedJobs.map((job) => {
    const scheduleName = job.data.scheduleName;
    const nextExecution = job.opts.timestamp + job.opts.delay;
    const schedule = schedules.find((s) => s.name === scheduleName);

    if (!schedule) {
      throw new Error(`Schedule "${scheduleName}" not found`);
    }

    return {
      schedule,
      nextExecution,
    };
  });

  return upcoming;
}
