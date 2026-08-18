import {
  attempts,
  gameBests,
  gameVersions,
  games,
  runs,
  scoreSubmissions,
  seasonGames,
  verificationJobs,
  verifiedResults,
  type Database,
} from '@stickworld/db';
import { testChamberGame } from '@stickworld/game-test-chamber';
import { hooklineSprintGame } from '@stickworld/game-hookline-sprint';
import { pickaxeAscentGame } from '@stickworld/game-pickaxe-ascent';
import { launchLabGame } from '@stickworld/game-launch-lab';
import { ragdollArcheryRushGame } from '@stickworld/game-ragdoll-archery-rush';
import { hammerThrowHavocGame } from '@stickworld/game-hammer-throw-havoc';
import { decodeReplay, packGameVersion, type ReplayHeader } from '@stickworld/replay';
import {
  BudgetExceededError,
  NonFiniteStateError,
  Prng,
  initRapier,
  type StickworldGame,
} from '@stickworld/sim-core';
import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { audit } from './audit.js';
import type { Clock } from './context.js';
import { WORKER_MAX_CLAIMS, WORKER_STALE_LOCK_SECONDS } from './limits.js';
import { markSeasonDirty } from './recompute.js';
import type { ReasonCode } from './reason-codes.js';
import { unpackSeed, uuidToBytes } from './seed128.js';

const GAMES = new Map<number, StickworldGame>([
  [0, testChamberGame],
  [1, hooklineSprintGame],
  [2, pickaxeAscentGame],
  [3, launchLabGame],
  [4, ragdollArcheryRushGame],
  [5, hammerThrowHavocGame],
]);

function hexPrefix(hex: string): Buffer {
  return Buffer.from(hex.slice(0, 16), 'hex');
}

function packSemver(version: string): number {
  const [maj, min, pat] = version.split('.').map((p) => Number(p));
  return packGameVersion(maj ?? 0, min ?? 0, pat ?? 0);
}

export interface ClaimedJob {
  jobId: string;
  runId: string;
  attempts: number;
}

