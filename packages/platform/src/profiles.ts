import { profiles, type Database } from '@stickworld/db';
import { and, eq } from 'drizzle-orm';
import { ApiError } from './errors.js';
import { HANDLE_CHANGE_COOLDOWN_DAYS } from './limits.js';
import { normalizeHandle } from './handle.js';
import { audit } from './audit.js';
import type { Clock } from './context.js';

export async function upsertProfile(
  db: Database,
  authUserId: string,
  email?: string | null,
): Promise<{
  userId: string;
  handle: string | null;
  status: 'active' | 'suspended' | 'anonymised';
  role: 'player' | 'moderator';
  email: string | null;
}> {
  const existing = await db
    .select()
    .from(profiles)
    .where(eq(profiles.authUserId, authUserId))
    .then((rows) => rows[0]);
  if (existing) {
    if (email != null && email !== existing.email) {
      const updated = await db
        .update(profiles)
        .set({ email })
        .where(eq(profiles.userId, existing.userId))
        .returning()
        .then((rows) => rows[0]);
      if (updated) {
        return {
          userId: updated.userId,
          handle: updated.handle,
          status: updated.status,
          role: updated.role,
          email: updated.email,
        };
      }
    }
    return {
      userId: existing.userId,
      handle: existing.handle,
      status: existing.status,
      role: existing.role,
      email: existing.email,
    };
  }
  const inserted = await db
    .insert(profiles)
    .values({ authUserId, email: email ?? undefined })
    .onConflictDoNothing()
    .returning();
  const row =
    inserted[0] ??
    (await db
      .select()
      .from(profiles)
      .where(eq(profiles.authUserId, authUserId))
      .then((r) => r[0]));
  if (!row) throw new ApiError('INTERNAL');
  await audit(db, { actor: row.userId, action: 'profile.upsert', target: row.userId });
  return {
    userId: row.userId,
    handle: row.handle,
    status: row.status,
    role: row.role,
    email: row.email,
  };
}

export async function requireRankedUser(
  db: Database,
  authUserId: string | undefined,
  email?: string | null,
): Promise<{ userId: string; handle: string; email: string | null }> {
  if (!authUserId) throw new ApiError('UNAUTHENTICATED');
  const profile = await upsertProfile(db, authUserId, email);
  if (profile.status !== 'active') throw new ApiError('FORBIDDEN');
  if (!profile.handle) throw new ApiError('UNAUTHENTICATED');
  return { userId: profile.userId, handle: profile.handle, email: profile.email };
}

export async function claimHandle(
  db: Database,
  clock: Clock,
  userId: string,
  raw: string,
): Promise<{ status: 'ok' | 'noop'; handle: string }> {
  const normalized = normalizeHandle(raw);
  if (!normalized.ok) throw new ApiError('HANDLE_INVALID');
  const now = clock.now();
  const row = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .then((r) => r[0]);
  if (!row) throw new ApiError('UNAUTHENTICATED');
  if (row.handle === normalized.handle) return { status: 'noop', handle: normalized.handle };
  if (row.handleChangedAt) {
    const unlock = new Date(
      row.handleChangedAt.getTime() + HANDLE_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
    );
    if (now < unlock) throw new ApiError('HANDLE_COOLDOWN');
  }
  const taken = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(and(eq(profiles.handle, normalized.handle)))
    .then((r) => r[0]);
  if (taken && taken.userId !== userId) throw new ApiError('HANDLE_TAKEN');
  await db
    .update(profiles)
    .set({
      handle: normalized.handle,
      handleClaimedAt: row.handleClaimedAt ?? now,
      handleChangedAt: now,
    })
    .where(eq(profiles.userId, userId));
  await audit(db, {
    actor: userId,
    action: 'handle.claim',
    target: normalized.handle,
  });
  return { status: 'ok', handle: normalized.handle };
}
