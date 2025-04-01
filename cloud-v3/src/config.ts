// This file contains the configuration for the application.
// Environment variables can override settings and secrets in this file.

export const config: {
  controllerTimezone: string;
  dbPath: string;
  redis: {
    host: string;
    port: number;
  };
  build_info: unknown;
} = {
  // The timezone of the controller.
  controllerTimezone: process.env.NEXT_PUBLIC_CONTROLLER_TIMEZONE || "UTC",
  // The path to the SQLite database file.
  dbPath: process.env.DB_PATH || "data/gate.db",
  // The Redis connection configuration.
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  },
  // The build information injected by the image builder:
  // https://github.com/docker/metadata-action/blob/902fa8ec7d6ecbf8d84d538b9b233a880e428804/README.md?plain=1#L336-L339
  build_info: JSON.parse(process.env.DOCKER_METADATA_OUTPUT_JSON || "{}"),
} as const;

export const secrets: {
  initialAdminCredentials: {
    username: string;
    password: string;
  };
} = {
  // The initial admin user that will be created when the database is empty.
  initialAdminCredentials: JSON.parse(process.env.INITIAL_ADMIN_CREDENTIALS || '{"username":"admin","password":"replace_me"}'),
} as const;
