import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8'
    }
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  plugins: [tsconfigPaths()],
});
