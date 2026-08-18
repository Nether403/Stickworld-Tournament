import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Prng } from '@stickworld/sim-core';
import { createTower, dumpTowerGeometry } from '../src/simulation/generator.js';
import { SAMPLE_SEED } from '../src/run.js';

const here = dirname(fileURLToPath(import.meta.url));
const path = join(here, '../conformance/golden/geometry.json');

describe('Pogo Tower generator', () => {
  it('is stable for the same seed', () => {
    const a = dumpTowerGeometry(createTower(new Prng(SAMPLE_SEED)));
    const b = dumpTowerGeometry(createTower(new Prng(SAMPLE_SEED)));
    expect(a).toBe(b);
    expect(JSON.parse(a)).toHaveLength(16);
  });

  it('matches the committed geometry dump', () => {
    const dump = dumpTowerGeometry(createTower(new Prng(SAMPLE_SEED)));
    mkdirSync(dirname(path), { recursive: true });
    if (!existsSync(path) || process.env.WRITE_SAMPLE === '1') {
      writeFileSync(path, dump);
    }
    expect(dump).toBe(readFileSync(path, 'utf8'));
  });

  it('does not draw extra PRNG values on static ledges', () => {
    const a = new Prng(SAMPLE_SEED);
    const b = new Prng(SAMPLE_SEED);
    createTower(a);
    createTower(b);
    expect(a.nextUint32()).toBe(b.nextUint32());
  });
});
