import { describe, expect, it } from 'vitest';
import { initRapier, Prng } from '@stickworld/sim-core';
import { sumSubAttempts } from '@stickworld/scoring';
import { launchLabGame } from '../src/index.js';
import { SAMPLE_INPUTS, SAMPLE_SEED } from '../src/run.js';
import { launchSpeed } from '../src/simulation/course.js';

async function drive(
  inputs: readonly { tick: number; actionId: number; value: number }[],
  ticks: number,
) {
  const rapier = await initRapier();
  const sim = launchLabGame.createSimulation({
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

describe('Launch Lab scoring', () => {
  it('maps power 0 and 100 to 4 m/s and 20 m/s', () => {
    expect(launchSpeed(0)).toBe(4);
    expect(launchSpeed(100)).toBe(20);
  });

  it('sums three sub-attempt scores', () => {
    expect(sumSubAttempts([10, 0, 25])).toBe(35);
  });

  it('scores a miss-launch slot as 0 until a launch happens', async () => {
    const { events, score } = await drive([], 60);
    expect(events.length).toBe(0);
    expect(score).toBe(0);
  });

  it('emits distance on the sample launch', async () => {
    const { events, score } = await drive(SAMPLE_INPUTS, 240);
    expect(score).toBeGreaterThan(0);
    expect(events.some((event) => event.type === 'distance' || event.type === 'ring')).toBe(true);
  });

  it('emits fail when the capsule leaves the death plane', async () => {
    const { events, state } = await drive(
      [
        { tick: 0, actionId: 1, value: 0 },
        { tick: 0, actionId: 2, value: 100 },
        { tick: 5, actionId: 4, value: 1 },
        { tick: 6, actionId: 4, value: 0 },
      ],
      180,
    );
    expect(state.fail || events.some((event) => event.type === 'fail')).toBe(true);
  });

  it('resets pose for a second launch without new bodies', async () => {
    const { state, events } = await drive(
      [
        { tick: 0, actionId: 1, value: 0 },
        { tick: 0, actionId: 2, value: 80 },
        { tick: 5, actionId: 4, value: 1 },
        { tick: 6, actionId: 4, value: 0 },
        { tick: 200, actionId: 4, value: 1 },
        { tick: 201, actionId: 4, value: 0 },
      ],
      400,
    );
    expect(state.subIndex).toBeGreaterThanOrEqual(1);
    expect(events.filter((event) => event.type === 'fail').length).toBeGreaterThanOrEqual(1);
  });
});
