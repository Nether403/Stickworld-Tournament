import type { Database } from '@stickworld/db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { processClaimedJob, processNextJob } from '../src/verify.js';

const previousTelemetry = process.env.STICKWORLD_TELEMETRY;

afterEach(() => {
  vi.restoreAllMocks();
  if (previousTelemetry === undefined) delete process.env.STICKWORLD_TELEMETRY;
  else process.env.STICKWORLD_TELEMETRY = previousTelemetry;
});

describe('verification worker telemetry', () => {
  it('emits a reject and duration when a claimed job exceeds max claims', async () => {
    const database = {
      update() {
        const query = {
          set() {
            return query;
          },
          async where() {},
        };
        return query;
      },
      insert() {
        return {
          async values() {},
        };
      },
    } as unknown as Database;
    process.env.STICKWORLD_TELEMETRY = '1';
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });

    await processClaimedJob(
      database,
      { now: () => new Date('2026-08-19T00:00:00Z') },
      { jobId: 'job-1', runId: 'run-1', attempts: 6 },
      { maxClaims: 5 },
    );

    const telemetry = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(telemetry).toEqual([
      expect.objectContaining({
        name: 'verify.reject',
        reasonCode: 'WORKER_FAULT',
      }),
      expect.objectContaining({
        name: 'verify.duration_ms',
        reasonCode: 'WORKER_FAULT',
        durationMs: expect.any(Number),
      }),
    ]);
  });

  it('emits a season-tagged reject before duration when an exception exhausts claims', async () => {
    const rows = [
      { id: 'run-1', attemptId: 'attempt-1' },
      { id: 'attempt-1', gameVersionId: 'version-1', seasonGameId: 'season-game-1' },
      { id: 'version-1', gameVersion: '1.0.0' },
      {
        season_games: { seasonId: 'season-1' },
        games: {
          slug: 'test-chamber',
          get registryId(): number {
            throw new Error('simulated worker fault');
          },
        },
      },
    ];
    let selectIndex = 0;
    const database = {
      async execute() {
        return { rows: [{ id: 'job-1', run_id: 'run-1', attempts: 5 }] };
      },
      select() {
        const selectedRows = [rows[selectIndex++]];
        const result = Promise.resolve(selectedRows);
        const query = {
          from() {
            return query;
          },
          innerJoin() {
            return query;
          },
          where() {
            return query;
          },
          then: result.then.bind(result),
        };
        return query;
      },
      update() {
        const query = {
          set() {
            return query;
          },
          async where() {},
        };
        return query;
      },
    } as unknown as Database;
    process.env.STICKWORLD_TELEMETRY = '1';
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });

    await expect(
      processNextJob(database, { now: () => new Date('2026-08-19T00:00:00Z') }, 'worker-1', {
        maxClaims: 5,
      }),
    ).resolves.toBe(true);

    const telemetry = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(telemetry).toEqual([
      expect.objectContaining({
        name: 'verify.reject',
        reasonCode: 'WORKER_FAULT',
        seasonId: 'season-1',
      }),
      expect.objectContaining({
        name: 'verify.duration_ms',
        reasonCode: 'WORKER_FAULT',
        seasonId: 'season-1',
        durationMs: expect.any(Number),
      }),
    ]);
  });
});
