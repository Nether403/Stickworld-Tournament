import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LocalInputSource,
  ReplayInputSource,
  ScriptedInputSource,
  type InputSource,
  type QuantisedInput,
} from '@stickworld/input';
import { decodeReplay } from '@stickworld/replay';
import { applyInputsInOrder, initRapier, Prng } from '@stickworld/sim-core';
import { describe, expect, it } from 'vitest';
import { testChamberGame } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '../fixtures/sample.swr');

describe('InputSource identity', () => {
  it('produces the same score and state hash from replay, scripted, and local inputs', async () => {
    const decoded = await decodeReplay(readFileSync(fixturePath));
    if (!decoded.ok) throw decoded.error;

    const scripted = new Map<number, QuantisedInput[]>();
    const local = new LocalInputSource();
    for (const event of decoded.events) {
      const group = scripted.get(event.tick);
      const input = { actionId: event.actionId, value: event.value };
      if (group) group.push(input);
      else scripted.set(event.tick, [input]);
      local.push(event.tick, event.actionId, event.value);
    }

    const sources: readonly InputSource[] = [
      new ReplayInputSource(decoded.events),
      new ScriptedInputSource(scripted),
      local,
    ];
    const rapier = await initRapier();
    const results = sources.map((source) => {
      const seed = decoded.header.seed;
      const simulation = testChamberGame.createSimulation({
        seed,
        rapier,
        prng: new Prng(seed),
      });
      try {
        for (let tick = 0; tick < decoded.header.totalTicks; tick++) {
          applyInputsInOrder(
            (actionId, value) => simulation.applyInput(actionId, value),
            source.inputsForTick(tick),
          );
          simulation.step();
        }
        return { score: simulation.score(), stateHash: simulation.stateHash() };
      } finally {
        simulation.dispose();
      }
    });

    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });
});