export async function claimJob(
  db: Database,
  workerId: string,
  now: Date,
  staleLockSeconds = WORKER_STALE_LOCK_SECONDS,
): Promise<ClaimedJob | undefined> {
  const staleBefore = new Date(now.getTime() - staleLockSeconds * 1000);
  const result = await db.execute(sql`
    UPDATE verification_jobs
    SET state = 'locked', locked_at = ${now}, locked_by = ${workerId}, attempts = attempts + 1
    WHERE id = (
      SELECT id FROM verification_jobs
      WHERE state = 'queued'
         OR (state = 'locked' AND locked_at < ${staleBefore})
      ORDER BY id
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, run_id, attempts
  `);
  const rows = (result as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  const row = rows[0];
  if (!row) return undefined;
  return {
    jobId: String(row.id),
    runId: String(row.run_id),
    attempts: Number(row.attempts),
  };
}

async function reject(
  db: Database,
  job: ClaimedJob,
  code: ReasonCode,
  firstTick: number | null,
  at: Date,
): Promise<void> {
  await db
    .update(scoreSubmissions)
    .set({
      verificationStatus: 'rejected',
      reasonCode: code,
      firstDivergentTick: firstTick,
      verifiedAt: at,
    })
    .where(eq(scoreSubmissions.runId, job.runId));
  await db
    .update(verificationJobs)
    .set({ state: 'done', lastError: code })
    .where(eq(verificationJobs.id, job.jobId));
  await audit(db, { actor: null, action: 'verify.reject', target: job.runId, reason: code });
}

function headerMatches(
  header: ReplayHeader,
  registryId: number,
  version: typeof gameVersions.$inferSelect,
  seed: ReturnType<typeof unpackSeed>,
  attemptId: string,
): ReasonCode | undefined {
  if (header.gameRegistryId !== registryId) return 'WRONG_VERSION';
  if (header.gameVersion !== packSemver(version.gameVersion)) return 'WRONG_VERSION';
  if (header.simulationVersion !== version.simulationVersion) return 'WRONG_VERSION';
  if (header.scoringVersion !== version.scoringVersion) return 'WRONG_VERSION';
  const prefix = hexPrefix(version.rapierBuildHash);
  if (!Buffer.from(header.rapierBuildHashPrefix).equals(prefix)) return 'WRONG_VERSION';
  if (
    header.seed[0] !== seed[0] ||
    header.seed[1] !== seed[1] ||
    header.seed[2] !== seed[2] ||
    header.seed[3] !== seed[3]
  ) {
    return 'TOKEN_INVALID';
  }
  if (!Buffer.from(header.attemptId).equals(uuidToBytes(attemptId))) return 'TOKEN_INVALID';
  return undefined;
}

export async function processClaimedJob(
  db: Database,
  clock: Clock,
  job: ClaimedJob,
  options: { maxClaims?: number } = {},
): Promise<void> {
  const maxClaims = options.maxClaims ?? WORKER_MAX_CLAIMS;
  if (job.attempts > maxClaims) {
    await db
      .update(scoreSubmissions)
      .set({
        verificationStatus: 'rejected',
        reasonCode: 'WORKER_FAULT',
        verifiedAt: clock.now(),
      })
      .where(eq(scoreSubmissions.runId, job.runId));
    await db
      .update(verificationJobs)
      .set({ state: 'failed', lastError: 'WORKER_FAULT' })
      .where(eq(verificationJobs.id, job.jobId));
    await audit(db, { actor: null, action: 'verify.fault', target: job.runId, reason: 'WORKER_FAULT' });
    return;
  }

  const run = await db.select().from(runs).where(eq(runs.id, job.runId)).then((r) => r[0]);
  const attempt = run
    ? await db.select().from(attempts).where(eq(attempts.id, run.attemptId)).then((r) => r[0])
    : undefined;
  if (!run || !attempt) {
    await reject(db, job, 'INTERNAL', null, clock.now());
    return;
  }
  const version = await db
    .select()
    .from(gameVersions)
    .where(eq(gameVersions.id, attempt.gameVersionId))
    .then((r) => r[0]);
  const sg = await db
    .select()
    .from(seasonGames)
    .innerJoin(games, eq(games.id, seasonGames.gameId))
    .where(eq(seasonGames.id, attempt.seasonGameId))
    .then((r) => r[0]);
  if (!version || !sg) {
    await reject(db, job, 'WRONG_VERSION', null, clock.now());
    return;
  }
  const game = GAMES.get(sg.games.registryId);
  if (!game) {
    await reject(db, job, 'WRONG_VERSION', null, clock.now());
    return;
  }

  const decoded = await decodeReplay(run.replay);
  if (!decoded.ok) {
    await reject(db, job, decoded.error.code as ReasonCode, null, clock.now());
    return;
  }
  const mismatch = headerMatches(
    decoded.header,
    sg.games.registryId,
    version,
    unpackSeed(attempt.seed),
    attempt.id,
  );
  if (mismatch) {
    await reject(db, job, mismatch, null, clock.now());
    return;
  }

  const rapier = await initRapier();
  const seed = unpackSeed(attempt.seed);
  const sim = game.createSimulation({ seed, rapier, prng: new Prng(seed) });
  try {
    const { playReplay } = await import('@stickworld/replay');
    let result: { score: number; stateHash: bigint };
    try {
      result = playReplay(sim, decoded.header, decoded.events, game.manifest.actions);
    } catch (err) {
      const code =
        err instanceof BudgetExceededError
          ? 'BUDGET_EXCEEDED'
          : err instanceof NonFiniteStateError
            ? 'NON_FINITE_STATE'
            : err && typeof err === 'object' && 'code' in err
              ? ((err as { code: string }).code as ReasonCode)
              : 'INTERNAL';
      const tick =
        code === 'SCORE_MISMATCH' || code === 'STATE_HASH_MISMATCH'
          ? (sim.scoreEvents().at(-1)?.tick ?? 0)
          : null;
      await reject(db, job, code, tick, clock.now());
      return;
    }
    if (BigInt(result.score) !== run.claimedScore) {
      await reject(db, job, 'SCORE_MISMATCH', sim.scoreEvents().at(-1)?.tick ?? 0, clock.now());
      return;
    }
    const now = clock.now();
    const hashBytes = Buffer.alloc(8);
    hashBytes.writeBigUInt64LE(result.stateHash);
    await db
      .update(scoreSubmissions)
      .set({
        verificationStatus: 'verified',
        verifiedScore: BigInt(result.score),
        verifiedHash: hashBytes,
        verifiedAt: now,
        reasonCode: null,
      })
      .where(eq(scoreSubmissions.runId, job.runId));
    const resultId = randomUUID();
    await db.insert(verifiedResults).values({
      id: resultId,
      userId: run.userId,
      seasonGameId: attempt.seasonGameId,
      runId: run.id,
      score: BigInt(result.score),
      achievedAt: now,
    });
    const existing = await db
      .select()
      .from(gameBests)
      .where(and(eq(gameBests.seasonGameId, attempt.seasonGameId), eq(gameBests.userId, run.userId)))
      .then((r) => r[0]);
    if (!existing || existing.score < BigInt(result.score)) {
      if (existing) {
        await db
          .update(gameBests)
          .set({ verifiedResultId: resultId, score: BigInt(result.score) })
          .where(
            and(eq(gameBests.seasonGameId, attempt.seasonGameId), eq(gameBests.userId, run.userId)),
          );
      } else {
        await db.insert(gameBests).values({
          seasonGameId: attempt.seasonGameId,
          userId: run.userId,
          verifiedResultId: resultId,
          score: BigInt(result.score),
        });
      }
    }
    await markSeasonDirty(db, sg.season_games.seasonId, now);
    await db
      .update(verificationJobs)
      .set({ state: 'done', lastError: null })
      .where(eq(verificationJobs.id, job.jobId));
    await audit(db, { actor: null, action: 'verify.ok', target: job.runId });
  } finally {
    sim.dispose();
  }
}

export async function processNextJob(
  db: Database,
  clock: Clock,
  workerId: string,
  options: { staleLockSeconds?: number; maxClaims?: number } = {},
): Promise<boolean> {
  const job = await claimJob(db, workerId, clock.now(), options.staleLockSeconds);
  if (!job) return false;
  try {
    if (options.maxClaims === undefined) {
      await processClaimedJob(db, clock, job);
    } else {
      await processClaimedJob(db, clock, job, { maxClaims: options.maxClaims });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    await db
      .update(verificationJobs)
      .set({ state: job.attempts >= (options.maxClaims ?? WORKER_MAX_CLAIMS) ? 'failed' : 'queued', lastError: message })
      .where(eq(verificationJobs.id, job.jobId));
    if (job.attempts >= (options.maxClaims ?? WORKER_MAX_CLAIMS)) {
      await db
        .update(scoreSubmissions)
        .set({ verificationStatus: 'rejected', reasonCode: 'WORKER_FAULT', verifiedAt: clock.now() })
        .where(eq(scoreSubmissions.runId, job.runId));
    }
  }
  return true;
}
