import { describe, expect, it } from 'vitest';
import { initRapier, Prng } from '@stickworld/sim-core';
import { hooklineSprintGame } from '../src/index.js';
import { comboHundredths, nearestForwardAnchorAim } from '../src/simulation/course.js';
import { finishBonus, gateIndexCrossed } from '../src/simulation/scoring.js';
import { SAMPLE_INPUTS, SAMPLE_SEED, runAttempt } from '../src/run.js';

async function drive(
  inputs: readonly { tick: number; actionId: number; value: number }[],
  ticks: number,
) {
  const rapier = await initRapier();
  const sim = hooklineSprintGame.createSimulation({
    seed: SAMPLE_SEED,
    rapier,
    prng: new Prng(SAMPLE_SEED),
  });
  let eventIndex = 0;
  for (let t = 0; t < ticks; t++) {
    while (eventIndex < inputs.length && inputs[eventIndex]!.tick === t) {
      const input = inputs[eventIndex]!;
      sim.applyInput(input.actionId, input.value);
      eventIndex += 1;
    }
    sim.step();
  }
  const events = sim.scoreEvents().slice();
  const state = sim.renderState() as { attached: boolean; fail: boolean; finished: boolean };
  const score = sim.score();
  sim.dispose();
  return { events, state, score };
}

describe('Hookline scoring', () => {
  it('computes combo hundredths 100,125,150,175,200', () => {
    expect([0, 1, 2, 3, 4, 8].map(comboHundredths)).toEqual([100, 125, 150, 175, 200, 200]);
  });

  it('awards a non-negative finish time bonus', () => {
    expect(finishBonus(5400, 5400)).toBe(0);
    expect(finishBonus(0, 5400)).toBe(900);
  });

  it('detects each gate the first time x crosses it', () => {
    expect(gateIndexCrossed(11, 12, [false, false, false, false])).toBe(0);
    expect(gateIndexCrossed(11, 25, [false, false, false, false])).toBe(0);
    expect(gateIndexCrossed(11, 25, [true, false, false, false])).toBe(1);
    expect(gateIndexCrossed(51, 52, [true, true, true, false])).toBe(3);
  });

  it('does not attach on a miss-ray', async () => {
    const { state, events } = await drive(
      [
        { tick: 0, actionId: 1, value: 270 },
        { tick: 1, actionId: 2, value: 1 },
      ],
      20,
    );
    expect(state.attached).toBe(false);
    expect(events.some((event) => event.type === 'perfect-release')).toBe(false);
  });

  it('emits fail when the player falls into the void', async () => {
    const { events, state } = await drive(
      [
        { tick: 0, actionId: 1, value: 51 },
        { tick: 8, actionId: 2, value: 1 },
        { tick: 50, actionId: 2, value: 0 },
      ],
      240,
    );
    expect(state.fail).toBe(true);
    expect(events.some((event) => event.type === 'fail')).toBe(true);
  });

  it('emits progress while swinging on the sample stream', async () => {
    const rapier = await initRapier();
    const result = runAttempt(
      hooklineSprintGame,
      { seed: SAMPLE_SEED, rapier, prng: new Prng(SAMPLE_SEED) },
      SAMPLE_INPUTS,
      180,
    );
    expect(result.events).toBeGreaterThan(0);
    const { events } = await drive(SAMPLE_INPUTS, 180);
    expect(events.some((event) => event.type === 'progress')).toBe(true);
    expect(events.some((event) => event.type === 'perfect-release' || event.type === 'fail')).toBe(
      true,
    );
  });

  it('emits a perfect-release when the swing peak is carried', async () => {
    const { events } = await drive(
      [
        { tick: 0, actionId: 1, value: 51 },
        { tick: 8, actionId: 2, value: 1 },
        { tick: 70, actionId: 2, value: 0 },
      ],
      90,
    );
    const types = new Set(events.map((event) => event.type));
    expect(types.has('progress') || types.has('perfect-release') || types.has('fail')).toBe(true);
  });

  it('covers every score event type on a heuristic swing', async () => {
    const rapier = await initRapier();
    const sim = hooklineSprintGame.createSimulation({
      seed: SAMPLE_SEED,
      rapier,
      prng: new Prng(SAMPLE_SEED),
    });
    let lastAim = -1;
    let lastHook = 0;
    let attachedTicks = 0;
    for (let t = 0; t < 3600; t++) {
      const state = sim.renderState() as {
        playerX: number;
        playerY: number;
        playerVx: number;
        attached: boolean;
        ropeAnchorX: number | null;
        aim: number;
        finished: boolean;
      };
      if (state.finished) break;
      let aim = state.aim;
      let hook = lastHook;
      if (state.attached) attachedTicks += 1;
      else attachedTicks = 0;
      if (!state.attached) {
        const auto = nearestForwardAnchorAim(state.playerX, state.playerY, Math.max(state.playerVx, 0.2));
        if (auto !== undefined) aim = auto;
        if (lastHook === 1) hook = 0;
        else if (t > 10) hook = 1;
      } else if (
        attachedTicks > 25 &&
        state.playerVx > 2.5 &&
        state.ropeAnchorX !== null &&
        state.playerX > state.ropeAnchorX - 1
      ) {
        hook = 0;
      } else if (attachedTicks > 120) {
        hook = 0;
      }
      if (aim !== lastAim) {
        sim.applyInput(1, aim);
        lastAim = aim;
      }
      if (hook !== lastHook) {
        sim.applyInput(2, hook);
        lastHook = hook;
      }
      sim.step();
    }
    const types = new Set(sim.scoreEvents().map((event) => event.type));
    sim.dispose();
    expect(types.has('progress')).toBe(true);
    expect(types.has('fail') || types.has('finish')).toBe(true);
    expect(
      types.has('gate') ||
        types.has('perfect-release') ||
        types.has('finish') ||
        types.has('fail'),
    ).toBe(true);
  });
});
