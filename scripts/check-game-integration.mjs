#!/usr/bin/env node
/**
 * Merge gate: every games/<slug> package must ship the Spec 3 design §11 files.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const GAMES = join(ROOT, 'games');

if (!existsSync(GAMES)) {
  console.log('ok: no games/ packages yet');
  process.exit(0);
}

const required = (slug) => [
  `docs/games/${slug}.md`,
  `docs/legal/inspiration/${slug}.md`,
  `games/${slug}/src/manifest.ts`,
  `games/${slug}/src/index.ts`,
  `games/${slug}/tests/deterministic.test.ts`,
  `games/${slug}/tests/scoring.test.ts`,
  `games/${slug}/tests/contract.test.ts`,
  `games/${slug}/fixtures/sample.swr`,
  `games/${slug}/conformance/golden/sample.json`,
];

let failed = false;
for (const entry of readdirSync(GAMES)) {
  const dir = join(GAMES, entry);
  if (!statSync(dir).isDirectory()) continue;
  if (!existsSync(join(dir, 'package.json'))) continue;
  for (const rel of required(entry)) {
    const full = join(ROOT, rel);
    if (!existsSync(full)) {
      console.error(`missing ${rel}`);
      failed = true;
    }
  }
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const scripts = pkg.scripts ?? {};
  if (!scripts['score:browser']) {
    console.error(`${entry}: package.json missing score:browser script`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('ok: game integration checklist files present');
