import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function applyEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function loadWorkspaceEnv(): void {
  applyEnvFile(resolve(here, '../../../.env.local'));
  applyEnvFile(resolve(here, '../../../.env'));
  applyEnvFile(resolve(process.cwd(), '.env.local'));
  applyEnvFile(resolve(process.cwd(), '.env'));
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function hasDatabaseUrl(): boolean {
  loadWorkspaceEnv();
  return Boolean(process.env.DATABASE_URL_UNPOOLED);
}
