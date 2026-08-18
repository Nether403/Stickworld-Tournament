import { initRapier, Prng } from '@stickworld/sim-core';
import {
  ragdollArcheryRushGame,
  runAttempt,
  SAMPLE_INPUTS,
  SAMPLE_SEED,
  SAMPLE_TICKS,
} from '../src/index.js';

type HarnessWindow = Window & {
  __STICKWORLD_ARCHERY__: () => Promise<unknown>;
};

(window as HarnessWindow).__STICKWORLD_ARCHERY__ = async () => {
  const rapier = await initRapier();
  return runAttempt(
    ragdollArcheryRushGame,
    { seed: SAMPLE_SEED, rapier, prng: new Prng(SAMPLE_SEED) },
    SAMPLE_INPUTS,
    SAMPLE_TICKS,
  );
};
