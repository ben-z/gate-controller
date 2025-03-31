export const config: {
  controllerTimezone: string;
  apiBaseUrl: string;
  dbPath: string;
  adminCredentials: {
    username: string;
    password: string;
  };
} = {
  controllerTimezone: process.env.NEXT_PUBLIC_CONTROLLER_TIMEZONE || 'UTC',
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  dbPath: process.env.DB_PATH || 'data/gate.db',
  adminCredentials: JSON.parse(process.env.ADMIN_CREDENTIALS || '{"username":"admin","password":"replace_me"}'),
} as const; 