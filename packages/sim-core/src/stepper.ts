import { TIMESTEP } from './version.js';

export const MAX_FRAME_DELTA = 0.25;
export const MAX_TICKS_PER_FRAME = 15;

export class Stepper {
  tick = 0;
  interpolationAlpha = 0;
  private accumulator = 0;

  advance(realDeltaSeconds: number): number {
    const delta =
      realDeltaSeconds > MAX_FRAME_DELTA ? MAX_FRAME_DELTA : Math.max(0, realDeltaSeconds);
    this.accumulator += delta;
    let consumed = 0;
    while (this.accumulator >= TIMESTEP && consumed < MAX_TICKS_PER_FRAME) {
      this.tick += 1;
      this.accumulator -= TIMESTEP;
      consumed += 1;
    }
    this.interpolationAlpha = this.accumulator / TIMESTEP;
    return consumed;
  }
}
