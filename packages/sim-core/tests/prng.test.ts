import { describe, expect, it } from 'vitest';
import { DegenerateSeedError, Prng } from '../src/prng.js';

const SEED = [0x12345678, 0x9abcdef0, 0x0fedcba9, 0x87654321] as const;

describe('Prng', () => {
  it('rejects all-zero seed', () => {
    expect(() => new Prng([0, 0, 0, 0])).toThrow(DegenerateSeedError);
  });

  it('is deterministic for a given seed', () => {
    const a = new Prng(SEED);
    const b = new Prng(SEED);
    for (let i = 0; i < 100; i++) {
      expect(a.nextUint32()).toBe(b.nextUint32());
    }
  });

  it('clone continues independently from the same state', () => {
    const a = new Prng(SEED);
    a.nextUint32();
    const b = a.clone();
    expect(a.nextUint32()).toBe(b.nextUint32());
  });

  it('nextInt stays in range and is unbiased enough to hit both ends', () => {
    const rng = new Prng(SEED);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const n = rng.nextInt(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThan(7);
      seen.add(n);
    }
    expect(seen).toEqual(new Set([3, 4, 5, 6]));
  });

  it('matches the committed first 1_000 outputs', () => {
    const rng = new Prng(SEED);
    const out: number[] = [];
    for (let i = 0; i < 1000; i++) {
      out.push(rng.nextUint32());
    }
    expect(out).toMatchSnapshot();
  });
});
