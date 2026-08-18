import {
  DETMATH_VERSION,
  RAPIER_BUILD_SHA256,
  REPLAY_FORMAT_VERSION,
  SIM_CORE_VERSION,
} from '@stickworld/sim-core';
import { eq } from 'drizzle-orm';
import { createDirectPool, createDb, type Database } from './client.js';
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

export async function seedGame(
  db: Database,
  seasonId: string,
  opts: { slug: string; registryId: number; maxRunTicks: number },
  now = new Date(),
): Promise<void> {
  const far = new Date('2099-01-01T00:00:00.000Z');
  const past = new Date('2020-01-01T00:00:00.000Z');

  const [game] = await db
    .insert(games)
    .values({ slug: opts.slug, registryId: opts.registryId })
    .onConflictDoNothing()
    .returning();
  const gameRow =
    game ?? (await db.select().from(games).where(eq(games.slug, opts.slug)).then((r) => r[0]));
  if (!gameRow) throw new Error(`failed to seed game ${opts.slug}`);

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
      configJson: { maxRunTicks: opts.maxRunTicks },
      releasedAt: now,
    })
    .onConflictDoNothing()
    .returning();
  const versionRow =
    version ??
    (await db.select().from(gameVersions).where(eq(gameVersions.gameId, gameRow.id)).then((r) => r[0]));
  if (!versionRow) throw new Error(`failed to seed game_versions for ${opts.slug}`);

  for (const policy of ['fixed-course', 'daily-seed'] as const) {
    await db
      .insert(seasonGames)
      .values({
        seasonId,
        gameId: gameRow.id,
        gameVersionId: versionRow.id,
        seedPolicy: policy,
        activeFrom: past,
        activeTo: far,
      })
      .onConflictDoNothing();
  }
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

    await seedGame(db, seasonRow.id, { slug: 'test-chamber', registryId: 0, maxRunTicks: 600 }, now);
    await seedGame(db, seasonRow.id, { slug: 'hookline-sprint', registryId: 1, maxRunTicks: 5400 }, now);
    await seedGame(db, seasonRow.id, { slug: 'pickaxe-ascent', registryId: 2, maxRunTicks: 7200 }, now);

    const dailies = await db.select().from(seasonGames).where(eq(seasonGames.seedPolicy, 'daily-seed'));
    if (dailies.length === 0) throw new Error('failed to seed daily season_games');
    const today = utcDateString(now);
    for (const daily of dailies) {
      await db
        .insert(dailyBoards)
        .values({
          seasonGameId: daily.id,
          utcDate: today,
          seed: packSeed([9, 8, 7, daily.gameId.charCodeAt(0) ?? 6]),
        })
        .onConflictDoNothing();
    }
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
