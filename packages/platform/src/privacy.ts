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
    profile,
    attempts: attemptRows.map((row) => ({
      ...row,
      seed: Buffer.from(row.seed).toString('base64'),
      nonce: Buffer.from(row.nonce).toString('base64'),
    })),
    runs: runRows.map((row) => ({
      ...row,
      claimedScore: row.claimedScore.toString(),
      replay: Buffer.from(row.replay).toString('base64'),
      finalStateHash: Buffer.from(row.finalStateHash).toString('hex'),
    })),
    verifiedResults: resultRows.map((row) => ({ ...row, score: row.score.toString() })),
    reportsFiled: reportRows.map(({ reporterIpHash: _reporterIpHash, ...row }) => row),
    auditEvents: auditRows,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
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
