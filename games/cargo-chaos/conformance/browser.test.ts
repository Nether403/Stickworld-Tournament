import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { AttemptResult } from '../src/run.js';

const here = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(here, 'golden', 'sample.json'), 'utf8')) as {
  score: number;
  hash: string;
  ticks: number;
};

test('Cargo Chaos matches the Node golden score and hash', async ({ page }) => {
  const index = join(here, 'page', 'index.html');
  await page.goto(`file://${index}`);
  const result = (await page.evaluate(() => {
    const run = (window as unknown as { __STICKWORLD_CARGO__: () => Promise<unknown> })
      .__STICKWORLD_CARGO__;
    if (!run) throw new Error('cargo-chaos harness did not load');
    return run();
  })) as AttemptResult;
  expect(result.ticks).toBe(golden.ticks);
  expect(result.score).toBe(golden.score);
  expect(result.hash).toBe(golden.hash);
});
