import { initializeSchedules } from './services/schedule';

export function register() {
  console.log('Initializing server...');
  initializeSchedules();
} 