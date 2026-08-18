import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

function loadEnv(): void {
  for (const path of [resolve('../../.env.local'), resolve('.env.local')]) {
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadEnv();
const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error('DATABASE_URL_UNPOOLED is required for drizzle-kit');

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
