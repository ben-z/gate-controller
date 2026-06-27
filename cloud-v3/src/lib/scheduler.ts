import { config } from "@/config";
import { Schedule } from "@/types/schedule";
import { Queue, QueueEvents, Worker } from "bullmq";
import cronstrue from "cronstrue";
import { getSchedule, updateGateStatus } from "./db";

const REDIS_CONNECTION_CONFIG = {
  host: config.redis.host,
  port: config.redis.port,
};

type SchedulerRuntime = {
  queue: Queue;
  worker: Worker;
  queueEvents: QueueEvents;
};

const globalForScheduler = globalThis as typeof globalThis & {
  gateSchedulerRuntime?: SchedulerRuntime;
};

function getSchedulerRuntime(): SchedulerRuntime {
  if (!globalForScheduler.gateSchedulerRuntime) {
    const queue = new Queue("gate-control", {
      connection: REDIS_CONNECTION_CONFIG,
    });

    const worker = new Worker(
      queue.name,
      async (job) => {
        console.log(`Executing schedule: ${job.data.scheduleName}`);

        const schedule = getSchedule(job.data.scheduleName);
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
        updateGateStatus(schedule.action, "schedule", schedule.name);
      },
      {
        connection: REDIS_CONNECTION_CONFIG,
      }
    );

    const queueEvents = new QueueEvents(queue.name, {
      connection: REDIS_CONNECTION_CONFIG,
    });
    queueEvents.on("failed", ({ jobId, failedReason }) => {
      console.error(`Job ${jobId} failed:`, failedReason);
    });

    globalForScheduler.gateSchedulerRuntime = {
      queue,
      worker,
      queueEvents,
    };
  }

  return globalForScheduler.gateSchedulerRuntime;
}

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
  const { queue } = getSchedulerRuntime();

  // Create or update the job scheduler
  await queue.upsertJobScheduler(
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
  const { queue } = getSchedulerRuntime();
  await queue.removeJobScheduler(`schedule-${name}`);
}

/**
 * Initializes all enabled schedules from the database
 */
export async function initializeSchedules(
  schedules: Schedule[]
): Promise<void> {
  console.log(`Initializing ${schedules.length} schedules...`);

  await Promise.all(
    schedules.filter((schedule) => schedule.enabled).map(startSchedule)
  );
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
  const { queue } = getSchedulerRuntime();
  const scheduleByName = new Map(
    schedules
      .filter((schedule) => schedule.enabled)
      .map((schedule) => [schedule.name, schedule])
  );
  const delayedJobs = await queue.getDelayed();

  const upcoming = delayedJobs.flatMap((job) => {
    const scheduleName = job.data.scheduleName;
    const schedule = scheduleByName.get(scheduleName);

    if (!schedule) {
      return [];
    }

    const nextExecution = (job.opts.timestamp ?? 0) + (job.opts.delay ?? 0);
    if (!Number.isFinite(nextExecution) || nextExecution <= 0) {
      return [];
    }

    return {
      schedule,
      nextExecution: new Date(nextExecution),
    };
  });

  return upcoming.sort(
    (a, b) => a.nextExecution.getTime() - b.nextExecution.getTime()
  );
}
