import type { StickworldGame } from '@stickworld/sim-core';
import { pogoTowerManifest } from './manifest.js';
import { createPogoSimulation } from './simulation/index.js';

export const pogoTowerGame: StickworldGame = {
  manifest: pogoTowerManifest,
  createSimulation: createPogoSimulation,
};

export { pogoTowerManifest, createPogoSimulation };
export type { PogoRenderState, PogoLedgeView } from './simulation/index.js';
export { createTower, dumpTowerGeometry } from './simulation/index.js';
export {
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
  type AttemptResult,
} from './run.js';
