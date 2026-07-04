type InitialAdminCredentials = {
  username: string;
  password: string;
};

function parseJsonEnv<T>(name: string, fallback: T): T {
  const raw = process.env[name];
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
}

function parsePort(value: string | undefined, fallback: number): number {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid Redis port: ${value}`);
  }
  return port;
}

export const publicConfig = {
  controllerTimezone: process.env.NEXT_PUBLIC_CONTROLLER_TIMEZONE || "UTC",
} as const;

export const config = {
  ...publicConfig,
  dbPath: process.env.DB_PATH || "data/gate.db",
  scheduleDraftModel: process.env.OPENAI_SCHEDULE_MODEL || "gpt-5.5",
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parsePort(process.env.REDIS_PORT, 6379),
  },
  buildInfo: parseJsonEnv("DOCKER_METADATA_OUTPUT_JSON", {}),
} as const;

export const secrets = {
  initialAdminCredentials: parseJsonEnv<InitialAdminCredentials>(
    "INITIAL_ADMIN_CREDENTIALS",
    { username: "admin", password: "replace_me" }
  ),
  agentToken: process.env.AGENT_TOKEN || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
} as const;
