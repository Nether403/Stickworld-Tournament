import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertMigrationsCurrent,
  readMigrationManifest,
  type MigrationQueryClient,
} from '../src/index.js';

const temporaryFolders: string[] = [];

afterEach(() => {
  for (const folder of temporaryFolders.splice(0)) {
    rmSync(folder, { recursive: true, force: true });
  }
});

function migrationFolder(): {
  path: string;
  when: number;
  hash: string;
} {
  const path = mkdtempSync(join(tmpdir(), 'stickworld-migrations-'));
  temporaryFolders.push(path);
  mkdirSync(join(path, 'meta'));
  const when = 1_787_091_000_000;
  const sql = 'select 1;\n';
  writeFileSync(
    join(path, 'meta', '_journal.json'),
    JSON.stringify({
      version: '7',
      dialect: 'postgresql',
      entries: [{ idx: 0, version: '7', when, tag: '0000_test', breakpoints: true }],
    }),
  );
  writeFileSync(join(path, '0000_test.sql'), sql);
  return {
    path,
    when,
    hash: createHash('sha256').update(sql).digest('hex'),
  };
}

function client(rows: Array<{ hash: string; created_at: string }>): MigrationQueryClient {
  return {
    async query() {
      return { rows };
    },
  };
}

describe('migration startup guard', () => {
  it('reads journal entries and hashes their SQL files', () => {
    const fixture = migrationFolder();

    expect(readMigrationManifest(fixture.path)).toEqual([
      {
        tag: '0000_test',
        when: fixture.when,
        hash: fixture.hash,
      },
    ]);
  });

  it('accepts a database with every journal migration applied', async () => {
    const fixture = migrationFolder();

    await expect(
      assertMigrationsCurrent(
        client([{ hash: fixture.hash, created_at: String(fixture.when) }]),
        fixture.path,
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects startup when a journal migration is pending', async () => {
    const fixture = migrationFolder();

    await expect(assertMigrationsCurrent(client([]), fixture.path)).rejects.toThrow(
      'Pending database migrations: 0000_test',
    );
  });

  it('rejects startup when an applied migration hash differs', async () => {
    const fixture = migrationFolder();

    await expect(
      assertMigrationsCurrent(
        client([{ hash: 'changed', created_at: String(fixture.when) }]),
        fixture.path,
      ),
    ).rejects.toThrow('Migration history mismatch: 0000_test');
  });

  it('fails closed when the journal references a missing SQL file', () => {
    const fixture = migrationFolder();
    rmSync(join(fixture.path, '0000_test.sql'));

    expect(() => readMigrationManifest(fixture.path)).toThrow('0000_test.sql');
  });
});
