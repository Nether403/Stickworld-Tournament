import { atan, cos, sin } from '@stickworld/sim-core';

const PI = 4 * atan(1);

export const PLAYER_HALF_HEIGHT = 0.45;
export const PLAYER_RADIUS = 0.18;
export const PLAYER_MASS = 70;
export const PLAYER_DAMPING = 0.02;
export const PLAYER_START = { x: 2.0, y: 1.6 } as const;
export const CRATE_START = { x: 2.8, y: 1.6 } as const;
export const CRATE_HALF = 0.2;
export const CRATE_MASS = 25;
export const HITCH_REST = 0.9;
export const POST_RADIUS = 0.18;
export const ATTACH_RANGE = 6;
export const DEATH_Y = 0;
export const FINISH_X = 36;
export const FINISH_Y = 0.5;
export const ACTION_AIM = 1;
export const ACTION_HOOK = 2;
export const POSTS = [
  { x: 6.0, y: 3.5 },
  { x: 11.0, y: 2.0 },
  { x: 16.0, y: 4.0 },
  { x: 22.0, y: 3.0 },
  { x: 28.0, y: 5.0 },
  { x: 33.0, y: 2.5 },
] as const;
export const HAZARDS = [
  { x: 13.0, y: 0.8, hx: 1.0, hy: 0.4 },
  { x: 25.0, y: 0.8, hx: 1.0, hy: 0.4 },
] as const;
export const FLOORS = [
  { x: 4, y: 0.25, hx: 4, hy: 0.25 },
  { x: 21, y: 0.25, hx: 3, hy: 0.25 },
  { x: 36, y: 0.25, hx: 4, hy: 0.25 },
] as const;

export function aimVector(degrees: number): { x: number; y: number } {
  const rad = (degrees * PI) / 180;
  return { x: cos(rad), y: sin(rad) };
}
