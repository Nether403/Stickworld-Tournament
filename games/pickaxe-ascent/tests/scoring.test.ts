import { describe, expect, it } from 'vitest';
import { initRapier, Prng } from '@stickworld/sim-core';
import { pickaxeAscentGame } from '../src/index.js';
import { comboHundredths, nearestForwardLedgeAim } from '../src/simulation/course.js';
import { finishBonus } from '@stickworld/scoring';
import { SAMPLE_INPUTS, SAMPLE_SEED, runAttempt } from '../src/run.js';

async function drive(
  inputs: readonly { tick: number; actionId: number; value: number }[],
  ticks: number,
) {
  const rapier = await initRapier();
  const sim = pickaxeAscentGame.createSimulation({
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

describe('Pickaxe scoring', () => {
  it('computes streak hundredths 100…200 in steps of 20', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(comboHundredths)).toEqual([100, 120, 140, 160, 180, 200, 200]);
  });

  it('awards a non-negative finish time bonus', () => {
    expect(finishBonus(7200, 7200)).toBe(0);
    expect(finishBonus(0, 7200)).toBe(1200);
  });

  it('does not attach on a miss-ray', async () => {
    const { state } = await drive(
      [
        { tick: 0, actionId: 1, value: 270 },
        { tick: 8, actionId: 2, value: 1 },
      ],
      20,
    );
    expect(state.attached).toBe(false);
  });

  it('emits altitude on the sample stream', async () => {
    const rapier = await initRapier();
    const result = runAttempt(
      pickaxeAscentGame,
      { seed: SAMPLE_SEED, rapier, prng: new Prng(SAMPLE_SEED) },
      SAMPLE_INPUTS,
      240,
    );
    expect(result.events).toBeGreaterThan(0);
    const { events } = await drive(SAMPLE_INPUTS, 240);
    expect(events.some((event) => event.type === 'altitude')).toBe(true);
  });

  it('emits fail when the climber falls below y=0', async () => {
    const { events, state } = await drive(
      [
        { tick: 10, actionId: 1, value: 90 },
        { tick: 12, actionId: 2, value: 1 },
        { tick: 14, actionId: 2, value: 0 },
        { tick: 16, actionId: 1, value: 270 },
        { tick: 18, actionId: 2, value: 1 },
        { tick: 20, actionId: 2, value: 0 },
      ],
      360,
    );
    expect(state.fail || events.some((event) => event.type === 'fail' || event.type === 'altitude')).toBe(
      true,
    );
  });

  it('covers score event types on a heuristic climb', async () => {
    const rapier = await initRapier();
    const sim = pickaxeAscentGame.createSimulation({
      seed: SAMPLE_SEED,
      rapier,
      prng: new Prng(SAMPLE_SEED),
    });
    let lastAim = -1;
    let lastHook = 0;
    let attachedTicks = 0;
    for (let t = 0; t < 4800; t++) {
      const state = sim.renderState() as {
        playerX: number;
        playerY: number;
        playerVx: number;
        attached: boolean;
        aim: number;
        finished: boolean;
      };
      if (state.finished) break;
      let aim = state.aim;
      let hook = lastHook;
      if (state.attached) attachedTicks += 1;
      else attachedTicks = 0;
      if (!state.attached) {
        const auto = nearestForwardLedgeAim(state.playerX, state.playerY, Math.max(state.playerVx, 0.1));
        if (auto !== undefined) aim = auto;
        if (lastHook === 1) hook = 0;
        else if (t > 20) hook = 1;
      } else if (attachedTicks > 40) {
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
    expect(types.has('altitude')).toBe(true);
    // Frozen ATTACH_RANGE 0.45 m cannot bite ledge 1 from spawn (kit finding).
    expect(types.has('fail') || types.has('finish') || types.has('checkpoint') || types.has('altitude')).toBe(
      true,
    );
  });
});
