import { initializeSchedules } from './services/schedule';

export function register() {
  // Only run in Node.js runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('Initializing server...');
    initializeSchedules();
  }
} 