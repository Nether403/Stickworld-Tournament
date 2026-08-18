import { atan, atan2, cos, floor, hypot, min, max, sin } from '@stickworld/sim-core';

export const PI = 4 * atan(1);
export const PLAYER_HALF_HEIGHT = 0.45;
export const PLAYER_RADIUS = 0.18;
export const PLAYER_MASS = 70;
export const PLAYER_DAMPING = 0.04;
export const TUCK_DAMPING = 0.01;
export const PLAYER_START = { x: 2.0, y: 1.7 } as const;
export const PAD = { x: 2.0, y: 1.0, hx: 1.5, hy: 0.25 } as const;
export const BACKSTOP = { x: -2.0, y: 7.0, hx: 0.25, hy: 11.0 } as const;
export const LANDING = { x: 40.0, y: 1.0, hx: 2.5, hy: 0.25 } as const;
export const RING_HALF = { hx: 0.15, hy: 1.4 } as const;
export const DEATH_Y = -3;
export const DEATH_X = 46;
export const SETTLE_SPEED = 0.8;
export const SETTLE_TICKS = 20;
export const SUB_COUNT = 3;
export const RING_POINTS = 250;
export const LANDING_ALL_RINGS = 400;
export const LANDING_PARTIAL = 150;
export const ACTION_AIM = 1;
export const ACTION_POWER = 2;
export const ACTION_TUCK = 3;
export const ACTION_LAUNCH = 4;

export const RINGS = [
  { x: 10.0, y: 4.0 },
  { x: 18.0, y: 6.5 },
  { x: 26.0, y: 5.0 },
  { x: 34.0, y: 7.0 },
] as const;

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

export function launchSpeed(power: number): number {
  return 4 + power * 0.16;
}

export function clampPower(value: number): number {
  return min(100, max(0, value));
}

export { floor, hypot };