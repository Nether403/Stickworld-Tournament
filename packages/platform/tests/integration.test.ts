import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyMigrations,
  createDb,
  createDirectPool,
  dailyBoards,
  gameBests,
  gameVersions,
  games,
  hasDatabaseUrl,
  rankingSnapshots,
  runs,
  scoreSubmissions,
  seasonGames,
  seasons,
  seedDatabase,
  verificationJobs,
  verifiedResults,
  type Database,
} from '@stickworld/db';
import { decodeReplay, encodeReplay } from '@stickworld/replay';
import { and, eq } from 'drizzle-orm';
import { claimHandle, upsertProfile } from '../src/profiles.js';
import { issueAttempt } from '../src/attempts.js';
import { finishAttempt } from '../src/finish.js';
import { processClaimedJob, processNextJob } from '../src/verify.js';
import { closeSeason, readLeaderboard, readStandings, recomputeSeason } from '../src/recompute.js';
import { rotateDaily } from '../src/daily.js';
import { packSeed, unpackSeed, uuidToBytes } from '../src/seed128.js';
import { floorWindow, hitRateLimit } from '../src/rate-limit.js';
import type { PlatformContext } from '../src/context.js';
import pg from 'pg';

const SAMPLE = readFileSync(
  resolve(fileURLToPath(import.meta.url), '../../../game-test-chamber/fixtures/sample.swr'),
);

function ctx(overrides: Partial<PlatformContext> = {}): PlatformContext {
  return {
    clock: { now: () => new Date() },
    entropy: { randomBytes: (n) => randomBytes(n) },
    secrets: { hmacSecret: 's'.repeat(32), hmacSecretPrev: '' },
    ...overrides,
  };
}

function goldenEntropy(): PlatformContext {
  let seedCalls = 0;
  return ctx({
    entropy: {
      randomBytes(n) {
        if (n === 16 && seedCalls++ === 0) return packSeed([5, 6, 7, 8]);
        return randomBytes(n);
      },
    },
  });
}

