import type { ScoreEvent } from '@stickworld/sim-core';
import { min, floor } from '@stickworld/sim-core';

/** Hookline: 100 + 25 * min(streak, 4). Extra map() args must not change this. */
export function comboHundredths(streak: number): number {
  return streakHundredths(streak, 25, 4);
}

export function streakHundredths(streak: number, step: number, cap: number): number {
  return 100 + step * min(streak, cap);
}

export function finishBonus(tick: number, maxRunTicks: number): number {
  const raw = floor((maxRunTicks - tick) / 6);
  return raw > 0 ? raw : 0;
}

export interface ComboState {
  streak: number;
  lastPerfectTick: number;
}

export function resetCombo(state: ComboState): void {
  state.streak = 0;
}

export function notePerfect(state: ComboState, tick: number): void {
  state.streak += 1;
  state.lastPerfectTick = tick;
}

export function maybeIdleReset(state: ComboState, tick: number, idleTicks: number): void {
  if (tick - state.lastPerfectTick >= idleTicks) resetCombo(state);
}

export function pushEvent(
  events: ScoreEvent[],
  tick: number,
  type: string,
  points: number,
  multiplier: number,
): void {
  events.push({ tick, type, points, multiplier });
}

export function progressDelta(prevDecimetres: number, maxX: number): number {
  const next = floor(maxX * 10);
  return next > prevDecimetres ? next - prevDecimetres : 0;
}

export function firstPlaneCrossed(
  prev: number,
  next: number,
  planes: readonly number[],
  passed: boolean[],
): number | undefined {
  for (let i = 0; i < planes.length; i++) {
    if (passed[i]) continue;
    const plane = planes[i]!;
    if (prev < plane && next >= plane) return i;
  }
  return undefined;
}
