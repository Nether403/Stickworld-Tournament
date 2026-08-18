import { describe, expect, it } from 'vitest';
import { initRapier, Prng } from '@stickworld/sim-core';
import { streakHundredths } from '@stickworld/scoring';
import { ragdollArcheryRushGame } from '../src/index.js';
import { SAMPLE_INPUTS, SAMPLE_SEED } from '../src/run.js';
import { arrowSpeed } from '../src/simulation/course.js';

async function drive(
  inputs: readonly { tick: number; actionId: number; value: number }[],
  ticks: number,
) {
  const rapier = await initRapier();
  const sim = ragdollArcheryRushGame.createSimulation({
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
  const state = sim.renderState() as { inFlight: boolean; score: number; finished: boolean };
  const score = sim.score();
  sim.dispose();
  return { events, state, score };
}

describe('Archery scoring', () => {
  it('maps draw 0 and 100 to 8 m/s and 30 m/s', () => {
    expect(arrowSpeed(0)).toBe(8);
    expect(arrowSpeed(100)).toBe(30);
  });

  it('uses streakHundredths 25/4', () => {
    expect(streakHundredths(1, 25, 4)).toBe(125);
    expect(streakHundredths(4, 25, 4)).toBe(200);
  });

  it('emits a target event on the sample shot or a later recovery', async () => {
    const { events, score } = await drive(SAMPLE_INPUTS, 240);
    expect(events.some((event) => event.type === 'target')).toBe(true);
    expect(score).toBeGreaterThan(0);
  });
});
