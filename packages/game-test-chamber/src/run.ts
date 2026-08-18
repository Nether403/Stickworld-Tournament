import { formatHash, type Seed128, type StickworldGame, type SimulationContext } from '@stickworld/sim-core';

export const SAMPLE_SEED: Seed128 = [5, 6, 7, 8];
export const SAMPLE_TICKS = 120;
export const SAMPLE_INPUTS = [{ tick: 12, actionId: 1, value: 1 }] as const;

export interface AttemptResult {
  readonly score: number;
  readonly hash: string;
  readonly ticks: number;
  readonly events: number;
}

export function runAttempt(
  game: StickworldGame,
  context: SimulationContext,
  inputs: readonly { tick: number; actionId: number; value: number }[],
  ticks: number,
): AttemptResult {
  const sim = game.createSimulation(context);
  let eventIndex = 0;
  for (let t = 0; t < ticks; t++) {
    while (eventIndex < inputs.length && inputs[eventIndex]!.tick === t) {
      const input = inputs[eventIndex]!;
      sim.applyInput(input.actionId, input.value);
      eventIndex += 1;
    }
    sim.step();
  }
  const result: AttemptResult = {
    score: sim.score(),
    hash: formatHash(sim.stateHash()),
    ticks: sim.tick,
    events: sim.scoreEvents().length,
  };
  sim.dispose();
  return result;
}
