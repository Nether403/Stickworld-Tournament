import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { applyMigrations, createDirectPool, hasDatabaseUrl, seedDatabase } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));

it('declares the Spec 5 compliance migration', () => {
  const migration = readFileSync(resolve(here, '../drizzle/0002_spec5_compliance.sql'), 'utf8');
  expect(migration).toContain('ALTER TYPE "profile_status" ADD VALUE IF NOT EXISTS \'anonymised\'');
  expect(migration).toContain('CREATE TABLE "ugc_reports"');
  expect(migration).toContain('CREATE TABLE "moderation_actions"');
  expect(migration).toContain('CREATE TABLE "ranked_invites"');
  expect(migration).toContain('"entry_policy" "season_entry_policy" DEFAULT \'open\' NOT NULL');
  expect(migration).toContain('"role" "profile_role" DEFAULT \'player\' NOT NULL');
});

describe.skipIf(!hasDatabaseUrl())('schema', () => {
  it('migrates, seeds, and refuses an unverified verified_results row', async () => {
    await applyMigrations();
    await seedDatabase();
    const pool = createDirectPool();
    try {
      const games = await pool.query(
        `SELECT slug, registry_id FROM games WHERE slug = 'test-chamber'`,
      );
      expect(games.rows[0]).toMatchObject({ slug: 'test-chamber', registry_id: 0 });
      const down = readFileSync(resolve(here, '../drizzle/0000_init.down.sql'), 'utf8');
      expect(down).toContain('DROP TABLE IF EXISTS verified_results');
      await expect(
        pool.query(
          `INSERT INTO verified_results (user_id, season_game_id, run_id, score, achieved_at)
           VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 1, now())`,
        ),
      ).rejects.toThrow();
    } finally {
      await pool.end();
    }
  });
});
