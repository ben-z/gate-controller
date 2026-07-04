import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { admin, agentToken, browserJson, login } from "../helpers";

type GateStatus = {
  lastContactTimestamp: number;
  status: "closed" | "open";
};

async function gateStatus(page: Page) {
  const response = await browserJson(page, "/api/gate");
  expect(response.status).toBe(200);
  return response.body as GateStatus;
}

test("dry-run Python agent polls the cloud endpoint", async ({ page }) => {
  await login(page, admin.username, admin.password);
  const before = await gateStatus(page);

  await new Promise((resolve) => setTimeout(resolve, 20));

  const agentDir = path.resolve("..", "agent");
  const statusUrl = new URL("/api/gate/take_status", page.url()).toString();
  const result = spawnSync(process.env.PYTHON ?? "python3", ["main.py"], {
    cwd: agentDir,
    encoding: "utf8",
    env: {
      ...process.env,
      GATE_CONTROLLER_AGENT_DRY_RUN: "1",
      GATE_CONTROLLER_AGENT_RUN_ONCE: "1",
      GATE_CONTROLLER_AGENT_TOKEN: agentToken,
      GATE_CONTROLLER_STATUS_URL: statusUrl,
      PYTHONUNBUFFERED: "1",
    },
    timeout: 15_000,
  });
  const output = `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`;

  expect(result.error, output).toBeUndefined();
  expect(result.status, output).toBe(0);
  expect(output).toContain("DRY RUN");

  const after = await gateStatus(page);
  expect(after.lastContactTimestamp).toBeGreaterThan(before.lastContactTimestamp);
  expect(after.status).toBe(before.status);
});
