import {
  attempts,
  auditEvents,
  gameBests,
  profiles,
  rankingDirty,
  runs,
  seasonGames,
  ugcReports,
  verifiedResults,
  type Database,
} from '@stickworld/db';
import { and, eq, ne } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { Clock } from './context.js';
import { ApiError } from './errors.js';

export async function exportUserData(
  db: Database,
  userId: string,
): Promise<{
  profile: Record<string, unknown>;
  attempts: Array<Record<string, unknown>>;
  runs: Array<Record<string, unknown>>;
  verifiedResults: Array<Record<string, unknown>>;
  reportsFiled: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
}> {
  const profile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .then((rows) => rows[0]);
  if (!profile) throw new ApiError('UNAUTHENTICATED');
  const [attemptRows, runRows, resultRows, reportRows, auditRows] = await Promise.all([
    db.select().from(attempts).where(eq(attempts.userId, userId)),
    db.select().from(runs).where(eq(runs.userId, userId)),
    db.select().from(verifiedResults).where(eq(verifiedResults.userId, userId)),
    db.select().from(ugcReports).where(eq(ugcReports.reporterUserId, userId)),
    db.select().from(auditEvents).where(eq(auditEvents.actor, userId)),
  ]);
  return {
    profile: {
      userId: profile.userId,
      authUserId: profile.authUserId,
      handle: profile.handle,
      handleClaimedAt: profile.handleClaimedAt,
      handleChangedAt: profile.handleChangedAt,
      status: profile.status,
      role: profile.role,
      email: profile.email,
      createdAt: profile.createdAt,
    },
    attempts: attemptRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      seasonGameId: row.seasonGameId,
      gameVersionId: row.gameVersionId,
      seed: Buffer.from(row.seed).toString('base64'),
      nonce: Buffer.from(row.nonce).toString('base64'),
      issuedAt: row.issuedAt,
      expiresAt: row.expiresAt,
      status: row.status,
      consumedAt: row.consumedAt,
      createdAt: row.createdAt,
    })),
    runs: runRows.map((row) => ({
      id: row.id,
      attemptId: row.attemptId,
      userId: row.userId,
      claimedScore: row.claimedScore.toString(),
      totalTicks: row.totalTicks,
      replay: Buffer.from(row.replay).toString('base64'),
      finalStateHash: Buffer.from(row.finalStateHash).toString('hex'),
      createdAt: row.createdAt,
    })),
    verifiedResults: resultRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      seasonGameId: row.seasonGameId,
      runId: row.runId,
      score: row.score.toString(),
      tiebreakMetrics: row.tiebreakMetrics,
      achievedAt: row.achievedAt,
      createdAt: row.createdAt,
    })),
    reportsFiled: reportRows.map((row) => ({
      id: row.id,
      reporterUserId: row.reporterUserId,
      reasonCode: row.reasonCode,
      status: row.status,
      createdAt: row.createdAt,
    })),
    auditEvents: auditRows.map((row) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      createdAt: row.createdAt,
    })),
  };
}

function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<object>();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    if ('code' in current && current.code === '23505') return true;
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}

export async function anonymiseProfile(
  db: Database,
  clock: Clock,
  userId: string,
): Promise<{ userId: string; handle: string; status: 'anonymised' }> {
  const profile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .then((rows) => rows[0]);
  if (!profile) throw new ApiError('UNAUTHENTICATED');
  if (profile.status === 'anonymised') throw new ApiError('ALREADY_ANONYMISED');

  const prefix = createHash('sha256').update(userId).digest('hex').slice(0, 12);
  const now = clock.now();
  let anonymisedHandle: string | undefined;
  for (let attempt = 0; attempt <= 16; attempt++) {
    const suffix = attempt === 0 ? '' : (attempt - 1).toString(16);
    const candidate = `d-${prefix}${suffix}`;
    try {
      anonymisedHandle = await db.transaction(async (tx) => {
        const updated = await tx
          .update(profiles)
          .set({
            status: 'anonymised',
            handle: candidate,
            handleClaimedAt: null,
            handleChangedAt: now,
            email: null,
            authUserId: `deleted:${userId}`,
          })
          .where(and(eq(profiles.userId, userId), ne(profiles.status, 'anonymised')))
          .returning({ handle: profiles.handle })
          .then((rows) => rows[0]);
        if (!updated?.handle) throw new ApiError('ALREADY_ANONYMISED');

        const affectedSeasons = await tx
          .select({ seasonId: seasonGames.seasonId })
          .from(gameBests)
          .innerJoin(seasonGames, eq(seasonGames.id, gameBests.seasonGameId))
          .where(eq(gameBests.userId, userId));
        for (const seasonId of new Set(affectedSeasons.map((row) => row.seasonId))) {
          await tx
            .insert(rankingDirty)
            .values({ seasonId, dirtyAt: now })
            .onConflictDoUpdate({
              target: rankingDirty.seasonId,
              set: { dirtyAt: now },
            });
        }
        await tx.insert(auditEvents).values({
          actor: userId,
          action: 'profile.anonymise',
          target: userId,
          requestMeta: { reason: null },
        });
        return updated.handle;
      });
      break;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  if (!anonymisedHandle) throw new ApiError('INTERNAL');
  return { userId, handle: anonymisedHandle, status: 'anonymised' };
}
