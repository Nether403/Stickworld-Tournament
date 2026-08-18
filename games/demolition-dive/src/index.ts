import type { StickworldGame } from '@stickworld/sim-core';
import { demolitionDiveManifest } from './manifest.js';
import { createDemolitionSimulation } from './simulation/index.js';

export const demolitionDiveGame: StickworldGame = {
  manifest: demolitionDiveManifest,
  createSimulation: createDemolitionSimulation,
};

export { demolitionDiveManifest, createDemolitionSimulation };
export type { DemolitionRenderState, BrickView } from './simulation/index.js';
export {
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
  type AttemptResult,
} from './run.js';
