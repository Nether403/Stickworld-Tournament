import { finishAttempt, requireRankedUser } from '@stickworld/platform';
import { authUserId, getDb, jsonError, platformContext } from '@/lib/server';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ attemptId: string }> },
): Promise<Response> {
  try {
    const authId = await authUserId();
    const db = getDb();
    const user = await requireRankedUser(db, authId);
    const { attemptId } = await ctx.params;
    const body = (await req.json()) as { token?: string; replay?: string; claimedScore?: string };
    const result = await finishAttempt(db, platformContext(), {
      userId: user.userId,
      attemptId,
      token: body.token ?? '',
      replayB64: body.replay ?? '',
      claimedScore: body.claimedScore ?? '',
    });
    return Response.json(result, { status: 202 });
  } catch (err) {
    return jsonError(err);
  }
}
