import { describe, expect, it } from 'vitest';
import { initRapier, Prng } from '@stickworld/sim-core';
import { sumSubAttempts } from '@stickworld/scoring';
import { hammerThrowHavocGame } from '../src/index.js';
import { SAMPLE_INPUTS, SAMPLE_SEED } from '../src/run.js';

async function drive(
  inputs: readonly { tick: number; actionId: number; value: number }[],
  ticks: number,
) {
  const rapier = await initRapier();
  const sim = hammerThrowHavocGame.createSimulation({
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
  const state = sim.renderState() as { subIndex: number; released: boolean; fail: boolean };
  const score = sim.score();
  sim.dispose();
  return { events, state, score };
}

describe('Hammer scoring', () => {
  it('sums three throws', () => {
    expect(sumSubAttempts([10, 0, 20])).toBe(30);
  });

  it('missed throw scores 0 until release', async () => {
    const { score } = await drive([], 40);
    expect(score).toBe(0);
  });

  it('emits distance or gate on the sample spin-and-release', async () => {
    const { events, score } = await drive(SAMPLE_INPUTS, 280);
    expect(score).toBeGreaterThan(0);
    expect(events.some((event) => event.type === 'distance' || event.type === 'gate')).toBe(true);
  });
});
