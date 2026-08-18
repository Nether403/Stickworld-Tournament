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
const geometry = readFileSync(join(here, 'golden', 'geometry.json'), 'utf8');

test('Pogo matches the Node golden score and hash', async ({ page }) => {
  const index = join(here, 'page', 'index.html');
  await page.goto(`file://${index}`);
  const result = (await page.evaluate(() => {
    const run = (window as unknown as { __STICKWORLD_POGO__: () => Promise<unknown> })
      .__STICKWORLD_POGO__;
    if (!run) throw new Error('pogo-tower harness did not load');
    return run();
  })) as AttemptResult;

  expect(result.ticks).toBe(golden.ticks);
  expect(result.score).toBe(golden.score);
  expect(result.hash).toBe(golden.hash);
});

test('Pogo geometry dump matches Node', async ({ page }) => {
  const index = join(here, 'page', 'index.html');
  await page.goto(`file://${index}`);
  const dump = await page.evaluate(() => {
    const run = (window as unknown as { __STICKWORLD_POGO_GEOMETRY__: () => string })
      .__STICKWORLD_POGO_GEOMETRY__;
    if (!run) throw new Error('pogo-tower geometry harness did not load');
    return run();
  });
  expect(dump).toBe(geometry);
});
