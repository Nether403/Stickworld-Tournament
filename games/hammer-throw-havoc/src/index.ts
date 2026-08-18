import type { StickworldGame } from '@stickworld/sim-core';
import { hammerThrowHavocManifest } from './manifest.js';
import { createHammerSimulation } from './simulation/index.js';

export const hammerThrowHavocGame: StickworldGame = {
  manifest: hammerThrowHavocManifest,
  createSimulation: createHammerSimulation,
};

export { hammerThrowHavocManifest, createHammerSimulation };
export type { HammerRenderState } from './simulation/index.js';
export {
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
  type AttemptResult,
} from './run.js';
