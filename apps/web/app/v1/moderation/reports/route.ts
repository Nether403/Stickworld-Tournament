import { listModerationReports, upsertProfile } from '@stickworld/platform';
import { authIdentity, getDb, jsonError } from '@/lib/server';

const REPORT_STATUSES = new Set(['open', 'dismissed', 'actioned']);

export async function GET(req: Request): Promise<Response> {
  try {
    const identity = await authIdentity();
    const db = getDb();
    const actor = identity.id ? await upsertProfile(db, identity.id, identity.email) : undefined;
    const requestedStatus = new URL(req.url).searchParams.get('status') ?? 'open';
    const status = REPORT_STATUSES.has(requestedStatus)
      ? (requestedStatus as 'open' | 'dismissed' | 'actioned')
      : 'open';
    const reports = await listModerationReports(db, actor?.userId, status);
    return Response.json({ reports });
  } catch (error) {
    return jsonError(error);
  }
}
