import type { StickworldGame } from '@stickworld/sim-core';
import { cargoChaosManifest } from './manifest.js';
import { createCargoSimulation } from './simulation/index.js';

export const cargoChaosGame: StickworldGame = {
  manifest: cargoChaosManifest,
  createSimulation: createCargoSimulation,
};

export { cargoChaosManifest, createCargoSimulation };
export type { CargoRenderState } from './simulation/index.js';
export {
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
  type AttemptResult,
} from './run.js';
