import { describe, expect, it } from 'vitest';
import { initRapier, Prng } from '@stickworld/sim-core';
import { streakHundredths } from '@stickworld/scoring';
import { pogoTowerGame } from '../src/index.js';
import { SAMPLE_INPUTS, SAMPLE_SEED, SAMPLE_TICKS } from '../src/run.js';

async function drive(
  inputs: readonly { tick: number; actionId: number; value: number }[],
  ticks: number,
) {
  const rapier = await initRapier();
  const sim = pogoTowerGame.createSimulation({
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

describe('Pogo scoring', () => {
  it('uses streakHundredths 20/5', () => {
    expect(streakHundredths(1, 20, 5)).toBe(120);
    expect(streakHundredths(5, 20, 5)).toBe(200);
  });

  it('scores altitude and land on the sample lean', async () => {
    const { events, score } = await drive(SAMPLE_INPUTS, SAMPLE_TICKS);
    expect(score).toBeGreaterThan(0);
    expect(events.some((event) => event.type === 'altitude')).toBe(true);
    expect(events.some((event) => event.type === 'land')).toBe(true);
  });
});
