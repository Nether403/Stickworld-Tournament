#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BANNED_HOSTS = ['generativelanguage.googleapis.com', 'api.deepgram.com', 'openrouter.ai'];

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

function exactHostPattern(host) {
  const escaped = host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9.-])${escaped}(?![A-Za-z0-9.-])`);
}

function main() {
  const root = rootFromArgs(process.argv.slice(2));
  const webBuild = join(root, 'apps/web/.next');
  if (!existsSync(webBuild)) {
    throw new Error('apps/web/.next is missing — run pnpm --filter @stickworld/web build first');
  }

  const buildRoots = [webBuild];
  const workerBuild = join(root, 'apps/worker/dist');
  if (existsSync(workerBuild)) buildRoots.push(workerBuild);

  const gamesRoot = join(root, 'games');
  if (existsSync(gamesRoot)) {
    for (const game of readdirSync(gamesRoot, { withFileTypes: true })) {
      if (!game.isDirectory()) continue;
      const build = join(gamesRoot, game.name, 'dist');
      if (existsSync(build)) buildRoots.push(build);
    }
  }

  const patterns = BANNED_HOSTS.map((host) => [host, exactHostPattern(host)]);
  const hits = [];
  let fileCount = 0;
  for (const buildRoot of buildRoots) {
    for (const file of listFiles(buildRoot)) {
      fileCount += 1;
      const contents = readFileSync(file).toString('utf8');
      for (const [host, pattern] of patterns) {
        if (pattern.test(contents)) {
          hits.push(`${relative(root, file).replaceAll('\\', '/')}: banned runtime host ${host}`);
        }
      }
    }
  }

  if (hits.length) {
    console.error(hits.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`ok: scanned ${fileCount} built files, no runtime AI hosts`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
