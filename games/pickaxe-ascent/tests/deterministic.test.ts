import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatHash, initRapier, Prng } from '@stickworld/sim-core';
import { pickaxeAscentGame } from '../src/index.js';
import { SAMPLE_INPUTS, SAMPLE_SEED } from '../src/run.js';

const TICKS = [1, 10, 100, 1000, 7200] as const;
const here = dirname(fileURLToPath(import.meta.url));
const path = join(here, '../conformance/golden/hashes.json');

describe('Pickaxe hash series', () => {
  it('matches the committed Node hashes', async () => {
    const rapier = await initRapier();
    const sim = pickaxeAscentGame.createSimulation({
      seed: SAMPLE_SEED,
      rapier,
      prng: new Prng(SAMPLE_SEED),
    });
    const hashes: Record<string, string> = {};
    let eventIndex = 0;
    const maxTick = TICKS[TICKS.length - 1]!;
    for (let t = 0; t < maxTick; t++) {
      while (eventIndex < SAMPLE_INPUTS.length && SAMPLE_INPUTS[eventIndex]!.tick === t) {
        const input = SAMPLE_INPUTS[eventIndex]!;
        sim.applyInput(input.actionId, input.value);
        eventIndex += 1;
      }
      sim.step();
      if ((TICKS as readonly number[]).includes(sim.tick)) {
        hashes[String(sim.tick)] = formatHash(sim.stateHash());
      }
    }
    sim.dispose();
    mkdirSync(dirname(path), { recursive: true });
    if (!existsSync(path) || process.env.WRITE_SAMPLE === '1') {
      writeFileSync(path, `${JSON.stringify(hashes, null, 2)}\n`);
    }
    const golden = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    expect(hashes).toEqual(golden);
  });
});
