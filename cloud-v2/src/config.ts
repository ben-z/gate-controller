// This file contains the configuration for the application.
// Override the default values with environment variables (.env.local)
export const config = {
  controllerTimezone: process.env.NEXT_PUBLIC_CONTROLLER_TIMEZONE || 'UTC'
} as const; 