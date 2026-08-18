import { initRapier, Prng } from '@stickworld/sim-core';
import { runAttempt, SAMPLE_INPUTS, SAMPLE_SEED, SAMPLE_TICKS, testChamberGame } from '../src/index.js';

type HarnessWindow = Window & {
  __STICKWORLD_TEST_CHAMBER__: () => Promise<unknown>;
};

(window as HarnessWindow).__STICKWORLD_TEST_CHAMBER__ = async () => {
  const rapier = await initRapier();
  return runAttempt(
    testChamberGame,
    { seed: SAMPLE_SEED, rapier, prng: new Prng(SAMPLE_SEED) },
    SAMPLE_INPUTS,
    SAMPLE_TICKS,
  );
};
