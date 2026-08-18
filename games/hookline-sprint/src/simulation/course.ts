import { comboHundredths } from '@stickworld/scoring';
import { abs, atan, atan2, cos, floor, hypot, max, min, sin } from '@stickworld/sim-core';

export const PI = 4 * atan(1);
export const ATTACH_RANGE = 8;
export const REST_LENGTH_MIN = 0.8;
export const REST_LENGTH_MAX = 8;
export const PLAYER_HALF_HEIGHT = 0.45;
export const PLAYER_RADIUS = 0.18;
export const PLAYER_MASS = 70;
export const PLAYER_DAMPING = 0.04;
export const PLAYER_START = { x: 2.0, y: 3.0 } as const;
export const START_LEDGE = { x: 2.0, y: 0.25, hx: 2.0, hy: 0.25 } as const;
export const ANCHOR_RADIUS = 0.2;
export const DEATH_Y = 0;
export const DEATH_X = -0.5;
export const FINISH_X = 52;
export const FINISH_Y = 0.5;
export const PERFECT_RATIO_NUM = 92;
export const PERFECT_RATIO_DEN = 100;
export const PERFECT_MIN_SPEED = 2;
export const COMBO_IDLE_TICKS = 180;
export const LEDGE_RESET_AFTER_TICK = 30;
export const ACTION_AIM = 1;
export const ACTION_HOOK = 2;

export const ANCHORS = [
  { x: 6.0, y: 8.0 },
  { x: 12.0, y: 5.5 },
  { x: 18.0, y: 9.0 },
  { x: 24.0, y: 5.0 },
  { x: 30.0, y: 8.5 },
  { x: 36.0, y: 6.0 },
  { x: 42.0, y: 9.5 },
  { x: 48.0, y: 7.0 },
] as const;

export const GATES = [
  { x: 12, points: 500 },
  { x: 24, points: 500 },
  { x: 36, points: 500 },
  { x: 52, points: 500 },
] as const;

export { comboHundredths };

export function aimVector(degrees: number): { x: number; y: number } {
  const rad = (degrees * PI) / 180;
  return { x: cos(rad), y: sin(rad) };
}

export function degreesFromVector(x: number, y: number): number {
  const rad = atan2(y, x);
  let deg = floor((rad * 180) / PI);
  if (deg < 0) deg += 360;
  if (deg > 359) deg = 359;
  return deg;
}

export function clampRestLength(distance: number): number {
  return min(REST_LENGTH_MAX, max(REST_LENGTH_MIN, distance));
}

export function isPerfectRelease(absVx: number, swingMaxAbsVx: number): boolean {
  if (swingMaxAbsVx < PERFECT_MIN_SPEED) return false;
  return absVx * PERFECT_RATIO_DEN >= swingMaxAbsVx * PERFECT_RATIO_NUM;
}

export function nearestForwardAnchorAim(
  px: number,
  py: number,
  vx: number,
): number | undefined {
  const facingX = vx >= 0 ? 1 : -1;
  const facingY = 0.15;
  const flen = hypot(facingX, facingY);
  const fx = facingX / flen;
  const fy = facingY / flen;
  let bestDist = ATTACH_RANGE + 1;
  let bestDeg: number | undefined;
  for (const anchor of ANCHORS) {
    const dx = anchor.x - px;
    const dy = anchor.y - py;
    const dist = hypot(dx, dy);
    if (dist === 0 || dist > ATTACH_RANGE) continue;
    const dot = (dx / dist) * fx + (dy / dist) * fy;
    if (dot < 0.25) continue;
    if (dist < bestDist) {
      bestDist = dist;
      bestDeg = degreesFromVector(dx, dy);
    }
  }
  return bestDeg;
}

export { abs, floor, hypot, max, min };
