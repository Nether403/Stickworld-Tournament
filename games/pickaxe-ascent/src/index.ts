import type { StickworldGame } from '@stickworld/sim-core';
import { pickaxeAscentManifest } from './manifest.js';
import { createPickaxeSimulation } from './simulation/index.js';

export const pickaxeAscentGame: StickworldGame = {
  manifest: pickaxeAscentManifest,
  createSimulation: createPickaxeSimulation,
};

export { pickaxeAscentManifest, createPickaxeSimulation };
export type { PickaxeRenderState } from './simulation/index.js';
export {
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
  type AttemptResult,
} from './run.js';
