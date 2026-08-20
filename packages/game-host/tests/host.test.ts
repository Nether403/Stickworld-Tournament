import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Simulation, StickworldGame } from '@stickworld/sim-core';
import { GameHost } from '../src/host.js';
import type { GameView, HostPhase } from '../src/types.js';

const originalTelemetry = process.env.STICKWORLD_TELEMETRY;

afterEach(() => {
  vi.restoreAllMocks();
  if (originalTelemetry === undefined) delete process.env.STICKWORLD_TELEMETRY;
  else process.env.STICKWORLD_TELEMETRY = originalTelemetry;
});

function fakeGame(
  maxTicks = 10_000,
  rankedFormat: 'fixed-course' | 'daily-seed' | 'weekly-seed' = 'fixed-course',
): StickworldGame & { steps: () => number } {
  let steps = 0;
  const game: StickworldGame & { steps: () => number } = {
    manifest: {
      id: 'fake',
      registryId: 9,
      gameVersion: '1.0.0',
      simulationVersion: 1,
      scoringVersion: 1,
      rankedFormat,
      attemptShape: { kind: 'single' },
      maxRunTicks: maxTicks,
      tickRate: 60,
      actions: [{ id: 1, name: 'hook', kind: 'bool' }],
      budget: {
        maxRigidBodies: 4,
        maxColliders: 4,
        maxJoints: 1,
        maxReplayBytes: 1024,
        maxScoreEvents: 8,
      },
    },
    createSimulation(): Simulation {
      let tick = 0;
      let finished = false;
      return {
        get tick() {
          return tick;
        },
        get finished() {
          return finished;
        },
        applyInput() {},
        step() {
          if (finished) {
            tick += 1;
            return;
          }
          tick += 1;
          steps += 1;
          if (tick >= maxTicks) finished = true;
        },
        score() {
          return 0;
        },
        scoreEvents() {
          return [];
        },
        stateHash() {
          return 1n;
        },
        renderState() {
          return { tick };
        },
        dispose() {},
      };
    },
    steps: () => steps,
  };
  return game;
}

function view(): GameView & { phases: HostPhase[] } {
  const phases: HostPhase[] = [];
  return {
    phases,
    onFrame() {},
    onPhase(phase) {
      phases.push(phase);
    },
  };
}

