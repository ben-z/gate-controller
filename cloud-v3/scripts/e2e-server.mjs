import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const port = process.env.PORT ?? "3100";
const redisPort = process.env.REDIS_PORT ?? "6380";
const dbPath = path.resolve(process.env.DB_PATH ?? `.e2e/gate-${port}.db`);
const adminCredentials =
  process.env.INITIAL_ADMIN_CREDENTIALS ??
  JSON.stringify({ username: "admin", password: "password" });
const agentToken = process.env.AGENT_TOKEN ?? "e2e-agent-token";

mkdirSync(path.dirname(dbPath), { recursive: true });
for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
  rmSync(file, { force: true });
}

const childEnv = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_PUBLIC_CONTROLLER_TIMEZONE: "UTC",
  OPENAI_API_KEY: process.env.E2E_OPENAI_API_KEY ?? "",
  OPENAI_SCHEDULE_MODEL: process.env.E2E_OPENAI_SCHEDULE_MODEL ?? "gpt-5.5",
  PORT: port,
  REDIS_HOST: "127.0.0.1",
  REDIS_PORT: redisPort,
  REDISMS_PORT: redisPort,
  DB_PATH: dbPath,
  INITIAL_ADMIN_CREDENTIALS: adminCredentials,
  AGENT_TOKEN: agentToken,
};

const children = new Set();
let shuttingDown = false;

function bin(name) {
  return path.join(
    "node_modules",
    ".bin",
    `${name}${process.platform === "win32" ? ".cmd" : ""}`
  );
}

function start(name, command, args) {
  const child = spawn(command, args, {
    env: childEnv,
    stdio: "inherit",
  });
  children.add(child);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown && code !== 0) {
      console.error(`${name} exited with ${code ?? signal}`);
      shutdown(1);
    }
  });
  return child;
}

function waitForTcp(host, portNumber, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    function attempt() {
      const socket = net.connect({ host, port: portNumber });
      socket.once("connect", () => {
        socket.destroy();
        resolve(undefined);
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${host}:${portNumber}`));
        } else {
          setTimeout(attempt, 100);
        }
      });
    }

    attempt();
  });
}

function shutdown(exitCode = 0) {
  shuttingDown = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 2_000).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("redis", bin("redis-memory-server"), []);
await waitForTcp("127.0.0.1", Number(redisPort), 20_000);
start("next", bin("next"), ["start", "-H", "127.0.0.1", "-p", port]);
