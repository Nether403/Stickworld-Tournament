import { describe, expect, it } from 'vitest';
import { MAX_TICKS_PER_FRAME, Stepper } from '../src/stepper.js';
import { TIMESTEP } from '../src/version.js';

describe('Stepper', () => {
  it('consumes whole ticks at 60 Hz and keeps a fractional remainder', () => {
    const stepper = new Stepper();
    expect(stepper.advance(TIMESTEP * 2.5)).toBe(2);
    expect(stepper.tick).toBe(2);
    expect(stepper.interpolationAlpha).toBeGreaterThan(0);
    expect(stepper.interpolationAlpha).toBeLessThan(1);
  });

  it('caps catch-up after a stall', () => {
    const stepper = new Stepper();
    expect(stepper.advance(10)).toBe(MAX_TICKS_PER_FRAME);
    expect(stepper.tick).toBe(MAX_TICKS_PER_FRAME);
  });
});
