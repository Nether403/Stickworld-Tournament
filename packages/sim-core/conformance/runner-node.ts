import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runStress01 } from './fixtures/stress-01.js';
import { formatReport } from './report.js';

const here = dirname(fileURLToPath(import.meta.url));

const result = await runStress01();
const report = formatReport(result.rapierBuildHash, [
  { runtime: `node ${process.version}`, hashes: result.hashes },
]);
console.log(report);

const goldenPath = join(here, 'golden', 'stress-01.json');
writeFileSync(goldenPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`wrote ${goldenPath}`);
