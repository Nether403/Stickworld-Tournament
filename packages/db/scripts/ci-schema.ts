/**
 * CI helper: create a Neon branch, migrate, roll back, migrate, seed, test, delete.
 *
 * Requires NEON_API_KEY and NEON_PROJECT_ID.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiKey = process.env.NEON_API_KEY;
const projectId = process.env.NEON_PROJECT_ID;
if (!apiKey || !projectId) {
  throw new Error('NEON_API_KEY and NEON_PROJECT_ID are required');
}

const headers = {
  Authorization: `Bearer ${apiKey}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function neon<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://console.neon.tech/api/v2${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
  });
  if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const name = `ci/${process.env.GITHUB_SHA ?? Date.now()}`;
const created = await neon<{
  branch: { id: string };
  endpoints: { host: string }[];
  connection_uris?: { connection_uri: string }[];
}>(`/projects/${projectId}/branches`, {
  method: 'POST',
  body: JSON.stringify({
    branch: { name },
    endpoints: [{ type: 'read_write' }],
  }),
});

const branchId = created.branch.id;
try {
  let uri = created.connection_uris?.[0]?.connection_uri;
  if (!uri) {
    const cs = await neon<{ uri: string }>(
      `/projects/${projectId}/connection_uri?branch_id=${branchId}&pooled=false`,
    );
    uri = cs.uri;
  }
  if (!uri) throw new Error('no connection uri');
  process.env.DATABASE_URL_UNPOOLED = uri;
  process.env.DATABASE_URL = uri.includes('-pooler') ? uri : uri.replace('.c-', '-pooler.c-');
  const { applyMigrations, rollbackInitial } = await import('../src/migrate.ts');
  const { seedDatabase } = await import('../src/seed.ts');
  await applyMigrations(uri);
  await rollbackInitial(uri);
  await applyMigrations(uri);
  await seedDatabase();
  const env = { ...process.env };
  const dbTests = spawnSync(
    'pnpm',
    ['--filter', '@stickworld/db', 'exec', 'vitest', 'run', 'tests/schema.test.ts'],
    { cwd: root, stdio: 'inherit', env },
  );
  if (dbTests.status !== 0) throw new Error('schema tests failed');
  const platformTests = spawnSync(
    'pnpm',
    ['--filter', '@stickworld/platform', 'exec', 'vitest', 'run', 'tests/integration.test.ts'],
    { cwd: root, stdio: 'inherit', env },
  );
  if (platformTests.status !== 0) throw new Error('platform integration tests failed');
  console.log(`schema ok on branch ${branchId}`);
} finally {
  await neon(`/projects/${projectId}/branches/${branchId}`, { method: 'DELETE' });
}