describe.skipIf(!hasDatabaseUrl())('platform integration', () => {
  let pool: pg.Pool;
  let db: Database;
  const c = ctx();

  beforeAll(async () => {
    await applyMigrations();
    await seedDatabase();
    pool = createDirectPool();
    db = createDb(pool);
    await db.update(seasons).set({ status: 'active' }).where(eq(seasons.slug, 'ci'));
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
  });

  it('refuses verified_results for an unverified run', async () => {
    const authUserId = `auth-${randomUUID()}`;
    const profile = await upsertProfile(db, authUserId);
    await claimHandle(db, c.clock, profile.userId, `u${randomUUID().slice(0, 8)}`);
    const issued = await issueAttempt(db, c, {
      userId: profile.userId,
      gameSlug: 'test-chamber',
      seedPolicy: 'fixed-course',
      ip: '127.0.0.1',
    });
    await expect(
      pool.query(
        `INSERT INTO verified_results (user_id, season_game_id, run_id, score, achieved_at)
         SELECT $1, season_game_id, $2, 1, now() FROM attempts WHERE id = $3`,
        [profile.userId, randomUUID(), issued.attemptId],
      ),
    ).rejects.toThrow(/verified_results require a verified submission|foreign key|violates/);
  });

  it('enforces unique handles and cooldown', async () => {
    const a = await upsertProfile(db, `auth-${randomUUID()}`);
    const b = await upsertProfile(db, `auth-${randomUUID()}`);
    const handle = `h${randomUUID().slice(0, 8)}`;
    expect(await claimHandle(db, c.clock, a.userId, handle)).toMatchObject({ status: 'ok' });
    expect(await claimHandle(db, c.clock, a.userId, handle)).toMatchObject({ status: 'noop' });
    await expect(claimHandle(db, c.clock, b.userId, handle)).rejects.toMatchObject({
      code: 'HANDLE_TAKEN',
    });
    await expect(claimHandle(db, c.clock, a.userId, `z${handle.slice(1)}`)).rejects.toMatchObject({
      code: 'HANDLE_COOLDOWN',
    });
  });

  it('rejects unauthenticated ranked issue at the profile gate', async () => {
    const { requireRankedUser } = await import('../src/profiles.js');
    await expect(requireRankedUser(db, undefined)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('refuses a degenerate all-zero seed', async () => {
    const profile = await upsertProfile(db, `auth-${randomUUID()}`);
    await claimHandle(db, c.clock, profile.userId, `s${randomUUID().slice(0, 8)}`);
    const zeros = ctx({
      entropy: { randomBytes: (n) => Buffer.alloc(n) },
    });
    await expect(
      issueAttempt(db, zeros, {
        userId: profile.userId,
        gameSlug: 'test-chamber',
        seedPolicy: 'fixed-course',
        ip: '10.0.0.8',
      }),
    ).rejects.toMatchObject({ code: 'SEED_DEGENERATE' });
  });

  it('trips the IP issue limiter', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const windowStart = floorWindow(now, 60_000);
    const key = `issue:ip:203.0.113.${randomUUID().slice(0, 4)}:m`;
    for (let i = 0; i < 30; i++) {
      await hitRateLimit(db, key, windowStart, 30);
    }
    await expect(hitRateLimit(db, key, windowStart, 30)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('verifies the Test Chamber golden replay and ranks it', async () => {
    const profile = await upsertProfile(db, `auth-${randomUUID()}`);
    await claimHandle(db, c.clock, profile.userId, `g${randomUUID().slice(0, 8)}`);
    const issueCtx = goldenEntropy();
    const issued = await issueAttempt(db, issueCtx, {
      userId: profile.userId,
      gameSlug: 'test-chamber',
      seedPolicy: 'fixed-course',
      ip: '10.0.0.2',
    });
    expect(issued.seed).toEqual([5, 6, 7, 8]);
    const decoded = await decodeReplay(SAMPLE);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const replay = await encodeReplay(
      { ...decoded.header, attemptId: uuidToBytes(issued.attemptId) },
      decoded.events,
    );
    const finished = await finishAttempt(db, issueCtx, {
      userId: profile.userId,
      attemptId: issued.attemptId,
      token: issued.token,
      replayB64: Buffer.from(replay).toString('base64'),
      claimedScore: '302',
    });
    expect(finished.status).toBe('pending');
    const processed = await processNextJob(db, issueCtx.clock, 'worker-1', { staleLockSeconds: 0 });
    expect(processed).toBe(true);
    const sub = await db
      .select()
      .from(scoreSubmissions)
      .where(eq(scoreSubmissions.runId, finished.runId))
      .then((r) => r[0]);
    expect(sub?.verificationStatus).toBe('verified');
    expect(sub?.verifiedScore).toBe(302n);
    expect(sub?.verifiedHash && Buffer.from(sub.verifiedHash).readBigUInt64LE(0).toString(16).padStart(16, '0')).toBe(
      'e6ee35729a0c77b3',
    );

    const season = await db.select().from(seasons).where(eq(seasons.slug, 'ci')).then((r) => r[0]);
    const sg = await db
      .select()
      .from(seasonGames)
      .where(eq(seasonGames.seedPolicy, 'fixed-course'))
      .then((r) => r[0]);
    await recomputeSeason(db, issueCtx.clock, season!.id, { force: true });
    const board = await readLeaderboard(db, season!.id, sg!.id, { viewerUserId: profile.userId });
    expect(board.viewer?.score).toBe('302');
    const page = await readLeaderboard(db, season!.id, sg!.id, {
      limit: 1,
      viewerUserId: profile.userId,
    });
    expect(page.rows.length).toBe(1);
    expect(page.viewer?.userId).toBe(profile.userId);
    const rebuilt = await loadOrderedThenRebuild(db, season!.id, sg!.id, issueCtx.clock);
    expect(rebuilt).toBe(true);
  });

  it('rejects an inflated claimed score', async () => {
    const profile = await upsertProfile(db, `auth-${randomUUID()}`);
    await claimHandle(db, c.clock, profile.userId, `i${randomUUID().slice(0, 8)}`);
    const issueCtx = goldenEntropy();
    const issued = await issueAttempt(db, issueCtx, {
      userId: profile.userId,
      gameSlug: 'test-chamber',
      seedPolicy: 'fixed-course',
      ip: '10.0.0.3',
    });
    const decoded = await decodeReplay(SAMPLE);
    if (!decoded.ok) throw new Error('fixture');
    const replay = await encodeReplay(
      { ...decoded.header, attemptId: uuidToBytes(issued.attemptId) },
      decoded.events,
    );
    const finished = await finishAttempt(db, issueCtx, {
      userId: profile.userId,
      attemptId: issued.attemptId,
      token: issued.token,
      replayB64: Buffer.from(replay).toString('base64'),
      claimedScore: '999999999',
    });
    await processNextJob(db, issueCtx.clock, 'worker-2', { staleLockSeconds: 0 });
    const sub = await db
      .select()
      .from(scoreSubmissions)
      .where(eq(scoreSubmissions.runId, finished.runId))
      .then((r) => r[0]);
    expect(sub?.verificationStatus).toBe('rejected');
    expect(sub?.reasonCode).toBe('SCORE_MISMATCH');
    const verified = await db.select().from(verifiedResults).where(eq(verifiedResults.runId, finished.runId));
    expect(verified).toHaveLength(0);
  });

  it('rejects expired, consumed, tampered, and wrong-user finishes', async () => {
    const a = await upsertProfile(db, `auth-${randomUUID()}`);
    const b = await upsertProfile(db, `auth-${randomUUID()}`);
    await claimHandle(db, c.clock, a.userId, `e${randomUUID().slice(0, 8)}`);
    await claimHandle(db, c.clock, b.userId, `w${randomUUID().slice(0, 8)}`);

    const start = new Date('2026-02-01T00:00:00.000Z');
    const issueCtx = {
      ...goldenEntropy(),
      clock: { now: () => start },
    };
    const issued = await issueAttempt(db, issueCtx, {
      userId: a.userId,
      gameSlug: 'test-chamber',
      seedPolicy: 'fixed-course',
      ip: '10.0.0.21',
    });
    const decoded = await decodeReplay(SAMPLE);
    if (!decoded.ok) throw new Error('fixture');
    const replay = await encodeReplay(
      { ...decoded.header, attemptId: uuidToBytes(issued.attemptId) },
      decoded.events,
    );
    const replayB64 = Buffer.from(replay).toString('base64');

    const expiredCtx = { ...issueCtx, clock: { now: () => new Date(start.getTime() + 16 * 60 * 1000) } };
    await expect(
      finishAttempt(db, expiredCtx, {
        userId: a.userId,
        attemptId: issued.attemptId,
        token: issued.token,
        replayB64,
        claimedScore: '302',
      }),
    ).rejects.toMatchObject({ code: 'ATTEMPT_EXPIRED' });

    const issued2 = await issueAttempt(db, goldenEntropy(), {
      userId: a.userId,
      gameSlug: 'test-chamber',
      seedPolicy: 'fixed-course',
      ip: '10.0.0.22',
    });
    const replay2 = await encodeReplay(
      { ...decoded.header, attemptId: uuidToBytes(issued2.attemptId) },
      decoded.events,
    );
    const b64 = Buffer.from(replay2).toString('base64');
    await expect(
      finishAttempt(db, c, {
        userId: a.userId,
        attemptId: issued2.attemptId,
        token: issued2.token.slice(0, -4) + 'aaaa',
        replayB64: b64,
        claimedScore: '302',
      }),
    ).rejects.toMatchObject({ code: 'TOKEN_INVALID' });

    await expect(
      finishAttempt(db, c, {
        userId: b.userId,
        attemptId: issued2.attemptId,
        token: issued2.token,
        replayB64: b64,
        claimedScore: '302',
      }),
    ).rejects.toMatchObject({ code: 'ATTEMPT_NOT_FOUND', internalCode: 'WRONG_USER' });

    await finishAttempt(db, c, {
      userId: a.userId,
      attemptId: issued2.attemptId,
      token: issued2.token,
      replayB64: b64,
      claimedScore: '302',
    });
    await expect(
      finishAttempt(db, c, {
        userId: a.userId,
        attemptId: issued2.attemptId,
        token: issued2.token,
        replayB64: b64,
        claimedScore: '302',
      }),
    ).rejects.toMatchObject({ code: 'ATTEMPT_CONSUMED' });
  });

  it('retries a stale lock without double-crediting', async () => {
    const profile = await upsertProfile(db, `auth-${randomUUID()}`);
    await claimHandle(db, c.clock, profile.userId, `k${randomUUID().slice(0, 8)}`);
    const issueCtx = goldenEntropy();
    const issued = await issueAttempt(db, issueCtx, {
      userId: profile.userId,
      gameSlug: 'test-chamber',
      seedPolicy: 'fixed-course',
      ip: '10.0.0.4',
    });
    const decoded = await decodeReplay(SAMPLE);
    if (!decoded.ok) throw new Error('fixture');
    const replay = await encodeReplay(
      { ...decoded.header, attemptId: uuidToBytes(issued.attemptId) },
      decoded.events,
    );
    const finished = await finishAttempt(db, issueCtx, {
      userId: profile.userId,
      attemptId: issued.attemptId,
      token: issued.token,
      replayB64: Buffer.from(replay).toString('base64'),
      claimedScore: '302',
    });
    const claimed = await db
      .update(verificationJobs)
      .set({ state: 'locked', lockedAt: new Date(0), lockedBy: 'dead' })
      .where(eq(verificationJobs.runId, finished.runId))
      .returning();
    expect(claimed[0]?.state).toBe('locked');
    await processNextJob(db, issueCtx.clock, 'worker-3', { staleLockSeconds: 0 });
    await processNextJob(db, issueCtx.clock, 'worker-4', { staleLockSeconds: 0 });
    const results = await db.select().from(verifiedResults).where(eq(verifiedResults.runId, finished.runId));
    expect(results).toHaveLength(1);
  });

  it('marks WORKER_FAULT after max claims', async () => {
    const profile = await upsertProfile(db, `auth-${randomUUID()}`);
    await claimHandle(db, c.clock, profile.userId, `f${randomUUID().slice(0, 8)}`);
    const issueCtx = goldenEntropy();
    const issued = await issueAttempt(db, issueCtx, {
      userId: profile.userId,
      gameSlug: 'test-chamber',
      seedPolicy: 'fixed-course',
      ip: '10.0.0.5',
    });
    const decoded = await decodeReplay(SAMPLE);
    if (!decoded.ok) throw new Error('fixture');
    const replay = await encodeReplay(
      { ...decoded.header, attemptId: uuidToBytes(issued.attemptId) },
      decoded.events,
    );
    const finished = await finishAttempt(db, issueCtx, {
      userId: profile.userId,
      attemptId: issued.attemptId,
      token: issued.token,
      replayB64: Buffer.from(replay).toString('base64'),
      claimedScore: '302',
    });
    const job = await db
      .select()
      .from(verificationJobs)
      .where(eq(verificationJobs.runId, finished.runId))
      .then((r) => r[0]);
    await processClaimedJob(
      db,
      issueCtx.clock,
      { jobId: job!.id, runId: finished.runId, attempts: 6 },
      { maxClaims: 5 },
    );
    const sub = await db
      .select()
      .from(scoreSubmissions)
      .where(eq(scoreSubmissions.runId, finished.runId))
      .then((r) => r[0]);
    expect(sub?.reasonCode).toBe('WORKER_FAULT');
    expect(await db.select().from(verifiedResults).where(eq(verifiedResults.runId, finished.runId))).toHaveLength(
      0,
    );
  });

  it('keeps a worse verified score from replacing a personal best', async () => {
    const profile = await upsertProfile(db, `auth-${randomUUID()}`);
    const sg = await db
      .select()
      .from(seasonGames)
      .where(eq(seasonGames.seedPolicy, 'fixed-course'))
      .then((r) => r[0]);
    await insertVerifiedBest(db, profile.userId, sg!.id, 500n);
    await insertVerifiedBest(db, profile.userId, sg!.id, 100n);
    const best = await db
      .select()
      .from(gameBests)
      .where(and(eq(gameBests.seasonGameId, sg!.id), eq(gameBests.userId, profile.userId)))
      .then((r) => r[0]);
    expect(best?.score).toBe(500n);
  });

  it('keeps daily verified runs off the championship snapshot', async () => {
    const { season, sg, dailySg } = await createIsolatedSeason(db, `iso-${randomUUID().slice(0, 8)}`);
    const profile = await upsertProfile(db, `auth-${randomUUID()}`);
    await insertVerifiedBest(db, profile.userId, sg.id, 100n);
    await recomputeSeason(db, c.clock, season.id, { force: true });
    const beforeSnap = await db
      .select()
      .from(rankingSnapshots)
      .where(
        and(
          eq(rankingSnapshots.seasonId, season.id),
          eq(rankingSnapshots.scope, 'championship'),
          eq(rankingSnapshots.frozen, false),
        ),
      )
      .then((r) => r[0]);
    const beforeBytes = JSON.stringify(beforeSnap?.payload ?? null);

    const dailyUser = await upsertProfile(db, `auth-${randomUUID()}`);
    await insertVerifiedBest(db, dailyUser.userId, dailySg.id, 999n);
    await recomputeSeason(db, c.clock, season.id, { force: true });
    const afterSnap = await db
      .select()
      .from(rankingSnapshots)
      .where(
        and(
          eq(rankingSnapshots.seasonId, season.id),
          eq(rankingSnapshots.scope, 'championship'),
          eq(rankingSnapshots.frozen, false),
        ),
      )
      .then((r) => r[0]);
    expect(JSON.stringify(afterSnap?.payload ?? null)).toBe(beforeBytes);
  });

  it('builds championship points at the 50-entrant gate, churns the tail, and freezes on close', async () => {
    const { season, sg } = await createIsolatedSeason(db, `gate-${randomUUID().slice(0, 8)}`);
    const userIds: string[] = [];
    for (let i = 0; i < 50; i++) {
      const profile = await upsertProfile(db, `gate-${i}-${randomUUID()}`);
      userIds.push(profile.userId);
      await insertVerifiedBest(db, profile.userId, sg.id, BigInt(1000 - i));
    }
    await recomputeSeason(db, c.clock, season.id, { force: true });
    const standings = await readStandings(db, season.id);
    expect(standings.provisional).toBe(false);
    expect(standings.rows[0]?.points).toBe(1000);
    const topPoints = standings.rows.map((row) => row.points);

    for (let i = 0; i < 10; i++) {
      const profile = await upsertProfile(db, `tail-${i}-${randomUUID()}`);
      await insertVerifiedBest(db, profile.userId, sg.id, 1n);
    }
    await recomputeSeason(db, c.clock, season.id, { force: true });
    const afterChurn = await readStandings(db, season.id);
    expect(afterChurn.rows.slice(0, 50).map((row) => row.points)).toEqual(topPoints);
    expect(afterChurn.rows.length).toBe(60);

    const page = await readLeaderboard(db, season.id, sg.id, {
      limit: 1,
      viewerUserId: userIds[userIds.length - 1],
    });
    expect(page.rows).toHaveLength(1);
    expect(page.viewer?.rank).toBe(50);

    await closeSeason(db, c.clock, season.id);
    const frozen = await db
      .select()
      .from(rankingSnapshots)
      .where(and(eq(rankingSnapshots.seasonId, season.id), eq(rankingSnapshots.frozen, true)));
    expect(frozen.some((row) => row.scope === 'championship')).toBe(true);
    const frozenBytes = JSON.stringify(frozen.find((row) => row.scope === 'championship')?.payload);
    const recomputed = await recomputeSeason(db, c.clock, season.id, { force: true });
    expect(recomputed).toBe(false);
    const stillFrozen = await db
      .select()
      .from(rankingSnapshots)
      .where(and(eq(rankingSnapshots.seasonId, season.id), eq(rankingSnapshots.frozen, true)));
    expect(JSON.stringify(stillFrozen.find((row) => row.scope === 'championship')?.payload)).toBe(
      frozenBytes,
    );
  }, 120_000);

  it('rotates the daily board, archives yesterday, and enforces the cap', async () => {
    const day1 = new Date('2026-08-18T12:00:00.000Z');
    await rotateDaily(db, { randomBytes: (n) => randomBytes(n) }, day1);
    const dailySg = await db
      .select()
      .from(seasonGames)
      .where(eq(seasonGames.seedPolicy, 'daily-seed'))
      .then((r) => r[0]);
    const todayBoard = await db
      .select()
      .from(dailyBoards)
      .where(and(eq(dailyBoards.seasonGameId, dailySg!.id), eq(dailyBoards.utcDate, '2026-08-18')))
      .then((r) => r[0]);
    expect(todayBoard).toBeTruthy();

    const day2 = new Date('2026-08-19T00:30:00.000Z');
    await rotateDaily(db, { randomBytes: (n) => randomBytes(n) }, day2);
    const yesterday = await db
      .select()
      .from(dailyBoards)
      .where(and(eq(dailyBoards.seasonGameId, dailySg!.id), eq(dailyBoards.utcDate, '2026-08-18')))
      .then((r) => r[0]);
    expect(yesterday?.archivedAt).toBeTruthy();
    const nextBoard = await db
      .select()
      .from(dailyBoards)
      .where(and(eq(dailyBoards.seasonGameId, dailySg!.id), eq(dailyBoards.utcDate, '2026-08-19')))
      .then((r) => r[0]);
    expect(nextBoard?.archivedAt).toBeNull();

    const profile = await upsertProfile(db, `auth-${randomUUID()}`);
    await claimHandle(db, { now: () => day2 }, profile.userId, `c${randomUUID().slice(0, 8)}`);
    const capCtx = ctx({ clock: { now: () => day2 } });
    const first = await issueAttempt(db, capCtx, {
      userId: profile.userId,
      gameSlug: 'test-chamber',
      seedPolicy: 'daily-seed',
      ip: '11.0.0.0',
    });
    expect(first.seed).toEqual([...unpackSeed(nextBoard!.seed)]);
    for (let i = 1; i < 5; i++) {
      await issueAttempt(db, capCtx, {
        userId: profile.userId,
        gameSlug: 'test-chamber',
        seedPolicy: 'daily-seed',
        ip: `11.0.0.${i}`,
      });
    }
    await expect(
      issueAttempt(db, capCtx, {
        userId: profile.userId,
        gameSlug: 'test-chamber',
        seedPolicy: 'daily-seed',
        ip: '11.0.0.9',
      }),
    ).rejects.toMatchObject({ code: 'DAILY_CAP' });
  });
});

async function loadOrderedThenRebuild(
  db: Database,
  seasonId: string,
  seasonGameId: string,
  clock: { now: () => Date },
): Promise<boolean> {
  const first = await readLeaderboard(db, seasonId, seasonGameId, {});
  await db.delete(rankingSnapshots).where(eq(rankingSnapshots.seasonId, seasonId));
  await recomputeSeason(db, clock, seasonId, { force: true });
  const second = await readLeaderboard(db, seasonId, seasonGameId, {});
  return JSON.stringify(first.rows) === JSON.stringify(second.rows);
}

async function createIsolatedSeason(
  db: Database,
  slug: string,
): Promise<{
  season: typeof seasons.$inferSelect;
  sg: typeof seasonGames.$inferSelect;
  dailySg: typeof seasonGames.$inferSelect;
}> {
  const [season] = await db
    .insert(seasons)
    .values({
      slug,
      startsAt: new Date('2020-01-01T00:00:00.000Z'),
      endsAt: new Date('2099-01-01T00:00:00.000Z'),
      status: 'active',
      rulesVersion: 1,
    })
    .returning();
  const game = await db.select().from(games).where(eq(games.slug, 'test-chamber')).then((r) => r[0]);
  const version = await db
    .select()
    .from(gameVersions)
    .where(eq(gameVersions.gameId, game!.id))
    .then((r) => r[0]);
  const [sg] = await db
    .insert(seasonGames)
    .values({
      seasonId: season!.id,
      gameId: game!.id,
      gameVersionId: version!.id,
      seedPolicy: 'fixed-course',
      activeFrom: new Date('2020-01-01T00:00:00.000Z'),
      activeTo: new Date('2099-01-01T00:00:00.000Z'),
    })
    .returning();
  const [dailySg] = await db
    .insert(seasonGames)
    .values({
      seasonId: season!.id,
      gameId: game!.id,
      gameVersionId: version!.id,
      seedPolicy: 'daily-seed',
      activeFrom: new Date('2020-01-01T00:00:00.000Z'),
      activeTo: new Date('2099-01-01T00:00:00.000Z'),
    })
    .returning();
  return { season: season!, sg: sg!, dailySg: dailySg! };
}

async function insertVerifiedBest(
  db: Database,
  userId: string,
  seasonGameId: string,
  score: bigint,
): Promise<void> {
  const sg = await db.select().from(seasonGames).where(eq(seasonGames.id, seasonGameId)).then((r) => r[0]);
  const attemptId = randomUUID();
  const runId = randomUUID();
  const { attempts } = await import('@stickworld/db');
  await db.insert(attempts).values({
    id: attemptId,
    userId,
    seasonGameId,
    gameVersionId: sg!.gameVersionId,
    seed: packSeed([1, 2, 3, 4]),
    nonce: randomBytes(16),
    expiresAt: new Date(Date.now() + 60_000),
    status: 'submitted',
    consumedAt: new Date(),
  });
  await db.insert(runs).values({
    id: runId,
    attemptId,
    userId,
    claimedScore: score,
    totalTicks: 1,
    replay: Buffer.from([1]),
    finalStateHash: Buffer.alloc(8),
  });
  await db.insert(scoreSubmissions).values({
    runId,
    verificationStatus: 'verified',
    verifiedScore: score,
    verifiedAt: new Date(),
  });
  const vr = await db
    .insert(verifiedResults)
    .values({
      userId,
      seasonGameId,
      runId,
      score,
      achievedAt: new Date(),
    })
    .returning();
  const existing = await db
    .select()
    .from(gameBests)
    .where(and(eq(gameBests.seasonGameId, seasonGameId), eq(gameBests.userId, userId)))
    .then((r) => r[0]);
  if (!existing) {
    await db.insert(gameBests).values({
      seasonGameId,
      userId,
      verifiedResultId: vr[0]!.id,
      score,
    });
    return;
  }
  if (existing.score < score) {
    await db
      .update(gameBests)
      .set({ verifiedResultId: vr[0]!.id, score })
      .where(and(eq(gameBests.seasonGameId, seasonGameId), eq(gameBests.userId, userId)));
  }
}
