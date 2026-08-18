import {
  DETMATH_VERSION,
  RAPIER_BUILD_SHA256,
  REPLAY_FORMAT_VERSION,
  SIM_CORE_VERSION,
} from '@stickworld/sim-core';
import { eq } from 'drizzle-orm';
import { createDirectPool, createDb } from './client.js';
import { loadWorkspaceEnv } from './env.js';
import {
  dailyBoards,
  gameVersions,
  games,
  seasonGames,
  seasons,
} from './schema.js';

function packSeed(seed: readonly [number, number, number, number]): Buffer {
  const out = Buffer.alloc(16);
  out.writeUInt32LE(seed[0] >>> 0, 0);
  out.writeUInt32LE(seed[1] >>> 0, 4);
  out.writeUInt32LE(seed[2] >>> 0, 8);
  out.writeUInt32LE(seed[3] >>> 0, 12);
  return out;
}

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function seedDatabase(): Promise<void> {
  loadWorkspaceEnv();
  const pool = createDirectPool();
  const db = createDb(pool);
  try {
    const now = new Date();
    const far = new Date('2099-01-01T00:00:00.000Z');
    const past = new Date('2020-01-01T00:00:00.000Z');

    const [season] = await db
      .insert(seasons)
      .values({
        slug: 'ci',
        startsAt: past,
        endsAt: far,
        status: 'active',
        rulesVersion: 1,
      })
      .onConflictDoNothing()
      .returning();
    const seasonRow =
      season ?? (await db.select().from(seasons).where(eq(seasons.slug, 'ci')).then((r) => r[0]));
    if (!seasonRow) throw new Error('failed to seed season ci');

    const [game] = await db
      .insert(games)
      .values({ slug: 'test-chamber', registryId: 0 })
      .onConflictDoNothing()
      .returning();
    const gameRow =
      game ??
      (await db.select().from(games).where(eq(games.slug, 'test-chamber')).then((r) => r[0]));
    if (!gameRow) throw new Error('failed to seed game test-chamber');

    const [version] = await db
      .insert(gameVersions)
      .values({
        gameId: gameRow.id,
        gameVersion: '1.0.0',
        simulationVersion: SIM_CORE_VERSION,
        scoringVersion: 1,
        rapierBuildHash: RAPIER_BUILD_SHA256,
        detmathVersion: DETMATH_VERSION,
        replayFormatVersion: REPLAY_FORMAT_VERSION,
        configJson: { maxRunTicks: 600 },
        releasedAt: now,
      })
      .onConflictDoNothing()
      .returning();
    const versionRow =
      version ??
      (
        await db
          .select()
          .from(gameVersions)
          .where(eq(gameVersions.gameId, gameRow.id))
      )[0];
    if (!versionRow) throw new Error('failed to seed game_versions');

    for (const policy of ['fixed-course', 'daily-seed'] as const) {
      await db
        .insert(seasonGames)
        .values({
          seasonId: seasonRow.id,
          gameId: gameRow.id,
          gameVersionId: versionRow.id,
          seedPolicy: policy,
          activeFrom: past,
          activeTo: far,
        })
        .onConflictDoNothing();
    }

    const dailySg = (
      await db
        .select()
        .from(seasonGames)
        .where(eq(seasonGames.seedPolicy, 'daily-seed'))
    )[0];
    if (!dailySg) throw new Error('failed to seed daily season_games');

    const today = utcDateString(now);
    await db
      .insert(dailyBoards)
      .values({
        seasonGameId: dailySg.id,
        utcDate: today,
        seed: packSeed([9, 8, 7, 6]),
      })
      .onConflictDoNothing();
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
