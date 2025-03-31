// This file contains the configuration for the application.
// Environment variables can override settings and secrets in this file.

export const config: {
  controllerTimezone: string;
  dbPath: string;
  redis: {
    host: string;
    port: number;
  };
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
} as const;

export const secrets: {
  adminCredentials: {
    username: string;
    password: string;
  };
} = {
  // The initial admin user that will be created when the database is empty.
  adminCredentials: JSON.parse(process.env.ADMIN_CREDENTIALS || '{"username":"admin","password":"replace_me"}'),
} as const;
