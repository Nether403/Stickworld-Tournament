import type { StickworldGame } from '@stickworld/sim-core';
import { balanceBikeBlitzManifest } from './manifest.js';
import { createBikeSimulation } from './simulation/index.js';

export const balanceBikeBlitzGame: StickworldGame = {
  manifest: balanceBikeBlitzManifest,
  createSimulation: createBikeSimulation,
};

export { balanceBikeBlitzManifest, createBikeSimulation };
export type { BikeRenderState } from './simulation/index.js';
export {
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
  type AttemptResult,
} from './run.js';
