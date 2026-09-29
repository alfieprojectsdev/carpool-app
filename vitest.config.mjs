import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    environment: 'node',
    // Each file boots its own WASM Postgres.
    testTimeout: 20000,
    hookTimeout: 30000,
    maxWorkers: 2,
  },
});
