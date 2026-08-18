import type { StickworldGame } from '@stickworld/sim-core';
import { launchLabManifest } from './manifest.js';
import { createLaunchLabSimulation } from './simulation/index.js';

export const launchLabGame: StickworldGame = {
  manifest: launchLabManifest,
  createSimulation: createLaunchLabSimulation,
};

export { launchLabManifest, createLaunchLabSimulation };
export type { LaunchLabRenderState } from './simulation/index.js';
export {
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
  type AttemptResult,
} from './run.js';
