import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initRapier } from '@stickworld/sim-core';
import { MAX_BODY_CAP, runMaxBodyBreakableFixture } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const path = join(here, '../conformance/golden/max-body.json');

describe('max-body four-runtime fixture', () => {
  it('matches the committed Node hashes at 28 bodies', async () => {
    const rapier = await initRapier();
    const result = runMaxBodyBreakableFixture(rapier);
    expect(result.bodyCount).toBe(MAX_BODY_CAP);
    expect(result.fractured).toBeGreaterThan(0);
    mkdirSync(dirname(path), { recursive: true });
    if (!existsSync(path) || process.env.WRITE_SAMPLE === '1') {
      writeFileSync(path, `${JSON.stringify(result.hashes, null, 2)}\n`);
    }
    const golden = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
    expect(result.hashes).toEqual(golden);
  });
});
