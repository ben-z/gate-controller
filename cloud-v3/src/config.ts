export const config = {
  controllerTimezone: process.env.NEXT_PUBLIC_CONTROLLER_TIMEZONE || 'UTC',
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  dbPath: process.env.DB_PATH || 'data/gate.db',
} as const; 