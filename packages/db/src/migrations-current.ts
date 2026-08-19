import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export interface MigrationQueryClient {
  query(
    text: string,
  ): Promise<{ rows: Array<{ hash: string; created_at: string | number | bigint }> }>;
}

export interface MigrationManifestEntry {
  tag: string;
  when: number;
  hash: string;
}

interface Journal {
  entries?: Array<{ tag?: unknown; when?: unknown }>;
}

export function readMigrationManifest(
  migrationsFolder = resolve(here, '../drizzle'),
): MigrationManifestEntry[] {
  const journalPath = resolve(migrationsFolder, 'meta/_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
  if (!Array.isArray(journal.entries)) {
    throw new Error(`Invalid Drizzle migration journal: ${journalPath}`);
  }

  return journal.entries.map((entry) => {
    if (typeof entry.tag !== 'string' || typeof entry.when !== 'number') {
      throw new Error(`Invalid Drizzle migration journal entry: ${journalPath}`);
    }
    const migrationPath = resolve(migrationsFolder, `${entry.tag}.sql`);
    const migrationSql = readFileSync(migrationPath, 'utf8');
    return {
      tag: entry.tag,
      when: entry.when,
      hash: createHash('sha256').update(migrationSql).digest('hex'),
    };
  });
}

export async function assertMigrationsCurrent(
  client: MigrationQueryClient,
  migrationsFolder = resolve(here, '../drizzle'),
): Promise<void> {
  const expected = readMigrationManifest(migrationsFolder);
  const result = await client.query(
    'SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at ASC',
  );
  const applied = new Map(
    result.rows.map((row) => [Number(row.created_at), String(row.hash)] as const),
  );

  const pending = expected.filter((entry) => !applied.has(entry.when));
  if (pending.length > 0) {
    throw new Error(`Pending database migrations: ${pending.map((entry) => entry.tag).join(', ')}`);
  }

  const mismatched = expected.filter((entry) => applied.get(entry.when) !== entry.hash);
  if (mismatched.length > 0) {
    throw new Error(
      `Migration history mismatch: ${mismatched.map((entry) => entry.tag).join(', ')}`,
    );
  }
}
