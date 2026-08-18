#!/usr/bin/env node
/**
 * Spec 3 Task 2.7: gzip of /play/hookline-sprint client JS+CSS, excluding Rapier WASM
 * and excluding the Pickaxe client chunk (lazy-loaded).
 *
 * Baseline: docs/budgets/spec3-bundles.json. CI fails above ceilingFactor * baseline.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEXT = join(ROOT, 'apps/web/.next');
const BUDGET = join(ROOT, 'docs/budgets/spec3-bundles.json');
const WASM_MAGIC = Buffer.from([0x00, 0x61, 0x73, 0x6d]);
const WASM_B64 = 'AGFzbQ';

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function gzipBytes(buf) {
  if (buf.byteLength === 0) return 0;
  return gzipSync(buf, { level: 9 }).byteLength;
}

function stripRapierWasm(buf, path) {
  if (path.endsWith('.wasm')) return Buffer.alloc(0);
  if (buf.byteLength >= 4 && buf.subarray(0, 4).equals(WASM_MAGIC)) return Buffer.alloc(0);
  const text = buf.toString('utf8');
  if (!text.includes(WASM_B64) && buf.indexOf(WASM_MAGIC) < 0) return buf;
  const next = text.replace(/(?:[A-Za-z0-9+/]{80,}={0,2})/g, (chunk) => {
    if (!chunk.includes(WASM_B64)) return chunk;
    try {
      const decoded = Buffer.from(chunk, 'base64');
      if (decoded.subarray(0, 4).equals(WASM_MAGIC)) return '';
    } catch {
      return chunk;
    }
    return chunk;
  });
  return Buffer.from(next, 'utf8');
}

function resolveStatic(rel) {
  const cleaned = rel.replace(/^\/_next\//, '').replace(/^\//, '');
  const candidates = [join(NEXT, cleaned), join(NEXT, 'static', cleaned)];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function chunkRefs(text) {
  const out = [];
  const re = /static\/chunks\/[A-Za-z0-9._-]+\.js/g;
  let match;
  while ((match = re.exec(text))) out.push(match[0]);
  return out;
}

function isPickaxeOnly(text) {
  const pickaxe = text.includes('pickaxeAscentGame') || text.includes('mountPickaxeClient');
  const hookline = text.includes('hooklineSprintGame') || text.includes('mountHooklineClient');
  return pickaxe && !hookline;
}

function findHooklinePlayManifest() {
  const options = [
    {
      manifest: join(NEXT, 'server/app/play/hookline-sprint/page_client-reference-manifest.js'),
      build: join(NEXT, 'server/app/play/hookline-sprint/page/build-manifest.json'),
      entryRe: /"\[project\]\/apps\/web\/app\/play\/hookline-sprint\/page":\[(.*?)\]/,
    },
    {
      manifest: join(NEXT, 'server/app/play/[slug]/page_client-reference-manifest.js'),
      build: join(NEXT, 'server/app/play/[slug]/page/build-manifest.json'),
      entryRe: /"\[project\]\/apps\/web\/app\/play\/\[slug\]\/page":\[(.*?)\]/,
    },
  ];
  for (const option of options) {
    if (existsSync(option.manifest) && existsSync(option.build)) return option;
  }
  throw new Error('play page manifests missing — run pnpm --filter @stickworld/web build first');
}

function collectHooklineFiles() {
  const { manifest: playManifest, build: playBuild, entryRe } = findHooklinePlayManifest();
  const seeds = new Set();
  const build = loadJson(playBuild);
  for (const file of [...(build.rootMainFiles ?? []), ...(build.polyfillFiles ?? [])]) {
    seeds.add(file);
  }
  const manifestText = readFileSync(playManifest, 'utf8');
  const entry = entryRe.exec(manifestText);
  if (entry) {
    for (const file of JSON.parse(`[${entry[1]}]`)) seeds.add(file);
  }
  for (const file of chunkRefs(manifestText)) seeds.add(file);

  const seen = new Set();
  const queue = [...seeds];
  while (queue.length) {
    const rel = queue.pop().replace(/^\/_next\//, '');
    if (seen.has(rel)) continue;
    const full = resolveStatic(rel);
    if (!full) {
      seen.add(rel);
      continue;
    }
    const raw = readFileSync(full);
    const text = raw.toString('utf8');
    if (isPickaxeOnly(text)) {
      seen.add(rel);
      continue;
    }
    seen.add(rel);
    for (const ref of chunkRefs(text)) {
      if (!seen.has(ref)) queue.push(ref);
    }
  }
  return [...seen];
}

const rels = collectHooklineFiles();
let jsCssGzip = 0;
let wasmGzip = 0;
const counted = [];
for (const rel of rels) {
  if (!/\.(js|css)$/.test(rel)) continue;
  const full = resolveStatic(rel);
  if (!full) continue;
  const raw = readFileSync(full);
  const stripped = stripRapierWasm(raw, full);
  const gzAll = gzipBytes(raw);
  const gz = gzipBytes(stripped);
  const wasmPart = gzAll > gz ? gzAll - gz : 0;
  jsCssGzip += gz;
  wasmGzip += wasmPart;
  counted.push({ rel, gzip: gz, wasmGzip: wasmPart });
}

counted.sort((a, b) => b.gzip - a.gzip);

const result = {
  hooklinePlayJsCssGzipBytesExcludingRapierWasm: jsCssGzip,
  rapierWasmGzipBytes: wasmGzip,
  files: counted,
};

if (process.env.WRITE_BUDGET === '1') {
  writeFileSync(
    BUDGET,
    `${JSON.stringify(
      {
        hooklinePlayJsCssGzipBytesExcludingRapierWasm: jsCssGzip,
        ceilingFactor: 1.2,
        task1GoldenFreezeSha: '60f12a3',
      },
      null,
      2,
    )}\n`,
  );
}

if (!existsSync(BUDGET) && process.env.WRITE_BUDGET !== '1') {
  console.log(JSON.stringify(result, null, 2));
  console.error('docs/budgets/spec3-bundles.json missing. Re-run with WRITE_BUDGET=1 after a web build.');
  process.exit(1);
}

const budget = loadJson(BUDGET);
const baseline = budget.hooklinePlayJsCssGzipBytesExcludingRapierWasm;
const ceiling = Math.ceil(baseline * (budget.ceilingFactor ?? 1.2));
console.log(
  JSON.stringify(
    {
      measured: jsCssGzip,
      baseline,
      ceiling,
      rapierWasmGzipBytes: wasmGzip,
      files: counted.slice(0, 12),
    },
    null,
    2,
  ),
);
if (jsCssGzip > ceiling) {
  console.error(`play bundle gzip ${jsCssGzip} exceeds ceiling ${ceiling} (120% of ${baseline})`);
  process.exit(1);
}
if (jsCssGzip === 0) {
  console.error('measured 0 bytes — play route chunks were not found');
  process.exit(1);
}
console.log(`ok: play JS+CSS gzip ${jsCssGzip} <= ${ceiling}`);
