// This file contains the configuration for the application.
// Override the default values with environment variables (.env.local)
export const config: {
  controllerTimezone: string;
  adminCredentials: {
    username: string;
    password: string;
  };
  dbPath: string;
} = {
  controllerTimezone: process.env.NEXT_PUBLIC_CONTROLLER_TIMEZONE || 'UTC',
  adminCredentials: JSON.parse(process.env.ADMIN_CREDENTIALS || '{"username":"admin","password":"replace_me"}'),
  dbPath: process.env.DB_PATH || 'data/gate.db'
} as const; 