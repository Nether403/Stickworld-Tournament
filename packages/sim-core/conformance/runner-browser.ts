import { runStress01 } from './fixtures/stress-01.js';

type HarnessWindow = Window & {
  __STICKWORLD_RUN__: () => ReturnType<typeof runStress01>;
};

(window as HarnessWindow).__STICKWORLD_RUN__ = () => runStress01();
