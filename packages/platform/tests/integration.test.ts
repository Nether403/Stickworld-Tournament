import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyMigrations,
  attempts,
  auditEvents,
  createDb,
  createDirectPool,
  dailyBoards,
  gameBests,
  gameVersions,
  games,
  hasDatabaseUrl,
  moderationActions,
  profiles,
  rankedInvites,
  rankingDirty,
  rankingSnapshots,
  runs,
  scoreSubmissions,
  seasonGames,
  seasons,
  seedDatabase,
  seedGame,
  ugcReports,
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
import {
  fileReport,
  listModerationReports,
  listUserNotices,
  moderateReport,
} from '../src/moderation.js';
import { anonymiseProfile, exportUserData } from '../src/privacy.js';
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

async function replayForAttempt(attemptId: string): Promise<Buffer> {
  const decoded = await decodeReplay(SAMPLE);
  if (!decoded.ok) throw new Error('invalid sample fixture');
  return Buffer.from(
    await encodeReplay({ ...decoded.header, attemptId: uuidToBytes(attemptId) }, decoded.events),
  );
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
    await expect(requireRankedUser(db, undefined)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('requires active status at the ranked profile gate', async () => {
    const { requireRankedUser } = await import('../src/profiles.js');
    const authUserId = `ranked-status-${randomUUID()}`;
    const profile = await upsertProfile(db, authUserId);
    await claimHandle(db, c.clock, profile.userId, `a${randomUUID().slice(0, 8)}`);
    for (const status of ['suspended', 'anonymised'] as const) {
      await db.update(profiles).set({ status }).where(eq(profiles.userId, profile.userId));
      await expect(requireRankedUser(db, authUserId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
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
    expect(
      sub?.verifiedHash &&
        Buffer.from(sub.verifiedHash).readBigUInt64LE(0).toString(16).padStart(16, '0'),
    ).toBe('e6ee35729a0c77b3');

    const season = await db
      .select()
      .from(seasons)
      .where(eq(seasons.slug, 'ci'))
      .then((r) => r[0]);
    const sg = await db
      .select({ id: seasonGames.id })
      .from(seasonGames)
      .innerJoin(games, eq(games.id, seasonGames.gameId))
      .where(and(eq(games.slug, 'test-chamber'), eq(seasonGames.seedPolicy, 'fixed-course')))
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
    const verified = await db
      .select()
      .from(verifiedResults)
      .where(eq(verifiedResults.runId, finished.runId));
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

    await db
      .update(attempts)
      .set({ expiresAt: new Date(start.getTime() + 60_000) })
      .where(eq(attempts.id, issued.attemptId));
    const expiredCtx = {
      ...issueCtx,
      clock: { now: () => new Date(start.getTime() + 2 * 60 * 1000) },
    };
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
    const results = await db
      .select()
      .from(verifiedResults)
      .where(eq(verifiedResults.runId, finished.runId));
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
    expect(
      await db.select().from(verifiedResults).where(eq(verifiedResults.runId, finished.runId)),
    ).toHaveLength(0);
  });

  it('keeps a worse verified score from replacing a personal best', async () => {
    const profile = await upsertProfile(db, `auth-${randomUUID()}`);
    const sg = await db
      .select({ id: seasonGames.id })
      .from(seasonGames)
      .innerJoin(games, eq(games.id, seasonGames.gameId))
      .where(and(eq(games.slug, 'test-chamber'), eq(seasonGames.seedPolicy, 'fixed-course')))
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
    const { season, sg, dailySg } = await createIsolatedSeason(
      db,
      `iso-${randomUUID().slice(0, 8)}`,
    );
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

  it('keeps weekly verified runs off the championship snapshot', async () => {
    const { season, sg, weeklySg } = await createIsolatedSeason(
      db,
      `iso-w-${randomUUID().slice(0, 8)}`,
    );
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

    const weeklyUser = await upsertProfile(db, `auth-${randomUUID()}`);
    await insertVerifiedBest(db, weeklyUser.userId, weeklySg.id, 999n);
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

  it('serves frozen rankings and overlays anonymised handles without changing snapshot bytes', async () => {
    const { season, sg } = await createIsolatedSeason(
      db,
      `frozen-read-${randomUUID().slice(0, 8)}`,
    );
    const profile = await upsertProfile(db, `frozen-read-${randomUUID()}`);
    const handle = `f${randomUUID().slice(0, 8)}`;
    await claimHandle(db, c.clock, profile.userId, handle);
    await insertVerifiedBest(db, profile.userId, sg.id, 321n);
    await recomputeSeason(db, c.clock, season.id, { force: true });
    await closeSeason(db, c.clock, season.id);

    const frozen = await db
      .select()
      .from(rankingSnapshots)
      .where(and(eq(rankingSnapshots.seasonId, season.id), eq(rankingSnapshots.frozen, true)));
    const frozenGame = frozen.find((row) => row.scope === 'game');
    const frozenChampionship = frozen.find((row) => row.scope === 'championship');
    const frozenBytes = new Map(frozen.map((row) => [row.id, JSON.stringify(row.payload)]));
    expect(frozenGame).toBeTruthy();
    expect(frozenChampionship).toBeTruthy();

    const board = await readLeaderboard(db, season.id, sg.id, {
      viewerUserId: profile.userId,
    });
    const standings = await readStandings(db, season.id);
    expect(board.rows).toEqual((frozenGame?.payload as { rows: unknown[] }).rows);
    expect(board.viewer).toEqual((frozenGame?.payload as { rows: unknown[] }).rows[0]);
    expect(standings).toEqual(frozenChampionship?.payload);

    await anonymiseProfile(db, c.clock, profile.userId);
    const anonymisedBoard = await readLeaderboard(db, season.id, sg.id, {
      viewerUserId: profile.userId,
    });
    const anonymisedStandings = await readStandings(db, season.id);
    expect(anonymisedBoard.rows[0]).toMatchObject({ rank: 1, score: '321', handle: 'retired' });
    expect(anonymisedBoard.viewer).toMatchObject({ rank: 1, score: '321', handle: 'retired' });
    expect(anonymisedStandings.rows[0]).toMatchObject({
      rank: 1,
      userId: profile.userId,
      handle: 'retired',
    });

    const after = await db
      .select()
      .from(rankingSnapshots)
      .where(and(eq(rankingSnapshots.seasonId, season.id), eq(rankingSnapshots.frozen, true)));
    expect(new Map(after.map((row) => [row.id, JSON.stringify(row.payload)]))).toEqual(frozenBytes);
  });

  it('rotates the daily board, archives yesterday, and enforces the cap', async () => {
    const day1 = new Date('2026-08-18T12:00:00.000Z');
    await rotateDaily(db, { randomBytes: (n) => randomBytes(n) }, day1);
    const dailySg = await db
      .select({ id: seasonGames.id })
      .from(seasonGames)
      .innerJoin(games, eq(games.id, seasonGames.gameId))
      .where(and(eq(games.slug, 'test-chamber'), eq(seasonGames.seedPolicy, 'daily-seed')))
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

  it('rotates weekly boards onto ISO-week Monday and issues that seed', async () => {
    const tuesday = new Date('2026-08-18T12:00:00.000Z');
    await rotateDaily(db, { randomBytes: (n) => randomBytes(n) }, tuesday);
    const weeklySg = await db
      .select({ id: seasonGames.id })
      .from(seasonGames)
      .innerJoin(games, eq(games.id, seasonGames.gameId))
      .where(and(eq(games.slug, 'test-chamber'), eq(seasonGames.seedPolicy, 'weekly-seed')))
      .then((r) => r[0]);
    expect(weeklySg).toBeTruthy();
    const mondayBoard = await db
      .select()
      .from(dailyBoards)
      .where(and(eq(dailyBoards.seasonGameId, weeklySg!.id), eq(dailyBoards.utcDate, '2026-08-17')))
      .then((r) => r[0]);
    expect(mondayBoard).toBeTruthy();
    expect(mondayBoard?.archivedAt).toBeNull();

    const profile = await upsertProfile(db, `auth-${randomUUID()}`);
    await claimHandle(db, { now: () => tuesday }, profile.userId, `w${randomUUID().slice(0, 8)}`);
    const issued = await issueAttempt(db, ctx({ clock: { now: () => tuesday } }), {
      userId: profile.userId,
      gameSlug: 'test-chamber',
      seedPolicy: 'weekly-seed',
      ip: '12.0.0.1',
    });
    expect(issued.seed).toEqual([...unpackSeed(mondayBoard!.seed)]);
  });

  it('verifies the Hookline Sprint golden replay', async () => {
    const fixturePath = resolve(
      fileURLToPath(import.meta.url),
      '../../../../games/hookline-sprint/fixtures/sample.swr',
    );
    const goldenPath = resolve(
      fileURLToPath(import.meta.url),
      '../../../../games/hookline-sprint/conformance/golden/sample.json',
    );
    const hooklineBytes = readFileSync(fixturePath);
    const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as { score: number; hash: string };
    const profile = await upsertProfile(db, `auth-${randomUUID()}`);
    await claimHandle(db, c.clock, profile.userId, `k${randomUUID().slice(0, 8)}`);
    const issueCtx = goldenEntropy();
    const issued = await issueAttempt(db, issueCtx, {
      userId: profile.userId,
      gameSlug: 'hookline-sprint',
      seedPolicy: 'fixed-course',
      ip: '10.0.1.2',
    });
    expect(issued.seed).toEqual([5, 6, 7, 8]);
    const decoded = await decodeReplay(hooklineBytes);
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
      claimedScore: String(golden.score),
    });
    expect(finished.status).toBe('pending');
    await processNextJob(db, issueCtx.clock, 'worker-hookline', { staleLockSeconds: 0 });
    const sub = await db
      .select()
      .from(scoreSubmissions)
      .where(eq(scoreSubmissions.runId, finished.runId))
      .then((r) => r[0]);
    expect(sub?.verificationStatus).toBe('verified');
    expect(sub?.verifiedScore).toBe(BigInt(golden.score));
  });

  it('rejects an inflated Hookline claimed score with SCORE_MISMATCH', async () => {
    const fixturePath = resolve(
      fileURLToPath(import.meta.url),
      '../../../../games/hookline-sprint/fixtures/sample.swr',
    );
    const goldenPath = resolve(
      fileURLToPath(import.meta.url),
      '../../../../games/hookline-sprint/conformance/golden/sample.json',
    );
    const hooklineBytes = readFileSync(fixturePath);
    const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as { score: number };
    const profile = await upsertProfile(db, `auth-${randomUUID()}`);
    await claimHandle(db, c.clock, profile.userId, `m${randomUUID().slice(0, 8)}`);
    const issueCtx = goldenEntropy();
    const issued = await issueAttempt(db, issueCtx, {
      userId: profile.userId,
      gameSlug: 'hookline-sprint',
      seedPolicy: 'fixed-course',
      ip: '10.0.1.3',
    });
    const decoded = await decodeReplay(hooklineBytes);
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
      claimedScore: String(golden.score + 1),
    });
    await processNextJob(db, issueCtx.clock, 'worker-hookline-bad', { staleLockSeconds: 0 });
    const sub = await db
      .select()
      .from(scoreSubmissions)
      .where(eq(scoreSubmissions.runId, finished.runId))
      .then((r) => r[0]);
    expect(sub?.verificationStatus).toBe('rejected');
    expect(sub?.reasonCode).toBe('SCORE_MISMATCH');
  });

  it('verifies the Pickaxe Ascent golden replay', async () => {
    const fixturePath = resolve(
      fileURLToPath(import.meta.url),
      '../../../../games/pickaxe-ascent/fixtures/sample.swr',
    );
    const goldenPath = resolve(
      fileURLToPath(import.meta.url),
      '../../../../games/pickaxe-ascent/conformance/golden/sample.json',
    );
    const bytes = readFileSync(fixturePath);
    const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as { score: number; hash: string };
    const profile = await upsertProfile(db, `auth-${randomUUID()}`);
    await claimHandle(db, c.clock, profile.userId, `p${randomUUID().slice(0, 8)}`);
    const issueCtx = goldenEntropy();
    const issued = await issueAttempt(db, issueCtx, {
      userId: profile.userId,
      gameSlug: 'pickaxe-ascent',
      seedPolicy: 'fixed-course',
      ip: '10.0.2.2',
    });
    expect(issued.seed).toEqual([5, 6, 7, 8]);
    const decoded = await decodeReplay(bytes);
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
      claimedScore: String(golden.score),
    });
    expect(finished.status).toBe('pending');
    await processNextJob(db, issueCtx.clock, 'worker-pickaxe', { staleLockSeconds: 0 });
    const sub = await db
      .select()
      .from(scoreSubmissions)
      .where(eq(scoreSubmissions.runId, finished.runId))
      .then((r) => r[0]);
    expect(sub?.verificationStatus).toBe('verified');
    expect(sub?.verifiedScore).toBe(BigInt(golden.score));
  });

  it.each([
    [
      'BAD_MAGIC',
      (valid: Buffer) => {
        const raw = gunzipSync(valid);
        raw[0] = 0;
        return gzipSync(raw);
      },
    ],
    ['TRUNCATED', (valid: Buffer) => gzipSync(gunzipSync(valid).subarray(0, 40))],
    [
      'CRC_MISMATCH',
      (valid: Buffer) => {
        const raw = gunzipSync(valid);
        raw[raw.length - 1] = raw[raw.length - 1]! ^ 0xff;
        return gzipSync(raw);
      },
    ],
    ['TOO_LARGE', () => Buffer.alloc(64 * 1024 + 1)],
    ['GZIP', () => Buffer.from('not-a-gzip-stream')],
    [
      'UNSUPPORTED_FORMAT',
      (valid: Buffer) => {
        const raw = gunzipSync(valid);
        raw.writeUInt16LE(99, 4);
        return gzipSync(raw);
      },
    ],
    [
      'TICK_ORDER',
      async (valid: Buffer) => {
        const decoded = await decodeReplay(valid);
        if (!decoded.ok) throw new Error('invalid generated replay');
        return Buffer.from(
          await encodeReplay(decoded.header, [
            { tick: 1, actionId: 2, value: 1 },
            { tick: 1, actionId: 1, value: 0 },
          ]),
        );
      },
    ],
  ] as const)('maps replay decode failure %s through finishAttempt', async (code, corrupt) => {
    const profile = await upsertProfile(db, `decode-${code}-${randomUUID()}`);
    await claimHandle(db, c.clock, profile.userId, `d${randomUUID().slice(0, 8)}`);
    const issueCtx = goldenEntropy();
    const issued = await issueAttempt(db, issueCtx, {
      userId: profile.userId,
      gameSlug: 'test-chamber',
      seedPolicy: 'fixed-course',
      ip: `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
    });
    const valid = await replayForAttempt(issued.attemptId);
    const replay = await corrupt(valid);
    await expect(
      finishAttempt(db, issueCtx, {
        userId: profile.userId,
        attemptId: issued.attemptId,
        token: issued.token,
        replayB64: replay.toString('base64'),
        claimedScore: '302',
      }),
    ).rejects.toMatchObject({ code });
  });

  it('rate-limits one issue identity without sharing its user bucket', async () => {
    const now = new Date('2026-08-18T20:00:00.000Z');
    const a = await upsertProfile(db, `limited-${randomUUID()}`);
    const b = await upsertProfile(db, `unlimited-${randomUUID()}`);
    await claimHandle(db, { now: () => now }, a.userId, `l${randomUUID().slice(0, 8)}`);
    await claimHandle(db, { now: () => now }, b.userId, `n${randomUUID().slice(0, 8)}`);
    const window = floorWindow(now, 60_000);
    for (let i = 0; i < 10; i++) {
      await hitRateLimit(db, `issue:user:${a.userId}:m`, window, 10);
    }
    const rateCtx = ctx({ clock: { now: () => now } });
    await expect(
      issueAttempt(db, rateCtx, {
        userId: a.userId,
        gameSlug: 'test-chamber',
        seedPolicy: 'fixed-course',
        ip: '203.0.113.90',
      }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await expect(
      issueAttempt(db, rateCtx, {
        userId: b.userId,
        gameSlug: 'test-chamber',
        seedPolicy: 'fixed-course',
        ip: '203.0.113.90',
      }),
    ).resolves.toMatchObject({ dailyCapRemaining: 4 });
  });

  it('requires an invite for invite seasons and lets moderators bypass it', async () => {
    const now = new Date('2026-08-18T21:00:00.000Z');
    const suffix = randomUUID().slice(0, 8);
    const [season] = await db
      .insert(seasons)
      .values({
        slug: `a-invite-${suffix}`,
        startsAt: new Date('2020-01-01T00:00:00.000Z'),
        endsAt: new Date('2099-01-01T00:00:00.000Z'),
        status: 'active',
        rulesVersion: 1,
        entryPolicy: 'invite',
      })
      .returning();
    const gameSlug = `invite-game-${suffix}`;
    await seedGame(
      db,
      season!.id,
      {
        slug: gameSlug,
        registryId: 20_000 + (Number.parseInt(suffix.slice(0, 4), 16) % 40_000),
        maxRunTicks: 600,
        seedPolicies: ['fixed-course'],
      },
      now,
    );

    const email = `Invite-${suffix}@Example.com`;
    const player = await upsertProfile(db, `invite-player-${randomUUID()}`, email);
    await claimHandle(db, { now: () => now }, player.userId, `i${randomUUID().slice(0, 8)}`);
    const issueCtx = goldenEntropy();
    issueCtx.clock = { now: () => now };
    await expect(
      issueAttempt(db, issueCtx, {
        userId: player.userId,
        email,
        gameSlug,
        seedPolicy: 'fixed-course',
        ip: '203.0.113.101',
      }),
    ).rejects.toMatchObject({ code: 'NOT_INVITED' });

    await db.insert(rankedInvites).values({ email: email.toLowerCase(), invitedAt: now });
    await expect(
      issueAttempt(db, issueCtx, {
        userId: player.userId,
        email,
        gameSlug,
        seedPolicy: 'fixed-course',
        ip: '203.0.113.101',
      }),
    ).resolves.toBeTruthy();
    const invite = await db
      .select()
      .from(rankedInvites)
      .where(eq(rankedInvites.email, email))
      .then((rows) => rows[0]);
    expect(invite?.consumedUserId).toBe(player.userId);
    expect(invite?.consumedAt).toEqual(now);

    const moderator = await upsertProfile(db, `invite-moderator-${randomUUID()}`);
    await db
      .update(profiles)
      .set({ role: 'moderator' })
      .where(eq(profiles.userId, moderator.userId));
    await claimHandle(db, { now: () => now }, moderator.userId, `m${randomUUID().slice(0, 8)}`);
    await expect(
      issueAttempt(db, goldenEntropy(), {
        userId: moderator.userId,
        gameSlug,
        seedPolicy: 'fixed-course',
        ip: '203.0.113.102',
      }),
    ).resolves.toBeTruthy();
  });

  it('keeps a season closing until issued attempts expire and then freezes it', async () => {
    const start = new Date('2026-08-18T22:00:00.000Z');
    const { season, sg } = await createIsolatedSeason(db, `closing-${randomUUID().slice(0, 8)}`);
    const profile = await upsertProfile(db, `closing-${randomUUID()}`);
    await db.insert(attempts).values({
      userId: profile.userId,
      seasonGameId: sg.id,
      gameVersionId: sg.gameVersionId,
      seed: packSeed([1, 2, 3, 4]),
      nonce: randomBytes(16),
      issuedAt: start,
      expiresAt: new Date(start.getTime() + 15 * 60 * 1000),
      status: 'issued',
    });

    await closeSeason(db, { now: () => start }, season.id);
    const closing = await db
      .select()
      .from(seasons)
      .where(eq(seasons.id, season.id))
      .then((r) => r[0]);
    expect(closing?.status).toBe('closing');
    expect(
      await db
        .select()
        .from(rankingSnapshots)
        .where(and(eq(rankingSnapshots.seasonId, season.id), eq(rankingSnapshots.frozen, true))),
    ).toHaveLength(0);

    const afterGrace = new Date(start.getTime() + 15 * 60 * 1000 + 1);
    await closeSeason(db, { now: () => afterGrace }, season.id);
    const closed = await db
      .select()
      .from(seasons)
      .where(eq(seasons.id, season.id))
      .then((r) => r[0]);
    expect(closed?.status).toBe('closed');
    expect(
      await db
        .select()
        .from(rankingSnapshots)
        .where(and(eq(rankingSnapshots.seasonId, season.id), eq(rankingSnapshots.frozen, true))),
    ).not.toHaveLength(0);
  });

  it('serializes attempt issuance with season closure', async () => {
    const now = new Date('2026-08-18T22:30:00.000Z');
    const suffix = randomUUID().replaceAll('-', '');
    const [season] = await db
      .insert(seasons)
      .values({
        slug: `issue-close-${suffix}`,
        startsAt: new Date('2020-01-01T00:00:00.000Z'),
        endsAt: new Date('2099-01-01T00:00:00.000Z'),
        status: 'active',
        rulesVersion: 1,
      })
      .returning();
    const gameSlug = `issue-close-game-${suffix}`;
    await seedGame(
      db,
      season!.id,
      {
        slug: gameSlug,
        registryId: 20_000 + (Number.parseInt(suffix.slice(0, 8), 16) % 40_000),
        maxRunTicks: 600,
        seedPolicies: ['fixed-course'],
      },
      now,
    );
    const sg = await db
      .select({ id: seasonGames.id })
      .from(seasonGames)
      .innerJoin(games, eq(games.id, seasonGames.gameId))
      .where(eq(games.slug, gameSlug))
      .then((rows) => rows[0]);
    const profile = await upsertProfile(db, `issue-close-${randomUUID()}`);
    await claimHandle(db, { now: () => now }, profile.userId, `x${randomUUID().slice(0, 8)}`);
    const functionName = `delay_attempt_insert_${suffix}`;
    const triggerName = `delay_attempt_insert_trigger_${suffix}`;
    await pool.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM pg_sleep(1);
        RETURN NEW;
      END
      $$;
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON attempts
      FOR EACH ROW
      WHEN (NEW.season_game_id = '${sg!.id}')
      EXECUTE FUNCTION ${functionName}();
    `);

    try {
      const issueCtx = goldenEntropy();
      issueCtx.clock = { now: () => now };
      const issuing = issueAttempt(db, issueCtx, {
        userId: profile.userId,
        gameSlug,
        seedPolicy: 'fixed-course',
        ip: '203.0.113.111',
      });
      await waitForSleepingAttemptInsert(pool);
      const closing = closeSeason(db, { now: () => now }, season!.id);
      await Promise.all([issuing, closing]);

      const closedSeason = await db
        .select({ status: seasons.status })
        .from(seasons)
        .where(eq(seasons.id, season!.id))
        .then((rows) => rows[0]);
      const inFlight = await db
        .select({ id: attempts.id })
        .from(attempts)
        .where(and(eq(attempts.seasonGameId, sg!.id), eq(attempts.status, 'issued')));
      expect(closedSeason?.status).toBe('closing');
      expect(inFlight).toHaveLength(1);
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON attempts`);
      await pool.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
  });

  it.each(['closing', 'closed'] as const)(
    'rejects finish when its season is %s',
    async (seasonStatus) => {
      const profile = await upsertProfile(db, `season-finish-${randomUUID()}`);
      await claimHandle(db, c.clock, profile.userId, `q${randomUUID().slice(0, 8)}`);
      const issueCtx = goldenEntropy();
      const issued = await issueAttempt(db, issueCtx, {
        userId: profile.userId,
        gameSlug: 'test-chamber',
        seedPolicy: 'fixed-course',
        ip: '203.0.113.110',
      });
      const season = await db
        .select()
        .from(seasons)
        .where(eq(seasons.slug, 'ci'))
        .then((r) => r[0]);
      await db.update(seasons).set({ status: seasonStatus }).where(eq(seasons.id, season!.id));
      try {
        await expect(
          finishAttempt(db, issueCtx, {
            userId: profile.userId,
            attemptId: issued.attemptId,
            token: issued.token,
            replayB64: (await replayForAttempt(issued.attemptId)).toString('base64'),
            claimedScore: '302',
          }),
        ).rejects.toMatchObject({ code: 'SEASON_INACTIVE' });
      } finally {
        await db.update(seasons).set({ status: 'active' }).where(eq(seasons.id, season!.id));
      }
    },
  );

  it('files hashed guest reports and records every moderator action and notice', async () => {
    const now = new Date('2026-08-18T23:00:00.000Z');
    const target = await upsertProfile(
      db,
      `report-target-${randomUUID()}`,
      `target-${randomUUID()}@example.com`,
    );
    const reporter = await upsertProfile(db, `reporter-${randomUUID()}`);
    const moderator = await upsertProfile(db, `moderator-${randomUUID()}`);
    const targetHandle = `r${randomUUID().slice(0, 8)}`;
    await claimHandle(db, { now: () => now }, target.userId, targetHandle);
    await db
      .update(profiles)
      .set({ role: 'moderator' })
      .where(eq(profiles.userId, moderator.userId));
    const reportCtx = ctx({ clock: { now: () => now } });
    const ip = '198.51.100.200';

    const reports = [];
    for (const action of ['suspend', 'force_release_handle', 'unsuspend', 'dismiss'] as const) {
      reports.push(
        await fileReport(db, reportCtx, {
          reporterUserId: reporter.userId,
          ip,
          targetUserId: target.userId,
          reasonCode: 'handle_offensive',
          details: action,
        }),
      );
    }
    const stored = await db
      .select()
      .from(ugcReports)
      .where(eq(ugcReports.id, reports[0]!.id))
      .then((r) => r[0]);
    expect(stored?.reporterIpHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.reporterIpHash).not.toContain(ip);
    await expect(listModerationReports(db, reporter.userId, 'open')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 404,
    });
    expect(await listModerationReports(db, moderator.userId, 'open')).toHaveLength(4);

    for (let i = 0; i < reports.length; i++) {
      const action = (['suspend', 'force_release_handle', 'unsuspend', 'dismiss'] as const)[i]!;
      await moderateReport(
        db,
        { now: () => new Date(now.getTime() + i + 1) },
        {
          actorUserId: moderator.userId,
          reportId: reports[i]!.id,
          action,
          reasonCode: `rule_${i}`,
          reasonText: `Reason ${i}`,
        },
      );
    }
    const targetAfter = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, target.userId))
      .then((r) => r[0]);
    expect(targetAfter?.status).toBe('active');
    expect(targetAfter?.handle).toBeNull();
    const notices = await listUserNotices(db, target.userId);
    expect(notices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: 'rule_0',
          reasonText: 'Reason 0',
          redress: expect.stringContaining('/legal'),
        }),
      ]),
    );
    expect(
      await db
        .select()
        .from(moderationActions)
        .where(eq(moderationActions.actorUserId, moderator.userId)),
    ).toHaveLength(4);
    expect(
      await db.select().from(auditEvents).where(eq(auditEvents.actor, moderator.userId)),
    ).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'moderation.suspend' })]));
  });

  it('allows only one moderator to action an open report', async () => {
    const now = new Date('2026-08-18T23:30:00.000Z');
    const target = await upsertProfile(db, `concurrent-report-target-${randomUUID()}`);
    const moderator = await upsertProfile(db, `concurrent-moderator-${randomUUID()}`);
    await db
      .update(profiles)
      .set({ role: 'moderator' })
      .where(eq(profiles.userId, moderator.userId));
    const report = await fileReport(db, ctx({ clock: { now: () => now } }), {
      ip: '198.51.100.201',
      targetUserId: target.userId,
      reasonCode: 'other',
      details: 'concurrent action',
    });
    const actionInput = {
      actorUserId: moderator.userId,
      reportId: report.id,
      action: 'suspend' as const,
      reasonCode: 'concurrent',
      reasonText: 'Only one action is allowed',
    };

    const results = await Promise.allSettled([
      moderateReport(db, { now: () => now }, actionInput),
      moderateReport(db, { now: () => now }, actionInput),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toEqual([
      expect.objectContaining({
        reason: expect.objectContaining({ code: 'ATTEMPT_NOT_FOUND' }),
      }),
    ]);
    expect(
      await db.select().from(moderationActions).where(eq(moderationActions.reportId, report.id)),
    ).toHaveLength(1);
  });

  it('rolls back a report when its audit insert fails', async () => {
    const target = await upsertProfile(db, `report-atomic-target-${randomUUID()}`);
    const details = `audit failure ${randomUUID()}`;
    const suffix = randomUUID().replaceAll('-', '');
    const functionName = `fail_report_audit_${suffix}`;
    const triggerName = `fail_report_audit_trigger_${suffix}`;
    await pool.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced report audit failure';
      END
      $$;
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON audit_events
      FOR EACH ROW
      WHEN (
        NEW.action = 'ugc.report'
        AND NEW.request_meta->>'targetUserId' = '${target.userId}'
      )
      EXECUTE FUNCTION ${functionName}();
    `);

    try {
      await expect(
        fileReport(db, c, {
          ip: '198.51.100.202',
          targetUserId: target.userId,
          reasonCode: 'other',
          details,
        }),
      ).rejects.toThrow('forced report audit failure');
      expect(
        await db
          .select()
          .from(ugcReports)
          .where(and(eq(ugcReports.targetUserId, target.userId), eq(ugcReports.details, details))),
      ).toHaveLength(0);
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON audit_events`);
      await pool.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
  });

  it('rate-limits reports by hashed IP without sharing another IP bucket', async () => {
    const target = await upsertProfile(db, `report-rate-target-${randomUUID()}`);
    const reportCtx = ctx({ clock: { now: () => new Date('2026-08-19T00:00:00.000Z') } });
    for (let i = 0; i < 5; i++) {
      await fileReport(db, reportCtx, {
        ip: '198.51.100.210',
        targetUserId: target.userId,
        reasonCode: 'other',
        details: String(i),
      });
    }
    await expect(
      fileReport(db, reportCtx, {
        ip: '198.51.100.210',
        targetUserId: target.userId,
        reasonCode: 'other',
        details: 'limited',
      }),
    ).rejects.toMatchObject({ code: 'UGC_REPORT_RATE' });
    await expect(
      fileReport(db, reportCtx, {
        ip: '198.51.100.211',
        targetUserId: target.userId,
        reasonCode: 'other',
        details: 'separate',
      }),
    ).resolves.toBeTruthy();
  });

  it('exports caller data, anonymises it, and rebuilds standings as retired', async () => {
    const authUserId = `privacy-${randomUUID()}`;
    const email = `privacy-${randomUUID()}@example.com`;
    const profile = await upsertProfile(db, authUserId);
    const profileWithEmail = await upsertProfile(db, authUserId, email);
    expect(profileWithEmail).toMatchObject({ userId: profile.userId, email });
    const handle = `p${randomUUID().slice(0, 8)}`;
    await claimHandle(db, c.clock, profile.userId, handle);
    const season = await db
      .select()
      .from(seasons)
      .where(eq(seasons.slug, 'ci'))
      .then((r) => r[0]);
    const sg = await db
      .select({ id: seasonGames.id })
      .from(seasonGames)
      .innerJoin(games, eq(games.id, seasonGames.gameId))
      .where(and(eq(games.slug, 'test-chamber'), eq(seasonGames.seedPolicy, 'fixed-course')))
      .then((r) => r[0]);
    await insertVerifiedBest(db, profile.userId, sg!.id, 777n);
    const other = await upsertProfile(db, `privacy-other-${randomUUID()}`);
    await fileReport(db, c, {
      reporterUserId: profile.userId,
      ip: '198.51.100.220',
      targetUserId: other.userId,
      reasonCode: 'other',
      details: 'export me',
    });

    const exported = await exportUserData(db, profile.userId);
    expect(exported.profile.email).toBe(email);
    expect(exported.attempts).not.toHaveLength(0);
    expect(exported.runs[0]?.replay).toBe(Buffer.from([1]).toString('base64'));
    expect(exported.verifiedResults[0]?.score).toBe('777');
    expect(exported.reportsFiled).toHaveLength(1);
    expect(exported.auditEvents).not.toHaveLength(0);

    await anonymiseProfile(db, c.clock, profile.userId);
    const anonymised = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, profile.userId))
      .then((r) => r[0]);
    expect(anonymised).toMatchObject({
      status: 'anonymised',
      email: null,
      authUserId: `deleted:${profile.userId}`,
    });
    expect(anonymised?.handle).toMatch(/^d-[0-9a-f]{12,13}$/);
    await expect(anonymiseProfile(db, c.clock, profile.userId)).rejects.toMatchObject({
      code: 'ALREADY_ANONYMISED',
    });

    await recomputeSeason(db, c.clock, season!.id, { force: true });
    const board = await readLeaderboard(db, season!.id, sg!.id, { viewerUserId: profile.userId });
    expect(board.viewer?.handle).toBe('retired');
    const standings = await readStandings(db, season!.id);
    expect(standings.rows.find((row) => row.userId === profile.userId)?.handle).toBe('retired');
    const replacement = await upsertProfile(db, authUserId, `new-${email}`);
    expect(replacement.userId).not.toBe(profile.userId);
    expect(replacement.handle).toBeNull();
  });

  it('rolls back profile and dirty state when anonymisation audit fails', async () => {
    const { season, sg } = await createIsolatedSeason(
      db,
      `privacy-atomic-${randomUUID().slice(0, 8)}`,
    );
    const authUserId = `privacy-atomic-${randomUUID()}`;
    const profile = await upsertProfile(db, authUserId, `${authUserId}@example.com`);
    const handle = `a${randomUUID().slice(0, 8)}`;
    await claimHandle(db, c.clock, profile.userId, handle);
    await insertVerifiedBest(db, profile.userId, sg.id, 100n);
    const suffix = randomUUID().replaceAll('-', '');
    const functionName = `fail_anonymise_audit_${suffix}`;
    const triggerName = `fail_anonymise_audit_trigger_${suffix}`;
    await pool.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced anonymisation audit failure';
      END
      $$;
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON audit_events
      FOR EACH ROW
      WHEN (NEW.action = 'profile.anonymise' AND NEW.target = '${profile.userId}')
      EXECUTE FUNCTION ${functionName}();
    `);

    try {
      await expect(anonymiseProfile(db, c.clock, profile.userId)).rejects.toThrow(
        'forced anonymisation audit failure',
      );
      const after = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, profile.userId))
        .then((rows) => rows[0]);
      expect(after).toMatchObject({
        status: 'active',
        handle,
        authUserId,
      });
      expect(
        await db.select().from(rankingDirty).where(eq(rankingDirty.seasonId, season.id)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.action, 'profile.anonymise'),
              eq(auditEvents.target, profile.userId),
            ),
          ),
      ).toHaveLength(0);
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON audit_events`);
      await pool.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    }
  });
});

async function waitForSleepingAttemptInsert(pool: pg.Pool): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await pool.query<{ found: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND state = 'active'
          AND wait_event = 'PgSleep'
          AND query ILIKE '%insert into "attempts"%'
      ) AS found
    `);
    if (result.rows[0]?.found) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('timed out waiting for delayed attempt insert');
}

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
  weeklySg: typeof seasonGames.$inferSelect;
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
  const game = await db
    .select()
    .from(games)
    .where(eq(games.slug, 'test-chamber'))
    .then((r) => r[0]);
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
  const [weeklySg] = await db
    .insert(seasonGames)
    .values({
      seasonId: season!.id,
      gameId: game!.id,
      gameVersionId: version!.id,
      seedPolicy: 'weekly-seed',
      activeFrom: new Date('2020-01-01T00:00:00.000Z'),
      activeTo: new Date('2099-01-01T00:00:00.000Z'),
    })
    .returning();
  return { season: season!, sg: sg!, dailySg: dailySg!, weeklySg: weeklySg! };
}

async function insertVerifiedBest(
  db: Database,
  userId: string,
  seasonGameId: string,
  score: bigint,
): Promise<void> {
  const sg = await db
    .select()
    .from(seasonGames)
    .where(eq(seasonGames.id, seasonGameId))
    .then((r) => r[0]);
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
