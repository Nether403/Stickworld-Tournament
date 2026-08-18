#!/usr/bin/env node
/**
 * CI grep for third-party titles listed in docs/legal/brand-and-ip-clearance.md §4.
 * Word-boundary match so "Vex" does not fire on "vertex".
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

const NAMES = [
  'Stickman Hook',
  'Ragdoll Hit',
  'Dreadhead Parkour',
  'Light It Up',
  'Stickman Dismounting',
  'Boomstick Bazooka',
  'Archers Online',
  'Stickman Fall',
  'One Gun Stickman',
  'Stickman Skate Battle',
  'Stick Fight',
  'Supreme Duelist',
  'Ragdoll Archers',
  'Vex',
  'OvO',
  'Rooftop Snipers',
  'Stick War',
  'Henry Stickmin',
  'Fancy Pants',
  'Xiao Xiao',
  'Turbo Dismount',
  'Stair Dismount',
  'Line Rider',
  'Hill Climb Racing',
  'Elasto Mania',
  'QWOP',
  'Bowmasters',
  'Powder Game',
  'Clear Vision',
  'Tactical Assassin',
  'Stickman Party',
  'Stickman Bike Battle',
  'Stick It to the Stickman',
];

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  'coverage',
  'playwright-report',
  'test-results',
  '.pnpm-store',
  'Research',
  'Developing a Web-Based Stickman Tournament Platform',
]);

const ALLOW_FILES = new Set([
  'docs/legal/brand-and-ip-clearance.md',
  '.kiro/specs/README.md',
  'scripts/check-forbidden-names.mjs',
]);

function isWordChar(ch) {
  return /[A-Za-z0-9]/.test(ch);
}

function containsName(text, name) {
  const hay = text.toLowerCase();
  const needle = name.toLowerCase();
  let from = 0;
  while (from <= hay.length - needle.length) {
    const at = hay.indexOf(needle, from);
    if (at < 0) return false;
    const before = at === 0 ? '' : text[at - 1] ?? '';
    const after = text[at + needle.length] ?? '';
    if ((!before || !isWordChar(before)) && (!after || !isWordChar(after))) {
      return true;
    }
    from = at + 1;
  }
  return false;
}

function walk(dir, acc) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, acc);
      continue;
    }
    if (!st.isFile()) continue;
    if (st.size > 2_000_000) continue;
    acc.push(full);
  }
}

const files = [];
walk(ROOT, files);
const hits = [];

for (const file of files) {
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  if (ALLOW_FILES.has(rel)) continue;
  if (rel.startsWith('Research/')) continue;
  if (rel.startsWith('Developing a Web-Based Stickman Tournament Platform/')) continue;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const name of NAMES) {
    if (containsName(text, name) || containsName(rel, name)) {
      hits.push(`${rel}: forbidden name "${name}"`);
    }
  }
}

if (hits.length > 0) {
  console.error(hits.join('\n'));
  process.exit(1);
}

console.log(`ok: scanned ${files.length} files, no forbidden names`);