describe('GameHost', () => {
  it('does not step the simulation during countdown', async () => {
    const game = fakeGame();
    const v = view();
    const host = new GameHost({
      game,
      slug: 'fake',
      mode: 'practice',
      view: v,
      scheduleFrame: () => 0,
      cancelFrame: () => {},
      now: () => 0,
      initRapier: async () => ({}) as never,
    });
    await host.start();
    host.pump(1000);
    host.pump(1000);
    expect(game.steps()).toBe(0);
    expect(v.phases.at(-1)).toBe('countdown');
    host.dispose();
  });

  it('throws when ranked play tries to pause', async () => {
    const fetches: string[] = [];
    const host = new GameHost({
      game: fakeGame(),
      slug: 'fake',
      mode: 'ranked',
      view: view(),
      scheduleFrame: () => 0,
      cancelFrame: () => {},
      now: () => 0,
      initRapier: async () => ({}) as never,
      fetchImpl: (async (input: RequestInfo | URL) => {
        fetches.push(String(input));
        return new Response(
          JSON.stringify({
            attemptId: '00000000-0000-0000-0000-000000000001',
            token: 'tok',
            seed: [5, 6, 7, 8],
            gameVersion: '1.0.0',
            expiresAt: '2099-01-01T00:00:00.000Z',
          }),
          { status: 201 },
        );
      }) as typeof fetch,
    });
    await host.start();
    expect(fetches.some((url) => url.includes('/v1/games/fake/attempts'))).toBe(true);
    expect(() => host.setPaused(true)).toThrow(/ranked pause/);
    host.dispose();
  });

  it('stops stepping in practice when paused', async () => {
    const game = fakeGame();
    const host = new GameHost({
      game,
      slug: 'fake',
      mode: 'practice',
      view: view(),
      scheduleFrame: () => 0,
      cancelFrame: () => {},
      now: () => 0,
      initRapier: async () => ({}) as never,
    });
    await host.start();
    host.pump(3000);
    const afterCountdown = game.steps();
    expect(afterCountdown).toBeGreaterThan(0);
    host.setPaused(true);
    host.pump(1000);
    expect(game.steps()).toBe(afterCountdown);
    host.dispose();
  });

  it('does not POST finish when stop is called without completing', async () => {
    const methods: string[] = [];
    const host = new GameHost({
      game: fakeGame(),
      slug: 'fake',
      mode: 'ranked',
      view: view(),
      scheduleFrame: () => 0,
      cancelFrame: () => {},
      now: () => 0,
      initRapier: async () => ({}) as never,
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        methods.push(`${init?.method ?? 'GET'} ${String(input)}`);
        return new Response(
          JSON.stringify({
            attemptId: '00000000-0000-0000-0000-000000000002',
            token: 'tok',
            seed: [5, 6, 7, 8],
            gameVersion: '1.0.0',
            expiresAt: '2099-01-01T00:00:00.000Z',
          }),
          { status: 201 },
        );
      }) as typeof fetch,
    });
    await host.start();
    host.stop();
    expect(methods.some((line) => line.includes('/finish'))).toBe(false);
  });

  it('posts the manifest rankedFormat as seedPolicy', async () => {
    const bodies: string[] = [];
    const host = new GameHost({
      game: fakeGame(10_000, 'weekly-seed'),
      slug: 'pogo-tower',
      mode: 'ranked',
      view: view(),
      scheduleFrame: () => 0,
      cancelFrame: () => {},
      now: () => 0,
      initRapier: async () => ({}) as never,
      fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(String(init?.body ?? ''));
        return new Response(
          JSON.stringify({
            attemptId: '00000000-0000-0000-0000-000000000003',
            token: 'tok',
            seed: [5, 6, 7, 8],
            gameVersion: '1.0.0',
            expiresAt: '2099-01-01T00:00:00.000Z',
          }),
          { status: 201 },
        );
      }) as typeof fetch,
    });
    await host.start();
    expect(bodies.some((body) => body.includes('weekly-seed'))).toBe(true);
    host.dispose();
  });

  it('emits host events with coarse device and ranked season tags', async () => {
    process.env.STICKWORLD_TELEMETRY = '1';
    const lines: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    const host = new GameHost({
      game: fakeGame(1),
      slug: 'fake',
      mode: 'ranked',
      view: view(),
      scheduleFrame: () => 0,
      cancelFrame: () => {},
      now: () => 0,
      initRapier: async () => ({}) as never,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 Version/17.6 Mobile/15E148 Safari/604.1',
      rankedClient: {
        async issueAttempt() {
          return {
            attemptId: '00000000-0000-0000-0000-000000000004',
            token: 'tok',
            seed: [5, 6, 7, 8],
            gameVersion: '1.0.0',
            seasonId: 'season-1',
            expiresAt: '2099-01-01T00:00:00.000Z',
          };
        },
        async finishAttempt() {
          return { runId: 'run-1', status: 'pending' };
        },
        async readRun() {
          return { status: 'verified', verifiedScore: '0', reasonCode: null };
        },
      },
    });

    await host.start();
    host.pump(3_001);
    await vi.waitFor(() => expect(host.rankedFinishRunId).toBe('run-1'));

    expect(lines.map((line) => JSON.parse(line))).toEqual([
      expect.objectContaining({
        name: 'host.start',
        seasonId: 'season-1',
        browserFamily: 'safari',
        deviceClass: 'mobile',
        mode: 'ranked',
      }),
      expect.objectContaining({
        name: 'host.finish',
        seasonId: 'season-1',
        browserFamily: 'safari',
        deviceClass: 'mobile',
        mode: 'ranked',
      }),
    ]);
    host.dispose();
  });
});
