import { describe, expect, it } from 'vitest';
import { initRapier, Prng } from '@stickworld/sim-core';
import { sumSubAttempts } from '@stickworld/scoring';
import { demolitionDiveGame } from '../src/index.js';
import { SAMPLE_INPUTS, SAMPLE_SEED, SAMPLE_TICKS } from '../src/run.js';
import { chainHundredths, launchSpeed } from '../src/simulation/course.js';

async function drive(
  inputs: readonly { tick: number; actionId: number; value: number }[],
  ticks: number,
) {
  const rapier = await initRapier();
  const sim = demolitionDiveGame.createSimulation({
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
  const state = sim.renderState() as {
    fail: boolean;
    finished: boolean;
    inFlight: boolean;
    subIndex: number;
    score: number;
  };
  const score = sim.score();
  sim.dispose();
  return { events, state, score };
}

describe('Demolition Dive scoring', () => {
  it('maps power 0 and 100 to 8 m/s and 26 m/s', () => {
    expect(launchSpeed(0)).toBe(8);
    expect(launchSpeed(100)).toBe(26);
  });

  it('sums three sub-attempt scores', () => {
    expect(sumSubAttempts([10, 0, 25])).toBe(35);
  });

  it('uses chain hundredths capped at depth 3', () => {
    expect(chainHundredths(1)).toBe(120);
    expect(chainHundredths(3)).toBe(160);
    expect(chainHundredths(9)).toBe(160);
  });

  it('scores a miss-launch slot as 0 until a launch happens', async () => {
    const { events, score } = await drive([], 60);
    expect(events.length).toBe(0);
    expect(score).toBe(0);
  });

  it('emits break on the sample dive', async () => {
    const { events, score } = await drive(SAMPLE_INPUTS, SAMPLE_TICKS);
    expect(score).toBeGreaterThan(0);
    expect(events.some((event) => event.type === 'break')).toBe(true);
  });

  it('emits fail when the ragdoll misses and falls', async () => {
    const { events, state } = await drive(
      [
        { tick: 0, actionId: 1, value: 270 },
        { tick: 0, actionId: 2, value: 0 },
        { tick: 5, actionId: 3, value: 1 },
        { tick: 6, actionId: 3, value: 0 },
      ],
      240,
    );
    expect(state.fail || events.some((event) => event.type === 'fail')).toBe(true);
  });

  it('resets pose for a second dive without new bodies', async () => {
    const { state } = await drive(
      [
        { tick: 0, actionId: 1, value: 90 },
        { tick: 0, actionId: 2, value: 20 },
        { tick: 5, actionId: 3, value: 1 },
        { tick: 6, actionId: 3, value: 0 },
        { tick: 200, actionId: 1, value: 318 },
        { tick: 200, actionId: 2, value: 95 },
        { tick: 210, actionId: 3, value: 1 },
        { tick: 211, actionId: 3, value: 0 },
      ],
      400,
    );
    expect(state.subIndex).toBeGreaterThanOrEqual(1);
  });
});
