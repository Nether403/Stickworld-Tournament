import { describe, expect, it } from 'vitest';
import { initRapier, Prng } from '@stickworld/sim-core';
import { cargoChaosGame } from '../src/index.js';
import { SAMPLE_INPUTS, SAMPLE_SEED, SAMPLE_TICKS } from '../src/run.js';

async function drive(
  inputs: readonly { tick: number; actionId: number; value: number }[],
  ticks: number,
) {
  const rapier = await initRapier();
  const sim = cargoChaosGame.createSimulation({
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
  const score = sim.score();
  sim.dispose();
  return { events, score };
}

describe('Cargo scoring', () => {
  it('scores progress on the sample inputs', async () => {
    const { events, score } = await drive(SAMPLE_INPUTS, SAMPLE_TICKS);
    expect(score).toBeGreaterThan(0);
    expect(events.some((event) => event.type === 'progress' || event.type === 'altitude' || event.type === 'condition')).toBe(true);
  });
});
