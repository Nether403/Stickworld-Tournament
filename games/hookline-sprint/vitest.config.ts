import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@stickworld/sim-core': fileURLToPath(
        new URL('../../packages/sim-core/src/index.ts', import.meta.url),
      ),
      '@stickworld/replay': fileURLToPath(
        new URL('../../packages/replay/src/index.ts', import.meta.url),
      ),
      '@stickworld/game-test-chamber': fileURLToPath(
        new URL('../../packages/game-test-chamber/src/index.ts', import.meta.url),
      ),
      '@stickworld/game-test-chamber/contract-suite': fileURLToPath(
        new URL('../../packages/game-test-chamber/src/contract-suite.ts', import.meta.url),
      ),
      '@stickworld/physics-kit': fileURLToPath(
        new URL('../../packages/physics-kit/src/index.ts', import.meta.url),
      ),
      '@stickworld/scoring': fileURLToPath(
        new URL('../../packages/scoring/src/index.ts', import.meta.url),
      ),
      '@stickworld/input': fileURLToPath(
        new URL('../../packages/input/src/index.ts', import.meta.url),
      ),
    },
  },
});
