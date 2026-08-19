import {
  attempts,
  dailyBoards,
  gameVersions,
  games,
  profiles,
  rankedInvites,
  seasonGames,
  seasons,
  type Database,
} from '@stickworld/db';
import { and, asc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { audit } from './audit.js';
import { signAttemptToken } from './attempt-token.js';
import type { PlatformContext } from './context.js';
import { ApiError } from './errors.js';
import {
  ATTEMPT_TTL_SECONDS,
  DAILY_ATTEMPT_CAP,
  ISSUE_RATE_IP_PER_MIN,
  ISSUE_RATE_USER_PER_HOUR,
  ISSUE_RATE_USER_PER_MIN,
} from './limits.js';
import { floorWindow, hitRateLimit } from './rate-limit.js';
import { isDegenerateSeed, packSeed, seedFromBytes, unpackSeed, type Seed128 } from './seed128.js';
import { isoWeekMonday } from './daily.js';

export interface IssueInput {
  userId: string;
  gameSlug: string;
  seedPolicy: 'fixed-course' | 'daily-seed' | 'weekly-seed';
  ip: string;
  email?: string | null;
}

export interface IssueResult {
  attemptId: string;
  seed: [number, number, number, number];
  gameId: string;
  gameVersion: string;
  seasonId: string;
  expiresAt: string;
  token: string;
  dailyCapRemaining: number;
}

async function dailyCount(
  db: Database,
  userId: string,
  seasonGameId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.seasonGameId, seasonGameId),
        gte(attempts.issuedAt, dayStart),
        lt(attempts.issuedAt, dayEnd),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}

export async function issueAttempt(
  db: Database,
  ctx: PlatformContext,
  input: IssueInput,
): Promise<IssueResult> {
  const now = ctx.clock.now();
  try {
    await hitRateLimit(
      db,
      `issue:user:${input.userId}:m`,
      floorWindow(now, 60_000),
      ISSUE_RATE_USER_PER_MIN,
    );
    await hitRateLimit(
      db,
      `issue:user:${input.userId}:h`,
      floorWindow(now, 3_600_000),
      ISSUE_RATE_USER_PER_HOUR,
    );
    await hitRateLimit(
      db,
      `issue:ip:${input.ip}:m`,
      floorWindow(now, 60_000),
      ISSUE_RATE_IP_PER_MIN,
    );

    const game = await db
      .select()
      .from(games)
      .where(eq(games.slug, input.gameSlug))
      .then((r) => r[0]);
    if (!game) throw new ApiError('SEASON_INACTIVE');

    const sg = await db
      .select()
      .from(seasonGames)
      .innerJoin(seasons, eq(seasonGames.seasonId, seasons.id))
      .where(
        and(
          eq(seasonGames.gameId, game.id),
          eq(seasonGames.seedPolicy, input.seedPolicy),
          eq(seasons.status, 'active'),
        ),
      )
      .orderBy(asc(seasons.slug))
      .then((r) => r[0]);
    if (!sg) throw new ApiError('SEASON_INACTIVE');
    if (now < sg.season_games.activeFrom || now > sg.season_games.activeTo) {
      throw new ApiError('SEASON_INACTIVE');
    }

    let invite: typeof rankedInvites.$inferSelect | undefined;
    if (sg.seasons.entryPolicy === 'invite') {
      const profile = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, input.userId))
        .then((rows) => rows[0]);
      if (profile?.role !== 'moderator') {
        const inviteEmail = profile?.email ?? input.email;
        if (!inviteEmail) throw new ApiError('NOT_INVITED');
        invite = await db
          .select()
          .from(rankedInvites)
          .where(eq(rankedInvites.email, inviteEmail))
          .then((rows) => rows[0]);
        if (!invite) throw new ApiError('NOT_INVITED');
      }
    }

    const version = await db
      .select()
      .from(gameVersions)
      .where(eq(gameVersions.id, sg.season_games.gameVersionId))
      .then((r) => r[0]);
    if (!version) throw new ApiError('WRONG_VERSION');

    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const used = await dailyCount(db, input.userId, sg.season_games.id, dayStart, dayEnd);
    const remaining = Math.max(0, DAILY_ATTEMPT_CAP - used);
    if (remaining <= 0) throw new ApiError('DAILY_CAP');

    let seed: Seed128;
    if (input.seedPolicy === 'daily-seed' || input.seedPolicy === 'weekly-seed') {
      const utc =
        input.seedPolicy === 'weekly-seed' ? isoWeekMonday(now) : now.toISOString().slice(0, 10);
      const board = await db
        .select()
        .from(dailyBoards)
        .where(and(eq(dailyBoards.seasonGameId, sg.season_games.id), eq(dailyBoards.utcDate, utc)))
        .then((r) => r[0]);
      if (!board || board.archivedAt) throw new ApiError('SEASON_INACTIVE');
      seed = unpackSeed(board.seed);
    } else {
      let next = seedFromBytes(ctx.entropy.randomBytes(16));
      let spins = 0;
      while (isDegenerateSeed(next)) {
        spins += 1;
        if (spins > 8) throw new ApiError('SEED_DEGENERATE');
        next = seedFromBytes(ctx.entropy.randomBytes(16));
      }
      seed = next;
    }

    const nonce = Buffer.from(ctx.entropy.randomBytes(16));
    const attemptId = randomUUID();
    const expiresAt = new Date(now.getTime() + ATTEMPT_TTL_SECONDS * 1000);
    await db.transaction(async (tx) => {
      const lockedSeason = await tx
        .select({ status: seasons.status })
        .from(seasons)
        .where(eq(seasons.id, sg.seasons.id))
        .for('update')
        .then((rows) => rows[0]);
      if (lockedSeason?.status !== 'active') throw new ApiError('SEASON_INACTIVE');

      await tx.insert(attempts).values({
        id: attemptId,
        userId: input.userId,
        seasonGameId: sg.season_games.id,
        gameVersionId: version.id,
        seed: packSeed(seed),
        nonce,
        issuedAt: now,
        expiresAt,
        status: 'issued',
      });
      if (invite) {
        await tx
          .update(rankedInvites)
          .set({ consumedAt: now, consumedUserId: input.userId })
          .where(and(eq(rankedInvites.email, invite.email), isNull(rankedInvites.consumedAt)));
      }
    });
    const token = signAttemptToken(
      {
        attemptId,
        userId: input.userId,
        gameVersionId: version.id,
        exp: Math.floor(expiresAt.getTime() / 1000),
      },
      ctx.secrets.hmacSecret,
    );
    await audit(db, { actor: input.userId, action: 'attempt.issue', target: attemptId });
    return {
      attemptId,
      seed: [seed[0], seed[1], seed[2], seed[3]],
      gameId: game.slug,
      gameVersion: version.gameVersion,
      seasonId: sg.seasons.id,
      expiresAt: expiresAt.toISOString(),
      token,
      dailyCapRemaining: remaining - 1,
    };
  } catch (err) {
    if (err instanceof ApiError) {
      await audit(db, {
        actor: input.userId,
        action: 'attempt.issue.rejected',
        target: input.gameSlug,
        reason: err.internalCode,
      });
      throw err;
    }
    throw err;
  }
}

export { leakSafe } from './errors.js';
