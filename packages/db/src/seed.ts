import {
  DETMATH_VERSION,
  RAPIER_BUILD_SHA256,
  REPLAY_FORMAT_VERSION,
  SIM_CORE_VERSION,
} from '@stickworld/sim-core';
import { eq } from 'drizzle-orm';
import { createDirectPool, createDb, type Database } from './client.js';
import { loadWorkspaceEnv } from './env.js';
import { dailyBoards, gameVersions, games, rankedInvites, seasonGames, seasons } from './schema.js';

type SeedPolicy = 'fixed-course' | 'daily-seed' | 'weekly-seed';
type InviteSeasonSlug = 'internal-0' | 'beta-0';
type SeedWriter = Pick<Database, 'delete' | 'insert' | 'select'>;

export interface GameSeedPlan {
  slug: string;
  registryId: number;
  maxRunTicks: number;
  seedPolicies: readonly SeedPolicy[];
}

export interface SeasonSeedPlan {
  season: {
    slug: string;
    startsAt: Date;
    endsAt: Date;
    status: 'active';
    rulesVersion: number;
    entryPolicy: 'invite' | 'open';
  };
  inviteEmails: readonly string[];
  games: readonly GameSeedPlan[];
}

const CHAMPIONSHIP_GAMES: readonly GameSeedPlan[] = [
  {
    slug: 'hookline-sprint',
    registryId: 1,
    maxRunTicks: 5400,
    seedPolicies: ['fixed-course', 'daily-seed'],
  },
  {
    slug: 'pickaxe-ascent',
    registryId: 2,
    maxRunTicks: 7200,
    seedPolicies: ['fixed-course', 'daily-seed'],
  },
  {
    slug: 'launch-lab',
    registryId: 3,
    maxRunTicks: 5400,
    seedPolicies: ['fixed-course', 'daily-seed'],
  },
  {
    slug: 'ragdoll-archery-rush',
    registryId: 4,
    maxRunTicks: 5400,
    seedPolicies: ['fixed-course', 'daily-seed'],
  },
  {
    slug: 'hammer-throw-havoc',
    registryId: 5,
    maxRunTicks: 5400,
    seedPolicies: ['fixed-course', 'daily-seed'],
  },
  {
    slug: 'rooftop-relay',
    registryId: 7,
    maxRunTicks: 9000,
    seedPolicies: ['fixed-course', 'daily-seed'],
  },
  {
    slug: 'balance-bike-blitz',
    registryId: 8,
    maxRunTicks: 9000,
    seedPolicies: ['fixed-course', 'daily-seed'],
  },
  {
    slug: 'cargo-chaos',
    registryId: 9,
    maxRunTicks: 9000,
    seedPolicies: ['fixed-course', 'daily-seed'],
  },
  {
    slug: 'demolition-dive',
    registryId: 10,
    maxRunTicks: 5400,
    seedPolicies: ['fixed-course', 'daily-seed'],
  },
];

const POGO_LAUNCH_GAME: GameSeedPlan = {
  slug: 'pogo-tower',
  registryId: 6,
  maxRunTicks: 7200,
  seedPolicies: ['weekly-seed'],
};

const CI_GAMES: readonly GameSeedPlan[] = [
  {
    slug: 'test-chamber',
    registryId: 0,
    maxRunTicks: 600,
    seedPolicies: ['fixed-course', 'daily-seed', 'weekly-seed'],
  },
  ...CHAMPIONSHIP_GAMES.slice(0, 5),
  { ...POGO_LAUNCH_GAME, seedPolicies: ['weekly-seed', 'daily-seed'] },
  ...CHAMPIONSHIP_GAMES.slice(5),
];

const LAUNCH_GAMES: readonly GameSeedPlan[] = [
  ...CHAMPIONSHIP_GAMES.slice(0, 5),
  POGO_LAUNCH_GAME,
  ...CHAMPIONSHIP_GAMES.slice(5),
];

const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function isoWeekMonday(d: Date): string {
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return utcDateString(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offset)),
  );
}

function normaliseInviteEmails(inviteEmails: readonly string[]): string[] {
  const normalised = inviteEmails.map((email) => email.trim().toLowerCase());
  for (const [index, email] of normalised.entries()) {
    if (!EMAIL_PATTERN.test(email)) throw new Error(`invalid invite email at index ${index + 1}`);
  }
  if (new Set(normalised).size !== normalised.length) {
    throw new Error('duplicate invite email');
  }
  return normalised;
}

export function parseInviteEmails(contents: string): string[] {
  return normaliseInviteEmails(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#')),
  );
}

export function buildCiSeasonSeedPlan(): SeasonSeedPlan {
  return {
    season: {
      slug: 'ci',
      startsAt: new Date('2020-01-01T00:00:00.000Z'),
      endsAt: new Date('2099-01-01T00:00:00.000Z'),
      status: 'active',
      rulesVersion: 1,
      entryPolicy: 'open',
    },
    inviteEmails: [],
    games: CI_GAMES,
  };
}

