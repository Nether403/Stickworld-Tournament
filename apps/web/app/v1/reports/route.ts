import { fileReport, upsertProfile } from '@stickworld/platform';
import { authIdentity, clientIp, getDb, jsonError, platformContext } from '@/lib/server';

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      targetHandle?: string;
      targetUserId?: string;
      reason_code?: string;
      details?: string;
    };
    const db = getDb();
    const identity = await authIdentity();
    const reporter = identity.id ? await upsertProfile(db, identity.id, identity.email) : undefined;
    const report = await fileReport(db, platformContext(), {
      reporterUserId: reporter?.userId,
      ip: clientIp(req),
      targetHandle: body.targetHandle,
      targetUserId: body.targetUserId,
      reasonCode: body.reason_code ?? '',
      details: body.details ?? '',
    });
    return Response.json(report, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
