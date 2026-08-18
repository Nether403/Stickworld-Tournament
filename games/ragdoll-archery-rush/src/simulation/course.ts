import { atan, atan2, cos, floor, hypot, sin } from '@stickworld/sim-core';

export const PI = 4 * atan(1);
export const TORSO_START = { x: 2.0, y: 1.4 } as const;
export const FLOOR = { x: 14.0, y: 0.25, hx: 16.0, hy: 0.25 } as const;
export const BACKSTOP = { x: 28.0, y: 8.0, hx: 0.25, hy: 10.0 } as const;
export const ARROW_HALF_HEIGHT = 0.35;
export const ARROW_RADIUS = 0.03;
export const ARROW_MASS = 0.04;
export const TARGET_RADIUS = 0.35;
export const ACTION_AIM = 1;
export const ACTION_DRAW = 2;
export const ACTION_FIRE = 3;
export const ARROW_AABB = { xMin: -1, xMax: 30, yMin: -1, yMax: 14 } as const;
export const SLEEP_SPEED = 0.35;
export const SLEEP_TICKS = 12;

export const TARGETS = [
  { x: 12.0, y: 2.0, points: 100 },
  { x: 12.0, y: 4.5, points: 150 },
  { x: 16.0, y: 3.0, points: 200 },
  { x: 16.0, y: 6.0, points: 250 },
  { x: 20.0, y: 2.5, points: 300 },
  { x: 20.0, y: 5.5, points: 400 },
  { x: 24.0, y: 4.0, points: 500 },
  { x: 24.0, y: 7.0, points: 800 },
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

export function arrowSpeed(draw: number): number {
  return 8 + draw * 0.22;
}

export { floor, hypot };