export function buildInviteSeasonSeedPlan(input: {
  slug: string;
  startsAt: Date;
  inviteEmails: readonly string[];
}): SeasonSeedPlan {
  if (input.slug !== 'internal-0' && input.slug !== 'beta-0') {
    throw new Error('supported slugs are internal-0 and beta-0');
  }
  if (!Number.isFinite(input.startsAt.getTime())) throw new Error('startsAt must be a valid date');

  const slug: InviteSeasonSlug = input.slug;
  const inviteEmails = normaliseInviteEmails(input.inviteEmails);
  if (slug === 'internal-0' && inviteEmails.length === 0) {
    throw new Error('internal-0 requires at least one staff invite email');
  }
  if (slug === 'beta-0' && inviteEmails.length !== 24) {
    throw new Error('beta-0 requires exactly 24 unique invite emails');
  }
  const durationDays = slug === 'beta-0' ? 14 : 7;

  return {
    season: {
      slug,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.startsAt.getTime() + durationDays * DAY_MS),
      status: 'active',
      rulesVersion: 2,
      entryPolicy: 'invite',
    },
    inviteEmails,
    games: LAUNCH_GAMES,
  };
}

export async function seedGame(
  db: SeedWriter,
  seasonId: string,
  opts: {
    slug: string;
    registryId: number;
    maxRunTicks: number;
    seedPolicies?: readonly SeedPolicy[];
    activeFrom?: Date;
    activeTo?: Date;
  },
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
    game ??
    (await db
      .select()
      .from(games)
      .where(eq(games.slug, opts.slug))
      .then((r) => r[0]));
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
    (await db
      .select()
      .from(gameVersions)
      .where(eq(gameVersions.gameId, gameRow.id))
      .then((r) => r[0]));
  if (!versionRow) throw new Error(`failed to seed game_versions for ${opts.slug}`);

  const policies = opts.seedPolicies ?? (['fixed-course', 'daily-seed'] as const);
  for (const policy of policies) {
    await db
      .insert(seasonGames)
      .values({
        seasonId,
        gameId: gameRow.id,
        gameVersionId: versionRow.id,
        seedPolicy: policy,
        activeFrom: opts.activeFrom ?? past,
        activeTo: opts.activeTo ?? far,
      })
      .onConflictDoNothing();
  }
}

function sameSeasonConfiguration(
  actual: typeof seasons.$inferSelect,
  expected: SeasonSeedPlan['season'],
): boolean {
  return (
    actual.startsAt.getTime() === expected.startsAt.getTime() &&
    actual.endsAt.getTime() === expected.endsAt.getTime() &&
    actual.status === expected.status &&
    actual.rulesVersion === expected.rulesVersion &&
    actual.entryPolicy === expected.entryPolicy
  );
}

async function seedSeasonPlan(db: SeedWriter, plan: SeasonSeedPlan, now: Date): Promise<void> {
  const [insertedSeason] = await db
    .insert(seasons)
    .values(plan.season)
    .onConflictDoNothing()
    .returning();
  const season =
    insertedSeason ??
    (await db
      .select()
      .from(seasons)
      .where(eq(seasons.slug, plan.season.slug))
      .then((rows) => rows[0]));
  if (!season) throw new Error(`failed to seed season ${plan.season.slug}`);
  if (plan.season.slug !== 'ci' && !sameSeasonConfiguration(season, plan.season)) {
    throw new Error(`season ${plan.season.slug} already exists with different configuration`);
  }

  for (const game of plan.games) {
    await seedGame(
      db,
      season.id,
      {
        ...game,
        activeFrom: plan.season.startsAt,
        activeTo: plan.season.endsAt,
      },
      now,
    );
  }

  if (plan.season.entryPolicy === 'invite') {
    await db.delete(rankedInvites);
    await db
      .insert(rankedInvites)
      .values(plan.inviteEmails.map((email) => ({ email, invitedAt: now })));
  }

  const seededSeasonGames = await db
    .select()
    .from(seasonGames)
    .where(eq(seasonGames.seasonId, season.id));
  const dailies = seededSeasonGames.filter((row) => row.seedPolicy === 'daily-seed');
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

  const weeklies = seededSeasonGames.filter((row) => row.seedPolicy === 'weekly-seed');
  const monday = isoWeekMonday(now);
  for (const weekly of weeklies) {
    await db
      .insert(dailyBoards)
      .values({
        seasonGameId: weekly.id,
        utcDate: monday,
        seed: packSeed([4, 5, 6, weekly.gameId.charCodeAt(0) ?? 6]),
      })
      .onConflictDoNothing();
  }
}

export async function seedInviteSeason(
  db: Database,
  input: {
    slug: string;
    startsAt: Date;
    inviteEmails: readonly string[];
  },
  now = new Date(),
): Promise<void> {
  const plan = buildInviteSeasonSeedPlan(input);
  await db.transaction(async (tx) => seedSeasonPlan(tx, plan, now));
}

export async function seedDatabase(): Promise<void> {
  loadWorkspaceEnv();
  const pool = createDirectPool();
  const db = createDb(pool);
  try {
    const now = new Date();
    await db.transaction(async (tx) => seedSeasonPlan(tx, buildCiSeasonSeedPlan(), now));
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
