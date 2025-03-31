export const config: {
  controllerTimezone: string;
  dbPath: string;
} = {
  controllerTimezone: process.env.NEXT_PUBLIC_CONTROLLER_TIMEZONE || "UTC",
  dbPath: process.env.DB_PATH || "data/gate.db",
} as const;

export const secrets: {
  adminCredentials: {
    username: string;
    password: string;
  };
} = {
  adminCredentials: JSON.parse(process.env.ADMIN_CREDENTIALS || '{"username":"admin","password":"replace_me"}'),
} as const;
