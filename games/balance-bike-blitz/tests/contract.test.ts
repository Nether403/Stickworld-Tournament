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
import { balanceBikeBlitzGame } from '../src/index.js';
import { SAMPLE_INPUTS, SAMPLE_SEED, SAMPLE_TICKS } from '../src/run.js';

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = join(here, '../conformance/golden/sample.json');
const fixturePath = join(here, '../fixtures/sample.swr');

function hexPrefix(hex: string): Uint8Array {
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

describe('Bike contract', () => {
  it('scores the same in two Node runs from the same seed and inputs', async () => {
    const result = await assertSameSeedSameScore(
      balanceBikeBlitzGame,
      SAMPLE_SEED,
      SAMPLE_TICKS,
      [...SAMPLE_INPUTS],
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.events).toBeGreaterThan(0);
  });

  it('round-trips through a replay and keeps the sample fixture in sync', async () => {
    const { score, hash, bytes } = await assertReplayRoundTrip(
      balanceBikeBlitzGame,
      SAMPLE_SEED,
      SAMPLE_TICKS,
      [...SAMPLE_INPUTS],
    );
    expect(score).toBeGreaterThan(0);
    expect(bytes.byteLength).toBeLessThanOrEqual(40960);
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

  it('keeps a 150 s record-on-change synthetic under 40960 bytes', async () => {
    const recorder = new Recorder(balanceBikeBlitzGame.manifest.actions);
    const first = balanceBikeBlitzGame.manifest.actions[0]!;
    recorder.record(0, first.id, first.kind === 'bool' ? 1 : (first.max ?? 1) > 2 ? 1 : 1);
    for (let t = 90; t < 9000; t += 180) {
      const second = balanceBikeBlitzGame.manifest.actions[1];
      if (second && second.kind === 'bool') {
        recorder.record(t, second.id, 1);
        recorder.record(t + 8, second.id, 0);
      }
    }
    const events = recorder.snapshot();
    const bytes = await encodeReplay(
      {
        formatVersion: 1,
        gameRegistryId: 8,
        gameVersion: packGameVersion(1, 0, 0),
        simulationVersion: 1,
        scoringVersion: 1,
        rapierBuildHashPrefix: hexPrefix(RAPIER_BUILD_SHA256),
        seed: SAMPLE_SEED,
        attemptId: new Uint8Array(16),
        tickRate: 60,
        totalTicks: 9000,
        claimedScore: 0n,
        eventCount: events.length,
        finalStateHash: 1n,
      },
      events,
    );
    expect(bytes.byteLength).toBeLessThanOrEqual(40960);
  });

  it('catches an over-budget simulation', async () => {
    await assertBudgetViolationDetected(balanceBikeBlitzGame);
  });

  it('renderState mutation cannot affect the hash', async () => {
    await assertRenderStateIsolated(balanceBikeBlitzGame);
  });
});
