import type { StickworldGame } from '@stickworld/sim-core';
import { rooftopRelayManifest } from './manifest.js';
import { createRooftopSimulation } from './simulation/index.js';

export const rooftopRelayGame: StickworldGame = {
  manifest: rooftopRelayManifest,
  createSimulation: createRooftopSimulation,
};

export { rooftopRelayManifest, createRooftopSimulation };
export type { RooftopRenderState } from './simulation/index.js';
export {
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
  type AttemptResult,
} from './run.js';
