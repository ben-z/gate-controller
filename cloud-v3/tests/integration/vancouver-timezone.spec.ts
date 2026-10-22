import { expect, test } from "@playwright/test";
import { defaultRepeatStrategy } from "bullmq";
import cronParser from "cron-parser";
import cronstrue from "cronstrue";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const timezone = "America/Vancouver";
const expression = "0 10 * * 6";
const source = ts.transpileModule(
  readFileSync(path.resolve("src/lib/cron.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  },
).outputText;

function previewAt(currentDate: string, count: number): string[] {
  const fixture = {
    exports: {} as {
      getNextCronExecutions: (
        expression: string,
        timezone: string,
        count: number,
      ) => string[];
    },
  };
  vm.runInNewContext(source, {
    module: fixture,
    exports: fixture.exports,
    Date: class extends Date {
      constructor() {
        super(currentDate);
      }
    },
    require(name: string) {
      if (name === "cron-parser") return cronParser;
      if (name === "cronstrue") return cronstrue;
      throw new Error(`Unexpected cron dependency: ${name}`);
    },
  });
  return fixture.exports.getNextCronExecutions(expression, timezone, count);
}

const cases = [
  {
    name: "Vancouver Saturday 10 AM stays at UTC-7 after October 2026",
    currentDate: "2026-10-23T17:00:00.000Z",
    expected: [
      "2026-10-24T17:00:00.000Z",
      "2026-10-31T17:00:00.000Z",
      "2026-11-07T17:00:00.000Z",
      "2026-11-14T17:00:00.000Z",
    ],
  },
  {
    name: "Vancouver preserves its historical seasonal change before 2026",
    currentDate: "2025-10-24T17:00:00.000Z",
    expected: [
      "2025-10-25T17:00:00.000Z",
      "2025-11-01T17:00:00.000Z",
      "2025-11-08T18:00:00.000Z",
      "2025-11-15T18:00:00.000Z",
    ],
  },
];

for (const { name, currentDate, expected } of cases) {
  test(name, () => {
    expect(previewAt(currentDate, expected.length)).toEqual(expected);

    let cursor = Date.parse(currentDate);
    const queued = expected.map(() => {
      const next = defaultRepeatStrategy(cursor, { pattern: expression, tz: timezone });
      expect(next).toBeDefined();
      cursor = next!;
      return new Date(cursor).toISOString();
    });
    expect(queued).toEqual(expected);
  });
}
