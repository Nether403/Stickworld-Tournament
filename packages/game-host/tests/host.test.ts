import { describe, expect, it } from 'vitest';
import type { Simulation, StickworldGame } from '@stickworld/sim-core';
import { GameHost } from '../src/host.js';
import type { GameView, HostPhase } from '../src/types.js';

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
});
