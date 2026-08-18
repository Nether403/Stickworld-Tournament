import {
  assertPhysicsBudget,
  BudgetExceededError,
  initRapier,
  Prng,
  RAPIER_BUILD_SHA256,
  SimWorld,
  type Seed128,
  type StickworldGame,
} from '@stickworld/sim-core';
import { decodeReplay, encodeReplay, packGameVersion, playReplay, Recorder } from '@stickworld/replay';
import { runAttempt } from './run.js';

function hexPrefix(hex: string): Uint8Array {
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function firstActionId(game: StickworldGame): number {
  const action = game.manifest.actions[0];
  if (!action) throw new Error(`${game.manifest.id} has no actions`);
  return action.id;
}

function sampleInputs(game: StickworldGame): { tick: number; actionId: number; value: number }[] {
  const actionId = firstActionId(game);
  return [
    { tick: 10, actionId, value: 1 },
    { tick: 40, actionId, value: 1 },
    { tick: 80, actionId, value: 1 },
  ];
}

/**
 * Reusable StickworldGame contract checks. Every shipping title should run these
 * against the same helpers so Test Chamber stays the template, not a one-off.
 */
export async function assertSameSeedSameScore(
  game: StickworldGame,
  seed: Seed128 = [11, 22, 33, 44],
  ticks = 180,
): Promise<{ score: number; hash: string }> {
  const rapier = await initRapier();
  const inputs = sampleInputs(game);
  const a = runAttempt(game, { seed, rapier, prng: new Prng(seed) }, inputs, ticks);
  const b = runAttempt(game, { seed, rapier, prng: new Prng(seed) }, inputs, ticks);
  if (a.score !== b.score || a.hash !== b.hash) {
    throw new Error(
      `${game.manifest.id} diverged across two Node runs: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`,
    );
  }
  if (a.events <= 0) {
    throw new Error(`${game.manifest.id} produced no score events in ${ticks} ticks`);
  }
  return a;
}

export async function assertReplayRoundTrip(
  game: StickworldGame,
  seed: Seed128 = [5, 6, 7, 8],
  ticks = 120,
): Promise<{ score: number; hash: string; bytes: Uint8Array }> {
  const rapier = await initRapier();
  const sim = game.createSimulation({ seed, rapier, prng: new Prng(seed) });
  const recorder = new Recorder(game.manifest.actions);
  const actionId = firstActionId(game);
  recorder.record(12, actionId, 1);
  const events = recorder.snapshot();
  let eventIndex = 0;
  for (let t = 0; t < ticks; t++) {
    while (eventIndex < events.length && events[eventIndex]!.tick === t) {
      const event = events[eventIndex]!;
      sim.applyInput(event.actionId, event.value);
      eventIndex += 1;
    }
    sim.step();
  }
  const header = {
    formatVersion: 1,
    gameRegistryId: game.manifest.registryId,
    gameVersion: packGameVersion(1, 0, 0),
    simulationVersion: game.manifest.simulationVersion,
    scoringVersion: game.manifest.scoringVersion,
    rapierBuildHashPrefix: hexPrefix(RAPIER_BUILD_SHA256),
    seed,
    attemptId: new Uint8Array(16),
    tickRate: 60,
    totalTicks: ticks,
    claimedScore: BigInt(sim.score()),
    eventCount: events.length,
    finalStateHash: sim.stateHash(),
  };
  const bytes = await encodeReplay(header, events);
  const expectedScore = sim.score();
  const expectedHash = sim.stateHash();
  sim.dispose();

  const decoded = await decodeReplay(bytes);
  if (!decoded.ok) throw decoded.error;
  const replayed = game.createSimulation({ seed, rapier, prng: new Prng(seed) });
  try {
    const played = playReplay(replayed, decoded.header, decoded.events, game.manifest.actions);
    if (played.score !== expectedScore || played.stateHash !== expectedHash) {
      throw new Error(`${game.manifest.id} replay round-trip diverged`);
    }
    return { score: played.score, hash: played.stateHash.toString(16).padStart(16, '0'), bytes };
  } finally {
    replayed.dispose();
  }
}

export async function assertRenderStateIsolated(
  game: StickworldGame,
  seed: Seed128 = [1, 2, 3, 4],
): Promise<void> {
  const rapier = await initRapier();
  const sim = game.createSimulation({ seed, rapier, prng: new Prng(seed) });
  for (let i = 0; i < 30; i++) sim.step();
  const before = sim.stateHash();
  const snap = sim.renderState() as Record<string, unknown>;
  for (const key of Object.keys(snap)) {
    snap[key] = 999;
  }
  if (sim.stateHash() !== before) {
    sim.dispose();
    throw new Error(`${game.manifest.id} renderState mutation leaked into the state hash`);
  }
  sim.dispose();
}

export async function assertBudgetViolationDetected(game: StickworldGame): Promise<void> {
  const rapier = await initRapier();
  const tight = { ...game.manifest.budget, maxRigidBodies: 0 };
  const world = new SimWorld(rapier);
  world.createRigidBody(rapier.RigidBodyDesc.fixed());
  try {
    let thrown: unknown;
    try {
      assertPhysicsBudget(tight, {
        rigidBodies: world.registry.count(),
        colliders: 1,
        joints: 0,
        scoreEvents: 0,
      });
    } catch (error) {
      thrown = error;
    }
    if (!(thrown instanceof BudgetExceededError)) {
      throw new Error(`${game.manifest.id} did not throw BudgetExceededError for an over-budget world`);
    }
  } finally {
    world.free();
  }
}
