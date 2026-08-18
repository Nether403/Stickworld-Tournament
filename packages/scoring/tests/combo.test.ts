import { describe, expect, it } from 'vitest';
import {
  comboHundredths,
  finishBonus,
  firstPlaneCrossed,
  maybeIdleReset,
  notePerfect,
  progressDelta,
  resetCombo,
  sumSubAttempts,
  streakHundredths,
} from '../src/index.ts';

describe('comboHundredths', () => {
  it('is 100, 125, 150, 175, 200 and ignores Array.map index', () => {
    expect([0, 1, 2, 3, 4, 8].map(comboHundredths)).toEqual([100, 125, 150, 175, 200, 200]);
  });
});

describe('streakHundredths', () => {
  it('uses the supplied step and cap', () => {
    expect(streakHundredths(0, 20, 5)).toBe(100);
    expect(streakHundredths(5, 20, 5)).toBe(200);
    expect(streakHundredths(9, 20, 5)).toBe(200);
  });
});

describe('finishBonus', () => {
  it('is floor leftover ticks / 6', () => {
    expect(finishBonus(5400, 5400)).toBe(0);
    expect(finishBonus(0, 5400)).toBe(900);
    expect(finishBonus(0, 7200)).toBe(1200);
  });
});

describe('firstPlaneCrossed', () => {
  it('returns the first unpassed plane strictly after prev', () => {
    expect(firstPlaneCrossed(11, 12, [12, 24, 36, 52], [false, false, false, false])).toBe(0);
    expect(firstPlaneCrossed(11, 25, [12, 24, 36, 52], [true, false, false, false])).toBe(1);
    expect(firstPlaneCrossed(51, 52, [12, 24, 36, 52], [true, true, true, false])).toBe(3);
    expect(firstPlaneCrossed(52, 60, [12, 24, 36, 52], [true, true, true, true])).toBeUndefined();
  });
});

describe('sumSubAttempts', () => {
  it('sums integers and treats a missed slot as 0', () => {
    expect(sumSubAttempts([120, 0, 80])).toBe(200);
    expect(sumSubAttempts([])).toBe(0);
    expect(sumSubAttempts([1, 2, 3])).toBe(6);
  });
});

describe('progressDelta', () => {
  it('returns new decimetres of best progress', () => {
    expect(progressDelta(10, 1.25)).toBe(2);
    expect(progressDelta(12, 1.2)).toBe(0);
  });
});

describe('combo state', () => {
  it('increments on perfect and resets after idle', () => {
    const state = { streak: 0, lastPerfectTick: 0 };
    notePerfect(state, 10);
    notePerfect(state, 20);
    expect(state.streak).toBe(2);
    maybeIdleReset(state, 200, 180);
    expect(state.streak).toBe(0);
    notePerfect(state, 201);
    resetCombo(state);
    expect(state.streak).toBe(0);
  });
});
