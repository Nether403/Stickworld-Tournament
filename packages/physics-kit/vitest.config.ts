import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@stickworld/sim-core': fileURLToPath(new URL('../sim-core/src/index.ts', import.meta.url)),
    },
  },
});
