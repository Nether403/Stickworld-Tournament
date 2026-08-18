import {
  attempts,
  gameVersions,
  games,
  runs,
  scoreSubmissions,
  seasonGames,
  seasons,
  verificationJobs,
  type Database,
} from '@stickworld/db';
import { decodeReplay } from '@stickworld/replay/decode';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { audit } from './audit.js';
import { verifyAttemptToken } from './attempt-token.js';
import {
  cheapCadence,
  cheapDuration,
  cheapReplaySize,
  cheapScoreEnvelope,
  parseClaimedScore,
} from './cheap-checks.js';
import type { PlatformContext } from './context.js';
import { ApiError } from './errors.js';
import type { ReasonCode } from './reason-codes.js';
import { FINISH_RATE_USER_PER_MIN } from './limits.js';
import { floorWindow, hitRateLimit } from './rate-limit.js';
import { unpackSeed, uuidToBytes } from './seed128.js';

export interface FinishInput {
  userId: string;
  attemptId: string;
  token: string;
  replayB64: string;
  claimedScore: string;
}

export async function finishAttempt(
  db: Database,
  ctx: PlatformContext,
  input: FinishInput,
): Promise<{ runId: string; status: 'pending' }> {
  const now = ctx.clock.now();
  await hitRateLimit(
    db,
    `finish:user:${input.userId}:m`,
    floorWindow(now, 60_000),
    FINISH_RATE_USER_PER_MIN,
  );

  let replayBytes: Buffer;
  try {
    replayBytes = Buffer.from(input.replayB64, 'base64');
  } catch {
    throw new ApiError('BAD_MAGIC');
  }
  const sizeErr = cheapReplaySize(replayBytes);
  if (sizeErr) throw new ApiError(sizeErr);

  const claimed = parseClaimedScore(input.claimedScore);
  if (claimed === undefined) throw new ApiError('SCORE_ENVELOPE');
  const envErr = cheapScoreEnvelope(claimed);
  if (envErr) throw new ApiError(envErr);

  const payload = verifyAttemptToken(
    input.token,
    ctx.secrets.hmacSecret,
    ctx.secrets.hmacSecretPrev,
    Math.floor(now.getTime() / 1000),
  );
  if (payload.attemptId !== input.attemptId) throw new ApiError('TOKEN_INVALID');
  if (payload.userId !== input.userId) throw new ApiError('ATTEMPT_NOT_FOUND', 'WRONG_USER');

  const attemptWithSeason = await db
    .select()
    .from(attempts)
    .innerJoin(seasonGames, eq(seasonGames.id, attempts.seasonGameId))
    .innerJoin(seasons, eq(seasons.id, seasonGames.seasonId))
    .where(eq(attempts.id, input.attemptId))
    .then((r) => r[0]);
  if (!attemptWithSeason) throw new ApiError('ATTEMPT_NOT_FOUND');
  const attempt = attemptWithSeason.attempts;
  if (attempt.userId !== input.userId) throw new ApiError('ATTEMPT_NOT_FOUND', 'WRONG_USER');
  if (attemptWithSeason.seasons.status !== 'active') throw new ApiError('SEASON_INACTIVE');
  if (attempt.status === 'submitted' || attempt.consumedAt) throw new ApiError('ATTEMPT_CONSUMED');
  if (attempt.status === 'expired' || attempt.expiresAt <= now)
    throw new ApiError('ATTEMPT_EXPIRED');
  if (attempt.gameVersionId !== payload.gameVersionId) throw new ApiError('WRONG_VERSION');

  const version = await db
    .select()
    .from(gameVersions)
    .where(eq(gameVersions.id, attempt.gameVersionId))
    .then((r) => r[0]);
  if (!version) throw new ApiError('WRONG_VERSION');
  const sg = await db
    .select()
    .from(seasonGames)
    .innerJoin(games, eq(seasonGames.gameId, games.id))
    .where(eq(seasonGames.id, attempt.seasonGameId))
    .then((r) => r[0]);
  if (!sg) throw new ApiError('SEASON_INACTIVE');

  const decoded = await decodeReplay(replayBytes);
  if (!decoded.ok) throw new ApiError(decoded.error.code as ReasonCode);

  const config = version.configJson as { maxRunTicks?: number };
  const maxTicks = config.maxRunTicks ?? 600;
  const durErr = cheapDuration(decoded.header.totalTicks, maxTicks);
  if (durErr) throw new ApiError(durErr);
  const cadErr = cheapCadence(decoded.events, decoded.header.totalTicks);
  if (cadErr) throw new ApiError(cadErr);

  const headerSeed = decoded.header.seed;
  const rowSeed = unpackSeed(attempt.seed);
  if (
    headerSeed[0] !== rowSeed[0] ||
    headerSeed[1] !== rowSeed[1] ||
    headerSeed[2] !== rowSeed[2] ||
    headerSeed[3] !== rowSeed[3]
  ) {
    throw new ApiError('TOKEN_INVALID');
  }
  const headerAttempt = Buffer.from(decoded.header.attemptId);
  if (!headerAttempt.equals(uuidToBytes(attempt.id))) throw new ApiError('TOKEN_INVALID');
  if (decoded.header.gameRegistryId !== sg.games.registryId) throw new ApiError('WRONG_VERSION');

  const runId = randomUUID();
  const hashBytes = Buffer.alloc(8);
  hashBytes.writeBigUInt64LE(decoded.header.finalStateHash);

  await db.transaction(async (tx) => {
    const lockedSeason = await tx
      .select({ status: seasons.status })
      .from(seasons)
      .where(eq(seasons.id, attemptWithSeason.seasons.id))
      .for('update')
      .then((rows) => rows[0]);
    if (lockedSeason?.status !== 'active') throw new ApiError('SEASON_INACTIVE');

    const updated = await tx
      .update(attempts)
      .set({ status: 'submitted', consumedAt: now })
      .where(and(eq(attempts.id, attempt.id), eq(attempts.status, 'issued')))
      .returning({ id: attempts.id });
    if (updated.length === 0) throw new ApiError('ATTEMPT_CONSUMED');
    await tx.insert(runs).values({
      id: runId,
      attemptId: attempt.id,
      userId: input.userId,
      claimedScore: claimed,
      totalTicks: decoded.header.totalTicks,
      replay: replayBytes,
      finalStateHash: hashBytes,
    });
    await tx.insert(scoreSubmissions).values({
      runId,
      verificationStatus: 'pending',
    });
    await tx.insert(verificationJobs).values({
      runId,
      state: 'queued',
    });
  });
  await audit(db, { actor: input.userId, action: 'attempt.finish', target: runId });
  return { runId, status: 'pending' };
}
