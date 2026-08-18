import {
  auditEvents,
  moderationActions,
  profiles,
  ugcReports,
  type Database,
} from '@stickworld/db';
import { and, desc, eq, ne } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { audit } from './audit.js';
import type { PlatformContext, Clock } from './context.js';
import { ApiError } from './errors.js';
import { UGC_REPORT_RATE_PER_HOUR } from './limits.js';
import { floorWindow, hitRateLimit } from './rate-limit.js';

const REPORT_REASONS = new Set(['handle_impersonation', 'handle_offensive', 'other']);
const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export type ReportReason = 'handle_impersonation' | 'handle_offensive' | 'other';
export type ModerationAction = 'dismiss' | 'force_release_handle' | 'suspend' | 'unsuspend';

export function hashReporterIp(ip: string, hmacSecret: string): string {
  return createHash('sha256')
    .update(ip + hmacSecret)
    .digest('hex');
}

export async function fileReport(
  db: Database,
  ctx: PlatformContext,
  input: {
    reporterUserId?: string;
    ip: string;
    targetHandle?: string;
    targetUserId?: string;
    reasonCode: string;
    details?: string;
  },
): Promise<{ id: string; status: 'open' }> {
  if (
    !REPORT_REASONS.has(input.reasonCode) ||
    (!input.targetHandle && !input.targetUserId) ||
    Boolean(input.targetHandle && input.targetUserId) ||
    Boolean(input.targetUserId && !UUID_PATTERN.test(input.targetUserId))
  ) {
    throw new ApiError('HANDLE_INVALID');
  }
  const ipHash = hashReporterIp(input.ip, ctx.secrets.hmacSecret);
  await hitRateLimit(
    db,
    `report:ip:${ipHash}:h`,
    floorWindow(ctx.clock.now(), 60 * 60 * 1000),
    UGC_REPORT_RATE_PER_HOUR,
    'UGC_REPORT_RATE',
  );

  const target = input.targetUserId
    ? await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, input.targetUserId))
        .then((rows) => rows[0])
    : await db
        .select()
        .from(profiles)
        .where(eq(profiles.handle, input.targetHandle!))
        .then((rows) => rows[0]);
  if (!target) throw new ApiError('ATTEMPT_NOT_FOUND');

  const report = await db
    .insert(ugcReports)
    .values({
      reporterUserId: input.reporterUserId,
      reporterIpHash: ipHash,
      targetUserId: target.userId,
      reasonCode: input.reasonCode,
      details: input.details ?? '',
      status: 'open',
    })
    .returning({ id: ugcReports.id, status: ugcReports.status })
    .then((rows) => rows[0]);
  if (!report) throw new ApiError('INTERNAL');
  await audit(db, {
    actor: input.reporterUserId ?? null,
    action: 'ugc.report',
    target: report.id,
    meta: { targetUserId: target.userId, reasonCode: input.reasonCode },
  });
  return { id: report.id, status: 'open' };
}

export async function requireModerator(
  db: Database,
  actorUserId: string | undefined,
): Promise<void> {
  if (!actorUserId) throw new ApiError('FORBIDDEN');
  const actor = await db
    .select({ role: profiles.role, status: profiles.status })
    .from(profiles)
    .where(eq(profiles.userId, actorUserId))
    .then((rows) => rows[0]);
  if (actor?.role !== 'moderator' || actor.status !== 'active') throw new ApiError('FORBIDDEN');
}

export async function listModerationReports(
  db: Database,
  actorUserId: string | undefined,
  status: 'open' | 'dismissed' | 'actioned' = 'open',
): Promise<
  Array<{
    id: string;
    reporterUserId: string | null;
    targetUserId: string;
    targetHandle: string | null;
    reasonCode: string;
    details: string;
    status: 'open' | 'dismissed' | 'actioned';
    createdAt: Date;
  }>
> {
  await requireModerator(db, actorUserId);
  return db
    .select({
      id: ugcReports.id,
      reporterUserId: ugcReports.reporterUserId,
      targetUserId: ugcReports.targetUserId,
      targetHandle: profiles.handle,
      reasonCode: ugcReports.reasonCode,
      details: ugcReports.details,
      status: ugcReports.status,
      createdAt: ugcReports.createdAt,
    })
    .from(ugcReports)
    .innerJoin(profiles, eq(profiles.userId, ugcReports.targetUserId))
    .where(eq(ugcReports.status, status))
    .orderBy(desc(ugcReports.createdAt));
}

export async function moderateReport(
  db: Database,
  clock: Clock,
  input: {
    actorUserId: string;
    reportId: string;
    action: ModerationAction;
    reasonCode: string;
    reasonText: string;
  },
): Promise<{ id: string; status: 'dismissed' | 'actioned' }> {
  await requireModerator(db, input.actorUserId);
  if (!input.reasonCode.trim() || !input.reasonText.trim()) throw new ApiError('HANDLE_INVALID');
  const report = await db
    .select()
    .from(ugcReports)
    .where(and(eq(ugcReports.id, input.reportId), eq(ugcReports.status, 'open')))
    .then((rows) => rows[0]);
  if (!report) throw new ApiError('ATTEMPT_NOT_FOUND');
  const now = clock.now();
  const status = input.action === 'dismiss' ? 'dismissed' : 'actioned';

  const actionRow = await db.transaction(async (tx) => {
    if (input.action === 'force_release_handle') {
      await tx
        .update(profiles)
        .set({ handle: null, handleClaimedAt: null, handleChangedAt: null })
        .where(eq(profiles.userId, report.targetUserId));
    } else if (input.action === 'suspend') {
      await tx
        .update(profiles)
        .set({ status: 'suspended' })
        .where(and(eq(profiles.userId, report.targetUserId), eq(profiles.status, 'active')));
    } else if (input.action === 'unsuspend') {
      await tx
        .update(profiles)
        .set({ status: 'active' })
        .where(and(eq(profiles.userId, report.targetUserId), eq(profiles.status, 'suspended')));
    }
    await tx.update(ugcReports).set({ status }).where(eq(ugcReports.id, report.id));
    const inserted = await tx
      .insert(moderationActions)
      .values({
        reportId: report.id,
        actorUserId: input.actorUserId,
        targetUserId: report.targetUserId,
        action: input.action,
        reasonCode: input.reasonCode.trim(),
        reasonText: input.reasonText.trim(),
        createdAt: now,
      })
      .returning({ id: moderationActions.id })
      .then((rows) => rows[0]);
    await tx.insert(auditEvents).values({
      actor: input.actorUserId,
      action: `moderation.${input.action}`,
      target: report.targetUserId,
      requestMeta: {
        reportId: report.id,
        reasonCode: input.reasonCode.trim(),
        reasonText: input.reasonText.trim(),
      },
      createdAt: now,
    });
    return inserted;
  });
  if (!actionRow) throw new ApiError('INTERNAL');
  return { id: actionRow.id, status };
}

export async function listUserNotices(
  db: Database,
  userId: string,
): Promise<
  Array<{
    id: string;
    action: ModerationAction;
    reasonCode: string;
    reasonText: string;
    redress: string;
    createdAt: Date;
  }>
> {
  const rows = await db
    .select()
    .from(moderationActions)
    .where(and(eq(moderationActions.targetUserId, userId), ne(moderationActions.action, 'dismiss')))
    .orderBy(desc(moderationActions.createdAt));
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    reasonCode: row.reasonCode,
    reasonText: row.reasonText,
    redress: 'You may reply by emailing the operator address published on /legal.',
    createdAt: row.createdAt,
  }));
}
