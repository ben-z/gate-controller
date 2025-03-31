export async function register() {
  // Only run in Node.js runtime. Otherwise, we get edge runtime errors.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeApp } = await import('./lib/init');

    console.log('Initializing server...');
    initializeApp();
  }
} 