import { initRapier, Prng } from '@stickworld/sim-core';
import {
  createTower,
  dumpTowerGeometry,
  pogoTowerGame,
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
} from '../src/index.js';

type HarnessWindow = Window & {
  __STICKWORLD_POGO__: () => Promise<unknown>;
  __STICKWORLD_POGO_GEOMETRY__: () => string;
};

(window as HarnessWindow).__STICKWORLD_POGO__ = async () => {
  const rapier = await initRapier();
  return runAttempt(
    pogoTowerGame,
    { seed: SAMPLE_SEED, rapier, prng: new Prng(SAMPLE_SEED) },
    SAMPLE_INPUTS,
    SAMPLE_TICKS,
  );
};

(window as HarnessWindow).__STICKWORLD_POGO_GEOMETRY__ = () =>
  dumpTowerGeometry(createTower(new Prng(SAMPLE_SEED)));
