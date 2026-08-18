import { abs, atan, atan2, cos, floor, hypot, max, min, sin } from '@stickworld/sim-core';
import { streakHundredths } from '@stickworld/scoring';

export const PI = 4 * atan(1);
export const ATTACH_RANGE = 0.45;
export const REST_LENGTH = 0.12;
export const PLAYER_HALF_HEIGHT = 0.45;
export const PLAYER_RADIUS = 0.18;
export const PLAYER_MASS = 70;
export const PLAYER_DAMPING = 0.04;
export const PLAYER_START = { x: 5.0, y: 1.6 } as const;
export const FLOOR = { x: 5.0, y: 0.25, hx: 4.5, hy: 0.25 } as const;
export const WALL_HX = 0.2;
export const WALL_HY = 16;
export const WALL_Y = 14;
export const LEFT_WALL_X = 0.4;
export const RIGHT_WALL_X = 9.6;
export const LEDGE_HX = 1.1;
export const LEDGE_HY = 0.12;
export const PICKAXE_HX = 0.6;
export const PICKAXE_HY = 0.04;
export const PICKAXE_OFFSET_Y = 0.15;
export const DEATH_Y = 0;
export const FINISH_Y = 24;
export const DROP_RESET = 2;
export const ACTION_AIM = 1;
export const ACTION_HOOK = 2;
export const CLEAN_STEP = 20;
export const CLEAN_CAP = 5;

export const LEDGES = [
  { x: 3.2, y: 3.5 },
  { x: 6.8, y: 6.5 },
  { x: 3.0, y: 9.5 },
  { x: 7.0, y: 12.5 },
  { x: 3.4, y: 15.5 },
  { x: 6.6, y: 18.5 },
  { x: 3.2, y: 21.5 },
  { x: 5.0, y: 24.5 },
] as const;

export const CHECKPOINTS = [3, 6, 9, 12, 15, 18, 21, 24] as const;

export function comboHundredths(streak: number): number {
  return streakHundredths(streak, CLEAN_STEP, CLEAN_CAP);
}

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

export function nearestForwardLedgeAim(px: number, py: number, vx: number): number | undefined {
  const facingX = vx >= 0 ? 1 : -1;
  const facingY = 0.8;
  const flen = hypot(facingX, facingY);
  const fx = facingX / flen;
  const fy = facingY / flen;
  let bestDist = 8;
  let bestDeg: number | undefined;
  for (const ledge of LEDGES) {
    const dx = ledge.x - px;
    const dy = ledge.y - py;
    const dist = hypot(dx, dy);
    if (dist === 0 || dist > 8) continue;
    const dot = (dx / dist) * fx + (dy / dist) * fy;
    if (dot < 0.15) continue;
    if (dist < bestDist) {
      bestDist = dist;
      bestDeg = degreesFromVector(dx, dy);
    }
  }
  return bestDeg;
}

export { abs, floor, hypot, max, min };
