import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      '@stickworld/sim-core': fileURLToPath(new URL('../sim-core/src/index.ts', import.meta.url)),
      '@stickworld/replay': fileURLToPath(new URL('../replay/src/index.ts', import.meta.url)),
      '@stickworld/input': fileURLToPath(new URL('../input/src/index.ts', import.meta.url)),
      '@stickworld/telemetry': fileURLToPath(new URL('../telemetry/src/index.ts', import.meta.url)),
    },
  },
});
