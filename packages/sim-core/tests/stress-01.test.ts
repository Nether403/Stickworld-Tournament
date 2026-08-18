import { describe, expect, it } from 'vitest';
import {
  mathSinDrive,
  runStress01,
} from '../conformance/fixtures/stress-01.js';

describe('stress-01', () => {
  it('runs 10_000 ticks and records checkpoint hashes', async () => {
    const result = await runStress01();
    expect(result.rapierBuildHash).toMatch(/^[0-9a-f]{64}$/);
    for (const tick of [1, 10, 100, 1000, 10_000] as const) {
      expect(result.hashes[tick]).toMatch(/^[0-9a-f]{16}$/);
    }
    expect(result.hashes[1]).not.toBe(result.hashes[10_000]);
  }, 60_000);

  it('diverges when Math.sin replaces detmath.sin on the platform drive', async () => {
    const honest = await runStress01({ ticks: 400 });
    const tainted = await runStress01({ ticks: 400, drive: mathSinDrive });
    expect(tainted.hashes[100]).not.toBe(honest.hashes[100]);
  }, 30_000);
});
