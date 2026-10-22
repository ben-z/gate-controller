import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { UnrecoverableError } from "bullmq";
import type { Schedule } from "../../src/types/schedule";

const timezone = "America/Los_Angeles";
const schedule: Schedule = {
  name: "morning arrival",
  cron_expression: "30 7 * * *",
  action: "open",
  enabled: true,
};
type TestJob = {
  data: { scheduleName: string; action: "open" | "close" };
  opts: {
    timestamp: number;
    delay: number;
    repeat?: { pattern?: string; tz?: string };
  };
  timestamp: number;
  delay: number;
};
type GateWrite = [action: "open" | "close", actor: "schedule", name: string];
type Processor = (job: TestJob) => Promise<void>;

function scheduledJob(): TestJob {
  return {
    data: { scheduleName: schedule.name, action: schedule.action },
    opts: {
      timestamp: Date.parse("2027-01-04T15:29:00.000Z") - 6,
      delay: 60_000,
      repeat: { pattern: schedule.cron_expression, tz: timezone },
    },
    timestamp: Date.parse("2027-01-04T15:29:00.000Z"),
    delay: 60_000,
  };
}

async function loadScheduler(
  readSchedule: () => Schedule | null,
  writeGate: (...args: GateWrite) => void,
  delayedJobs: TestJob[],
) {
  let processor: Processor | undefined;
  const fixture = {
    exports: {} as {
      getUpcomingSchedules: (
        schedules: Schedule[],
      ) => Promise<Array<{ schedule: Schedule; nextExecution: Date }>>;
    },
  };
  const source = ts.transpileModule(
    readFileSync(path.resolve("src/lib/scheduler.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(
    source,
    {
      module: fixture,
      exports: fixture.exports,
      console: { log() {}, error: console.error },
      require(name: string) {
        if (name === "@/config")
          return {
            config: {
              controllerTimezone: timezone,
              redis: { host: "127.0.0.1", port: 1 },
            },
          };
        if (name === "./db")
          return { getSchedule: readSchedule, updateGateStatus: writeGate };
        if (name === "@/lib/cron") return {};
        if (name === "bullmq")
          return {
            UnrecoverableError,
            Queue: class {
              constructor(public name: string) {}
              async getDelayed() {
                return delayedJobs;
              }
            },
            Worker: class {
              constructor(_name: string, callback: Processor) {
                processor = callback;
              }
            },
            QueueEvents: class {
              on() {}
            },
          };
        throw new Error(`Unexpected scheduler dependency: ${name}`);
      },
    },
    { filename: "scheduler-under-test.cjs" },
  );
  await fixture.exports.getUpcomingSchedules([]);
  if (!processor)
    throw new Error("The production scheduler did not register its worker");
  const processJob = processor;
  return {
    process: (job: TestJob) => Promise.resolve(processJob(job)),
    upcoming: (schedules: Schedule[]) =>
      Promise.resolve(fixture.exports.getUpcomingSchedules(schedules)),
  };
}

test("matching scheduled job writes the requested action once", async () => {
  const writes: GateWrite[] = [];
  const runtime = await loadScheduler(
    () => schedule,
    (...args) => writes.push(args),
    [],
  );
  await runtime.process(scheduledJob());
  expect(writes).toEqual([["open", "schedule", schedule.name]]);
});

const rejectedJobs: Array<{
  name: string;
  current: Schedule | null;
  change: (job: TestJob) => void;
}> = [
  { name: "deleted schedule", current: null, change() {} },
  {
    name: "disabled schedule",
    current: { ...schedule, enabled: false },
    change() {},
  },
  {
    name: "changed action",
    current: { ...schedule, action: "close" },
    change() {},
  },
  {
    name: "changed cron",
    current: { ...schedule, cron_expression: "0 8 * * *" },
    change() {},
  },
  {
    name: "changed timezone",
    current: schedule,
    change(job) {
      job.opts.repeat!.tz = "UTC";
    },
  },
  {
    name: "missing repeat metadata",
    current: schedule,
    change(job) {
      delete job.opts.repeat;
    },
  },
  {
    name: "missing cron metadata",
    current: schedule,
    change(job) {
      delete job.opts.repeat!.pattern;
    },
  },
  {
    name: "missing timezone metadata",
    current: schedule,
    change(job) {
      delete job.opts.repeat!.tz;
    },
  },
];

for (const scenario of rejectedJobs) {
  test(`worker permanently rejects ${scenario.name} without a gate write`, async () => {
    const writes: GateWrite[] = [];
    const runtime = await loadScheduler(
      () => scenario.current,
      (...args) => writes.push(args),
      [],
    );
    const job = scheduledJob();
    scenario.change(job);
    await expect(runtime.process(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(writes).toEqual([]);
  });
}

for (const failureAt of ["read", "write"] as const) {
  test(`worker preserves transient database ${failureAt} errors for BullMQ retry`, async () => {
    const failure = new Error("SQLITE_BUSY");
    const writes: GateWrite[] = [];
    const runtime = await loadScheduler(
      () => {
        if (failureAt === "read") throw failure;
        return schedule;
      },
      (...args) => {
        if (failureAt === "write") throw failure;
        writes.push(args);
      },
      [],
    );
    await expect(runtime.process(scheduledJob())).rejects.toBe(failure);
    expect(writes).toEqual([]);
  });
}

test("upcoming time uses current job timestamp and delay", async () => {
  const runtime = await loadScheduler(
    () => schedule,
    () => {
      throw new Error("Upcoming lookup must not write the gate");
    },
    [scheduledJob()],
  );
  const upcoming = await runtime.upcoming([schedule]);
  expect(upcoming).toHaveLength(1);
  expect(upcoming[0].nextExecution.toISOString()).toBe(
    "2027-01-04T15:30:00.000Z",
  );
});

for (const scenario of rejectedJobs.filter((item) => item.current?.enabled)) {
  test(`upcoming rejects ${scenario.name} instead of displaying a stale execution`, async () => {
    const job = scheduledJob();
    scenario.change(job);
    const runtime = await loadScheduler(
      () => scenario.current,
      () => {
        throw new Error("Upcoming lookup must not write the gate");
      },
      [job],
    );
    await expect(runtime.upcoming([scenario.current!])).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });
}

test("upcoming excludes queued jobs for deleted or disabled schedules", async () => {
  const runtime = await loadScheduler(
    () => null,
    () => {
      throw new Error("Upcoming lookup must not write the gate");
    },
    [scheduledJob()],
  );
  expect(await runtime.upcoming([])).toEqual([]);
  expect(await runtime.upcoming([{ ...schedule, enabled: false }])).toEqual([]);
});
