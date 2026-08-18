import { initRapier } from '@stickworld/sim-core';
import { runMaxBodyBreakableFixture } from '../src/index.js';

type HarnessWindow = Window & {
  __STICKWORLD_MAX_BODY__: () => Promise<unknown>;
};

(window as HarnessWindow).__STICKWORLD_MAX_BODY__ = async () => {
  const rapier = await initRapier();
  return runMaxBodyBreakableFixture(rapier);
};
