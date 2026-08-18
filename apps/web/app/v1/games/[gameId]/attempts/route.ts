import { issueAttempt, requireRankedUser, ApiError } from '@stickworld/platform';
import { authUserId, clientIp, getDb, jsonError, platformContext } from '@/lib/server';

export async function POST(req: Request, ctx: { params: Promise<{ gameId: string }> }): Promise<Response> {
  try {
    const authId = await authUserId();
    if (!authId) throw new ApiError('UNAUTHENTICATED');
    const db = getDb();
    const user = await requireRankedUser(db, authId);
    const { gameId } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      seedPolicy?: 'fixed-course' | 'daily-seed' | 'weekly-seed';
    };
    const result = await issueAttempt(db, platformContext(), {
      userId: user.userId,
      gameSlug: gameId,
      seedPolicy: body.seedPolicy ?? 'fixed-course',
      ip: clientIp(req),
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
