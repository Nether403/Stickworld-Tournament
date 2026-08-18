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
import { encodeReplay, packGameVersion, Recorder } from '@stickworld/replay';
import { RAPIER_BUILD_SHA256 } from '@stickworld/sim-core';
import { demolitionDiveGame } from '../src/index.js';
import { SAMPLE_INPUTS, SAMPLE_SEED, SAMPLE_TICKS } from '../src/run.js';

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(here, '../conformance/golden/sample.json');
const fixturePath = join(here, '../fixtures/sample.swr');

function hexPrefix(hex: string): Uint8Array {
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

describe('Demolition Dive contract', () => {
  it('scores the same in two Node runs from the same seed and inputs', async () => {
    const result = await assertSameSeedSameScore(
      demolitionDiveGame,
      SAMPLE_SEED,
      SAMPLE_TICKS,
      [...SAMPLE_INPUTS],
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.events).toBeGreaterThan(0);
  });

  it('round-trips through a replay and keeps the sample fixture in sync', async () => {
    const { score, hash, bytes } = await assertReplayRoundTrip(
      demolitionDiveGame,
      SAMPLE_SEED,
      SAMPLE_TICKS,
      [...SAMPLE_INPUTS],
    );
    expect(score).toBeGreaterThan(0);
    expect(bytes.byteLength).toBeLessThanOrEqual(81920);
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
  });

  it('keeps a 90 s record-on-change synthetic under the large replay ceiling', async () => {
    const recorder = new Recorder(demolitionDiveGame.manifest.actions);
    recorder.record(0, 1, 318);
    recorder.record(0, 2, 90);
    recorder.record(10, 3, 1);
    recorder.record(11, 3, 0);
    recorder.record(900, 1, 300);
    recorder.record(900, 2, 80);
    recorder.record(910, 3, 1);
    recorder.record(911, 3, 0);
    recorder.record(1800, 1, 330);
    recorder.record(1800, 2, 70);
    recorder.record(1810, 3, 1);
    recorder.record(1811, 3, 0);
    const events = recorder.snapshot();
    const bytes = await encodeReplay(
      {
        formatVersion: 1,
        gameRegistryId: 10,
        gameVersion: packGameVersion(1, 0, 0),
        simulationVersion: 1,
        scoringVersion: 1,
        rapierBuildHashPrefix: hexPrefix(RAPIER_BUILD_SHA256),
        seed: SAMPLE_SEED,
        attemptId: new Uint8Array(16),
        tickRate: 60,
        totalTicks: 5400,
        claimedScore: 0n,
        eventCount: events.length,
        finalStateHash: 1n,
      },
      events,
    );
    expect(bytes.byteLength).toBeLessThanOrEqual(81920);
  });

  it('catches an over-budget simulation', async () => {
    await assertBudgetViolationDetected(demolitionDiveGame);
  });

  it('renderState mutation cannot affect the hash', async () => {
    await assertRenderStateIsolated(demolitionDiveGame);
  });
});
