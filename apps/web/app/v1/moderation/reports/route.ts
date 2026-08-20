import { ApiError, listModerationReports, upsertProfile } from '@stickworld/platform';
import { authIdentity, getDb, jsonError } from '@/lib/server';

const REPORT_STATUSES = new Set(['open', 'dismissed', 'actioned']);

export async function GET(req: Request): Promise<Response> {
  try {
    const identity = await authIdentity();
    if (!identity.id) throw new ApiError('FORBIDDEN');
    const db = getDb();
    const actor = await upsertProfile(db, identity.id, identity.email);
    const requestedStatus = new URL(req.url).searchParams.get('status') ?? 'open';
    const status = REPORT_STATUSES.has(requestedStatus)
      ? (requestedStatus as 'open' | 'dismissed' | 'actioned')
      : 'open';
    const reports = await listModerationReports(db, actor.userId, status);
    return Response.json({ reports });
  } catch (error) {
    return jsonError(error);
  }
}
