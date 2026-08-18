import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { assertAgainstGolden, formatReport } from './report.js';
import type { HashSeries, StressResult } from './fixtures/stress-01.js';

const here = dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(
  readFileSync(join(here, 'golden', 'stress-01.json'), 'utf8'),
) as StressResult;

test('stress-01 matches golden hashes', async ({ page, browserName }, testInfo) => {
  const index = join(here, 'page', 'index.html');
  await page.goto(`file://${index}`);
  const result = (await page.evaluate(() => {
    const run = (window as unknown as { __STICKWORLD_RUN__: () => Promise<unknown> })
      .__STICKWORLD_RUN__;
    if (!run) throw new Error('harness did not load');
    return run();
  })) as StressResult;

  expect(result.hashes[1]).toMatch(/^[0-9a-f]{16}$/);
  assertAgainstGolden(result, golden);

  const project = testInfo.project.name;
  console.log(
    formatReport(result.rapierBuildHash, [
      { runtime: `${project}/${browserName}`, hashes: result.hashes as HashSeries },
    ]),
  );
});
