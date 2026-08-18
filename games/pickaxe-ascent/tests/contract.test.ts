import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertBudgetViolationDetected,
  assertRenderStateIsolated,
  assertReplayRoundTrip,
  assertSameSeedSameScore,
} from '../../../packages/game-test-chamber/src/contract-suite.ts';
import { pickaxeAscentGame } from '../src/index.js';
import { SAMPLE_INPUTS, SAMPLE_SEED, SAMPLE_TICKS } from '../src/run.js';

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(here, '../conformance/golden/sample.json');
const fixturePath = join(here, '../fixtures/sample.swr');

describe('Pickaxe Ascent contract', () => {
  it('scores the same in two Node runs from the same seed and inputs', async () => {
    const result = await assertSameSeedSameScore(
      pickaxeAscentGame,
      SAMPLE_SEED,
      SAMPLE_TICKS,
      [...SAMPLE_INPUTS],
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.events).toBeGreaterThan(0);
  });

  it('round-trips through a replay and keeps the sample fixture in sync', async () => {
    const { score, hash, bytes } = await assertReplayRoundTrip(
      pickaxeAscentGame,
      SAMPLE_SEED,
      SAMPLE_TICKS,
      [...SAMPLE_INPUTS],
    );
    expect(score).toBeGreaterThan(0);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(bytes.byteLength).toBeLessThanOrEqual(15_360);
    mkdirSync(dirname(goldenPath), { recursive: true });
    mkdirSync(dirname(fixturePath), { recursive: true });
    if (!existsSync(goldenPath) || process.env.WRITE_SAMPLE === '1') {
      writeFileSync(
        goldenPath,
        `${JSON.stringify({ score, hash, ticks: SAMPLE_TICKS, seed: [...SAMPLE_SEED] }, null, 2)}\n`,
      );
      writeFileSync(fixturePath, bytes);
    }
    const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as { score: number; hash: string };
    expect(score).toBe(golden.score);
    expect(hash).toBe(golden.hash);
    expect(readFileSync(fixturePath).byteLength).toBe(bytes.byteLength);
  });

  it('keeps a 120 s record-on-change aim stream under 15 KB compressed', async () => {
    const inputs: { tick: number; actionId: number; value: number }[] = [];
    for (let t = 0; t < 7200; t += 10) {
      inputs.push({ tick: t, actionId: 1, value: t % 360 });
    }
    const { bytes } = await assertReplayRoundTrip(
      pickaxeAscentGame,
      SAMPLE_SEED,
      7200,
      inputs,
    );
    expect(bytes.byteLength).toBeLessThanOrEqual(15_360);
  });

  it('catches an over-budget simulation', async () => {
    await assertBudgetViolationDetected(pickaxeAscentGame);
  });

  it('renderState mutation cannot affect the hash', async () => {
    await assertRenderStateIsolated(pickaxeAscentGame);
  });
});
