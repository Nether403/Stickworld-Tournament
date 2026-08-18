import type { StickworldGame } from '@stickworld/sim-core';
import { hooklineSprintManifest } from './manifest.js';
import { createHooklineSimulation } from './simulation/index.js';

export const hooklineSprintGame: StickworldGame = {
  manifest: hooklineSprintManifest,
  createSimulation: createHooklineSimulation,
};

export { hooklineSprintManifest, createHooklineSimulation };
export type { HooklineRenderState } from './simulation/index.js';
export {
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
  type AttemptResult,
} from './run.js';
