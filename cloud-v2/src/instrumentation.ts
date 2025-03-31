
export async function register() {
  // Only run in Node.js runtime. Otherwise, we get edge runtime errors.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeSchedules } = await import('./services/schedule');

    console.log('Initializing server...');
    initializeSchedules();
  }
} 