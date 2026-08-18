import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runStress01 } from '../conformance/fixtures/stress-01.js';
import { assertAgainstGolden, formatReport } from '../conformance/report.js';
import type { StressResult } from '../conformance/fixtures/stress-01.js';

const goldenPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../conformance/golden/stress-01.json',
);

describe('golden hashes (Node)', () => {
  it('matches or records the committed stress-01 series', async () => {
    const result = await runStress01();
    const report = formatReport(result.rapierBuildHash, [
      { runtime: `node ${process.version}`, hashes: result.hashes },
    ]);
    console.log(`\n${report}\n`);

    if (process.env.WRITE_GOLDEN === '1' || !existsSync(goldenPath)) {
      writeFileSync(goldenPath, `${JSON.stringify(result, null, 2)}\n`);
    }

    const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as StressResult;
    expect(() => assertAgainstGolden(result, golden)).not.toThrow();
  }, 60_000);
});
