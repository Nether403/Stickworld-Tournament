import {
  comboHundredths,
  finishBonus,
  firstPlaneCrossed,
  maybeIdleReset,
  notePerfect,
  progressDelta,
  pushEvent,
  resetCombo,
  type ComboState,
} from '@stickworld/scoring';
import { GATES } from './course.js';

const GATE_XS: readonly number[] = GATES.map((gate) => gate.x);

export function gateIndexCrossed(prevX: number, x: number, passed: boolean[]): number | undefined {
  return firstPlaneCrossed(prevX, x, GATE_XS, passed);
}

export {
  comboHundredths,
  finishBonus,
  maybeIdleReset,
  notePerfect,
  progressDelta,
  pushEvent,
  resetCombo,
};
export type { ComboState };
