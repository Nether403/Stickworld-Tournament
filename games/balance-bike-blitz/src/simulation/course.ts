import { degreesToRadians } from '@stickworld/physics-kit';
import { atan } from '@stickworld/sim-core';

export { degreesToRadians };

const PI = 4 * atan(1);
export const START = { x: 2.0, y: 1.2 } as const;
export const DEATH_Y = -1;
export const FINISH_X = 64;
export const CRASH_RAD = (80 * PI) / 180;
export const CRASH_HOLD = 30;
export const THROTTLE_TORQUE = -2.8;
export const LEAN_TORQUE = 0.8;
export const ACTION_THROTTLE = 1;
export const ACTION_BRAKE = 2;
export const ACTION_LEAN = 3;
export const LEAN_NEUTRAL = 100;
export const CHECKPOINTS = [16, 32, 48, 64] as const;
export const AIR_CHUNK = 10;
export const AIR_POINTS = 15;
