export const STAND_HX = 0.18;
export const STAND_HY = 0.45;
export const SLIDE_HY = 0.22;
export const FWD_SPEED = 5.0;
export const BACK_SPEED = 3.0;
export const JUMP_V = 7.5;
export const COYOTE_TICKS = 4;
export const BUFFER_TICKS = 4;
export const STUMBLE_TICKS = 20;
export const START = { x: 2.0, y: 3.0 } as const;
export const DEATH_Y = 0;
export const FINISH_X = 72;
export const ACTION_RUN = 1;
export const ACTION_JUMP = 2;
export const ACTION_SLIDE = 3;
export const ROOF_HY = 0.2;
export const CHECKPOINTS = [12, 24, 36, 48, 60, 72] as const;
export const ROOFS = [
  { x: 4, y: 1.0, hx: 4 },
  { x: 14, y: 1.4, hx: 3.5 },
  { x: 24, y: 2.2, hx: 3.0 },
  { x: 34, y: 1.6, hx: 3.5 },
  { x: 46, y: 2.8, hx: 4.0 },
  { x: 58, y: 2.0, hx: 3.0 },
  { x: 70, y: 1.2, hx: 4.0 },
] as const;
export const LINTELS = [
  { x: 24, y: 3.4, hx: 1.2, hy: 0.15 },
  { x: 58, y: 3.2, hx: 1.2, hy: 0.15 },
] as const;
