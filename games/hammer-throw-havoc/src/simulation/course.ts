import { abs } from '@stickworld/sim-core';

export const THROWER = { x: 3.0, y: 1.6 } as const;
export const HAMMER_START = { x: 3.6, y: 1.6 } as const;
export const HAMMER_HALF = { hx: 0.45, hy: 0.08 } as const;
export const HAMMER_MASS = 8;
export const LINK_REST = 0.55;
export const FLOOR = { x: 30, y: 0.25, hx: 32, hy: 0.25 } as const;
export const WALL = { x: 52, y: 8, hx: 0.25, hy: 10 } as const;
export const GATE_HALF = { hx: 0.08, hy: 2.5 } as const;
export const DEATH_Y = -1;
export const SPIN_TORQUE = 0.35;
export const SPIN_CAP = 18;
export const SUB_COUNT = 3;
export const ACTION_SPIN = 1;
export const ACTION_RELEASE = 2;
export const SLEEP_SPEED = 0.4;
export const SLEEP_TICKS = 20;

export const GATES = [
  { x: 12, y: 3.0, points: 80 },
  { x: 20, y: 3.5, points: 120 },
  { x: 28, y: 4.0, points: 180 },
  { x: 36, y: 4.5, points: 240 },
] as const;

/** Membership << 16 | filter. Thrower and hammer must not collide (the cuboid overlaps the plant). */
export const GROUP_WORLD = 0x0001;
export const GROUP_THROWER = 0x0002;
export const GROUP_HAMMER = 0x0004;

export function interactionGroups(membership: number, filter: number): number {
  return ((membership & 0xffff) << 16) | (filter & 0xffff);
}

/** In-game angular helper. Launch/Archery do not import this — not extracted. */
export function applySpinTorque(
  body: { angvel: () => number; applyTorqueImpulse: (t: number, wake: boolean) => void },
  torque: number,
  cap: number,
): void {
  if (abs(body.angvel()) >= cap) return;
  body.applyTorqueImpulse(torque, true);
}

export { abs };
