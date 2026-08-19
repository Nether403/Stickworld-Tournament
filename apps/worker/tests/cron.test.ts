import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCronJob, type CronOperations } from '../src/cron.js';

const originalTelemetry = process.env.STICKWORLD_TELEMETRY;

function operations(overrides: Partial<CronOperations> = {}): CronOperations {
  return {
    recomputeRankings: vi.fn(async () => undefined),
    rotateDaily: vi.fn(async () => undefined),
    closeSeason: vi.fn(async () => undefined),
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  if (originalTelemetry === undefined) delete process.env.STICKWORLD_TELEMETRY;
  else process.env.STICKWORLD_TELEMETRY = originalTelemetry;
});

describe('worker cron telemetry', () => {
  it('writes nothing when telemetry is disabled', async () => {
    delete process.env.STICKWORLD_TELEMETRY;
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const ops = operations();

    await runCronJob('recompute-rankings', ops);

    expect(ops.recomputeRankings).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
  });

  it('writes one JSON line for cron start and success when enabled', async () => {
    process.env.STICKWORLD_TELEMETRY = '1';
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });

    await runCronJob('rotate-daily', operations());

    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.endsWith('\n'))).toBe(true);
    const events = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(events.map((event) => event.name)).toEqual(['cron.start', 'cron.ok']);
    expect(events).toEqual([
      expect.objectContaining({
        gameId: 'rotate-daily',
        gameVersion: 'n/a',
        mode: 'ranked',
        browserFamily: 'unknown',
        deviceClass: 'unknown',
      }),
      expect.objectContaining({
        gameId: 'rotate-daily',
        durationMs: expect.any(Number),
      }),
    ]);
  });

  it('writes one JSON line for cron start and failure when enabled', async () => {
    process.env.STICKWORLD_TELEMETRY = '1';
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    const failure = new Error('ranking unavailable');

    await expect(
      runCronJob(
        'recompute-rankings',
        operations({
          recomputeRankings: vi.fn(async () => {
            throw failure;
          }),
        }),
      ),
    ).rejects.toBe(failure);

    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.endsWith('\n'))).toBe(true);
    const events = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(events.map((event) => event.name)).toEqual(['cron.start', 'cron.reject']);
    expect(events[1]).toMatchObject({
      gameId: 'recompute-rankings',
      reasonCode: 'INTERNAL',
      durationMs: expect.any(Number),
    });
  });
});
