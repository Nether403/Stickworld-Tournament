import {
  ApiError,
  moderateReport,
  requireModerator,
  upsertProfile,
  type ModerationAction,
} from '@stickworld/platform';
import { authIdentity, getDb, jsonError, platformContext } from '@/lib/server';

const ACTIONS = new Set<ModerationAction>([
  'dismiss',
  'force_release_handle',
  'suspend',
  'unsuspend',
]);

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const identity = await authIdentity();
    const db = getDb();
    const actor = identity.id ? await upsertProfile(db, identity.id, identity.email) : undefined;
    if (!actor) throw new ApiError('FORBIDDEN');
    await requireModerator(db, actor.userId);
    const body = (await req.json().catch(() => ({}))) as {
      action?: ModerationAction;
      reason_code?: string;
      reason_text?: string;
    };
    if (!body.action || !ACTIONS.has(body.action)) throw new ApiError('HANDLE_INVALID');
    const { id } = await context.params;
    const result = await moderateReport(db, platformContext().clock, {
      actorUserId: actor.userId,
      reportId: id,
      action: body.action,
      reasonCode: body.reason_code ?? '',
      reasonText: body.reason_text ?? '',
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
