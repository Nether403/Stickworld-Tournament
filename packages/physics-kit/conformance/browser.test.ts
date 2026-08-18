import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { MaxBodyFixtureResult } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(readFileSync(join(here, 'golden', 'max-body.json'), 'utf8')) as Record<
  string,
  string
>;

test('max-body hashes match Node at 28 bodies', async ({ page }) => {
  const index = join(here, 'page', 'index.html');
  await page.goto(`file://${index}`);
  const result = (await page.evaluate(() => {
    const run = (window as unknown as { __STICKWORLD_MAX_BODY__: () => Promise<unknown> })
      .__STICKWORLD_MAX_BODY__;
    if (!run) throw new Error('physics-kit max-body harness did not load');
    return run();
  })) as MaxBodyFixtureResult;

  expect(result.bodyCount).toBe(28);
  expect(result.hashes).toEqual(golden);
});
