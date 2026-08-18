import { atan, atan2, cos, floor, hypot, min, max, sin } from '@stickworld/sim-core';

export const PI = 4 * atan(1);
export const TORSO_START = { x: 2.0, y: 12.0 } as const;
export const FLOOR = { x: 10.8, y: 0.25, hx: 4.5, hy: 0.25 } as const;
export const BACKSTOP = { x: 20.0, y: 8.0, hx: 0.25, hy: 10.0 } as const;
export const BRICK_HALF = { hx: 0.8, hy: 0.25 } as const;
export const BRICK_MASS = 18;
export const DEATH_Y = -1;
export const SETTLE_SPEED = 0.4;
export const SETTLE_TICKS = 30;
export const SUB_COUNT = 3;
export const ACTION_AIM = 1;
export const ACTION_POWER = 2;
export const ACTION_LAUNCH = 3;
export const BRICK_XS = [8.4, 10.0, 11.6, 13.2] as const;
export const STOREYS = [
  { y: 1.0, value: 40 },
  { y: 3.0, value: 70 },
  { y: 5.0, value: 110 },
] as const;

export const BRICKS = STOREYS.flatMap((storey) =>
  BRICK_XS.map((x) => ({ x, y: storey.y, value: storey.value })),
);

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
  return 8 + power * 0.18;
}

export function clampPower(value: number): number {
  return min(100, max(0, value));
}

export function chainHundredths(depth: number): number {
  return 100 + 20 * min(depth, 3);
}

export { floor, hypot };
