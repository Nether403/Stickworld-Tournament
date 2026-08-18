import type { StickworldGame } from '@stickworld/sim-core';
import { ragdollArcheryRushManifest } from './manifest.js';
import { createArcherySimulation } from './simulation/index.js';

export const ragdollArcheryRushGame: StickworldGame = {
  manifest: ragdollArcheryRushManifest,
  createSimulation: createArcherySimulation,
};

export { ragdollArcheryRushManifest, createArcherySimulation };
export type { ArcheryRenderState } from './simulation/index.js';
export {
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
  type AttemptResult,
} from './run.js';
