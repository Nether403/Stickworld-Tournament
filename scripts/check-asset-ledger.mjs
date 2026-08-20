#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_ASSETS = 'apps/web/public/assets';
const LEDGER = 'docs/assets/ledger.md';
const CLASSES = new Set(['human', 'generated', 'generated-then-human-edited']);

function rootFromArgs(args) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex === -1) return DEFAULT_ROOT;
  if (!args[rootIndex + 1]) throw new Error('--root requires a directory');
  return args[rootIndex + 1];
}

function listFiles(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) listFiles(path, files);
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function parseLedger(markdown) {
  const table = markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('|'))
    .map((line) =>
      line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );
  const header = table.findIndex((row) => row[0] === 'path' && row[1] === 'sha256');
  if (header === -1) throw new Error(`ledger table must contain path and sha256 columns`);

  return table
    .slice(header + 2)
    .filter((row) => row.some(Boolean))
    .map((row) => ({
      path: row[0] ?? '',
      sha256: row[1] ?? '',
      className: row[2] ?? '',
      promptId: row[3] ?? '',
      notes: row[4] ?? '',
    }));
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function main() {
  const root = rootFromArgs(process.argv.slice(2));
  const assetRoot = join(root, PUBLIC_ASSETS);
  const ledgerPath = join(root, LEDGER);
  if (!existsSync(assetRoot)) throw new Error(`${PUBLIC_ASSETS} is missing`);
  if (!existsSync(ledgerPath)) throw new Error(`${LEDGER} is missing`);

  const entries = parseLedger(readFileSync(ledgerPath, 'utf8'));
  const listed = new Set();
  const errors = [];

  for (const entry of entries) {
    if (!entry.path.startsWith(`${PUBLIC_ASSETS}/`)) {
      errors.push(`invalid ledger path: ${entry.path || '(empty)'}`);
      continue;
    }
    if (listed.has(entry.path)) {
      errors.push(`duplicate ledger path: ${entry.path}`);
      continue;
    }
    listed.add(entry.path);
    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) {
      errors.push(`invalid SHA-256 for ${entry.path}`);
    }
    if (!CLASSES.has(entry.className)) {
      errors.push(`invalid class for ${entry.path}: ${entry.className || '(empty)'}`);
    }
    if (entry.className === 'human' && entry.promptId) {
      errors.push(`human asset must have a null prompt_id: ${entry.path}`);
    }
    if (entry.className !== 'human' && !entry.promptId) {
      errors.push(`generated asset must have a prompt_id: ${entry.path}`);
    }

    const fullPath = join(root, entry.path);
    if (!existsSync(fullPath)) {
      errors.push(`listed asset is missing: ${entry.path}`);
      continue;
    }
    const actual = sha256(fullPath);
    if (actual !== entry.sha256) {
      errors.push(`hash mismatch for ${entry.path}: expected ${entry.sha256}, got ${actual}`);
    }
  }

  const publicFiles = listFiles(assetRoot)
    .map((path) => relative(root, path).replaceAll('\\', '/'))
    .sort();
  for (const path of publicFiles) {
    if (!listed.has(path)) errors.push(`unlisted asset: ${path}`);
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`ok: verified ${publicFiles.length} asset${publicFiles.length === 1 ? '' : 's'}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
