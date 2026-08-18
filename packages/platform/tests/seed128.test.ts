import { describe, expect, it } from 'vitest';
import { isDegenerateSeed, packSeed, unpackSeed } from '../src/seed128.js';

describe('seed128', () => {
  it('round-trips four little-endian uint32 values', () => {
    const seed = [5, 6, 7, 8] as const;
    expect(unpackSeed(packSeed(seed))).toEqual(seed);
  });

  it('detects the all-zero degenerate state', () => {
    expect(isDegenerateSeed([0, 0, 0, 0])).toBe(true);
    expect(isDegenerateSeed([1, 0, 0, 0])).toBe(false);
  });
});
