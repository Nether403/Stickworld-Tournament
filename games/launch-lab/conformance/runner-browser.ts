import { initRapier, Prng } from '@stickworld/sim-core';
import {
  launchLabGame,
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
} from '../src/index.js';

type HarnessWindow = Window & {
  __STICKWORLD_LAUNCH_LAB__: () => Promise<unknown>;
};

(window as HarnessWindow).__STICKWORLD_LAUNCH_LAB__ = async () => {
  const rapier = await initRapier();
  return runAttempt(
    launchLabGame,
    { seed: SAMPLE_SEED, rapier, prng: new Prng(SAMPLE_SEED) },
    SAMPLE_INPUTS,
    SAMPLE_TICKS,
  );
};
