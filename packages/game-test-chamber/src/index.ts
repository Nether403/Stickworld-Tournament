import type { StickworldGame } from '@stickworld/sim-core';
import { testChamberManifest } from './manifest.js';
import { createTestChamberSimulation } from './simulation/index.js';

export const testChamberGame: StickworldGame = {
  manifest: testChamberManifest,
  createSimulation: createTestChamberSimulation,
};

export { testChamberManifest, createTestChamberSimulation };
export { runAttempt, SAMPLE_INPUTS, SAMPLE_SEED, SAMPLE_TICKS, type AttemptResult } from './run.js';
