import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@stickworld/input': fileURLToPath(new URL('../input/src/index.ts', import.meta.url)),
      '@stickworld/sim-core': fileURLToPath(new URL('../sim-core/src/index.ts', import.meta.url)),
    },
  },
});
