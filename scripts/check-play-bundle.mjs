#!/usr/bin/env node
/**
 * Spec 3 Task 2.7: gzip of /play/hookline-sprint client JS+CSS, excluding Rapier WASM.
 *
 * Baseline lives in docs/budgets/spec3-bundles.json. CI fails if the measured
 * gzip is above ceilingFactor * baseline.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'apps/web');
const NEXT = join(WEB, '.next');
const BUDGET = join(ROOT, 'docs/budgets/spec3-bundles.json');
const WASM_MAGIC = Buffer.from([0x00, 0x61, 0x73, 0x6d]);
const WASM_B64 = 'AGFzbQ';

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function collectPlayFiles() {
  const files = new Set();
  const appManifestPath = join(NEXT, 'app-build-manifest.json');
  if (!existsSync(appManifestPath)) {
    throw new Error('apps/web/.next/app-build-manifest.json missing — run pnpm --filter @stickworld/web build first');
  }
  const appManifest = loadJson(appManifestPath);
  const pages = appManifest.pages ?? {};
  for (const [route, list] of Object.entries(pages)) {
    if (!route.includes('play')) continue;
    for (const file of list ?? []) files.add(file);
  }
  const buildManifestPath = join(NEXT, 'build-manifest.json');
  if (existsSync(buildManifestPath)) {
    const build = loadJson(buildManifestPath);
    for (const file of build.rootMainFiles ?? []) files.add(file);
    for (const file of build.lowPriorityFiles ?? []) files.add(file);
    const polyfill = build.polyfillFiles ?? [];
    for (const file of polyfill) files.add(file);
  }
  return [...files];
}

function stripRapierWasm(buf, path) {
  if (path.endsWith('.wasm')) return Buffer.alloc(0);
  if (buf.slice(0, 4).equals(WASM_MAGIC)) return Buffer.alloc(0);
  const text = buf.toString('utf8');
  if (!text.includes(WASM_B64) && !buf.includes(WASM_MAGIC)) return buf;
  let next = text;
  const b64 = /(?:[A-Za-z0-9+/]{80,}={0,2})/g;
  next = next.replace(b64, (chunk) => {
    if (!chunk.startsWith(WASM_B64) && !chunk.includes(WASM_B64)) return chunk;
    try {
      const decoded = Buffer.from(chunk, 'base64');
      if (decoded.slice(0, 4).equals(WASM_MAGIC)) return '';
    } catch {
      return chunk;
    }
    return chunk;
  });
  const raw = Buffer.from(next, 'utf8');
  const idx = raw.indexOf(WASM_MAGIC);
  if (idx < 0) return raw;
  // Drop an embedded wasm binary if a decoder left it as bytes.
  return Buffer.concat([raw.subarray(0, idx), raw.subarray(idx + 8)]);
}

function gzipBytes(buf) {
  if (buf.byteLength === 0) return 0;
  return gzipSync(buf, { level: 9 }).byteLength;
}

function resolveStatic(rel) {
  const cleaned = rel.replace(/^\//, '');
  const candidates = [
    join(NEXT, cleaned),
    join(NEXT, 'static', cleaned),
    join(WEB, cleaned),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

const rels = collectPlayFiles();
let jsCssGzip = 0;
let wasmGzip = 0;
const counted = [];
for (const rel of rels) {
  if (!/\.(js|css|wasm)$/.test(rel)) continue;
  const full = resolveStatic(rel);
  if (!full) continue;
  const raw = readFileSync(full);
  const stripped = stripRapierWasm(raw, full);
  const gz = gzipBytes(stripped);
  const wasmPart = gzipBytes(raw) - gz;
  jsCssGzip += gz;
  if (wasmPart > 0) wasmGzip += wasmPart;
  counted.push({ rel, gzip: gz, wasmGzip: wasmPart > 0 ? wasmPart : 0 });
}

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

if (!existsSync(BUDGET)) {
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
      files: counted.length,
    },
    null,
    2,
  ),
);
if (jsCssGzip > ceiling) {
  console.error(
    `play bundle gzip ${jsCssGzip} exceeds ceiling ${ceiling} (120% of ${baseline})`,
  );
  process.exit(1);
}
if (jsCssGzip === 0) {
  console.error('measured 0 bytes — play route chunks were not found');
  process.exit(1);
}
console.log(`ok: play JS+CSS gzip ${jsCssGzip} <= ${ceiling}`);
