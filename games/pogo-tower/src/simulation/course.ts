export const PLAYER_HALF_HEIGHT = 0.45;
export const PLAYER_RADIUS = 0.18;
export const PLAYER_MASS = 70;
export const PLAYER_DAMPING = 0.02;
export const POGO_V = 9.0;
export const LEAN_IMPULSE = 0.04;
export const FLOOR = { x: 5.0, y: 0.25, hx: 5.2, hy: 0.25 } as const;
export const WALL_HX = 0.2;
export const WALL_HY = 20;
export const WALL_Y = 18;
export const LEFT_WALL_X = 0.4;
export const RIGHT_WALL_X = 9.6;
export const DEATH_Y = 0;
export const DROP_RESET = 2.0;
export const LAND_POINTS = 120;
export const ACTION_LEAN = 1;
export const LEAN_NEUTRAL = 100;
export const LEAN_MIN = 0;
export const LEAN_MAX = 200;

export function clampLean(value: number): number {
  if (value < LEAN_MIN) return LEAN_MIN;
  if (value > LEAN_MAX) return LEAN_MAX;
  return value;
}

export function leanImpulseX(lean: number): number {
  return (lean - LEAN_NEUTRAL) * LEAN_IMPULSE;
}
