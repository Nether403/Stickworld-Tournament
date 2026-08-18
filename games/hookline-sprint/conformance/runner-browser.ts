import { initRapier, Prng } from '@stickworld/sim-core';
import {
  hooklineSprintGame,
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
} from '../src/index.js';

type HarnessWindow = Window & {
  __STICKWORLD_HOOKLINE__: () => Promise<unknown>;
};

(window as HarnessWindow).__STICKWORLD_HOOKLINE__ = async () => {
  const rapier = await initRapier();
  return runAttempt(
    hooklineSprintGame,
    { seed: SAMPLE_SEED, rapier, prng: new Prng(SAMPLE_SEED) },
    SAMPLE_INPUTS,
    SAMPLE_TICKS,
  );
};
