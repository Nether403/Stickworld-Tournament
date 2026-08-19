import { finishAttempt, requireRankedUser } from '@stickworld/platform';
import { authIdentity, getDb, jsonError, platformContext } from '@/lib/server';
import { emitRequestTelemetry } from '@/lib/request-telemetry';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ attemptId: string }> },
): Promise<Response> {
  try {
    const identity = await authIdentity();
    const db = getDb();
    const user = await requireRankedUser(db, identity.id, identity.email);
    const { attemptId } = await ctx.params;
    const body = (await req.json()) as { token?: string; replay?: string; claimedScore?: string };
    const result = await finishAttempt(db, platformContext(), {
      userId: user.userId,
      attemptId,
      token: body.token ?? '',
      replayB64: body.replay ?? '',
      claimedScore: body.claimedScore ?? '',
    });
    emitRequestTelemetry(req, 'attempt.finish', {
      gameId: result.gameId,
      gameVersion: result.gameVersion,
      seasonId: result.seasonId,
      mode: 'ranked',
    });
    return Response.json(result, { status: 202 });
  } catch (err) {
    return jsonError(err);
  }
}
