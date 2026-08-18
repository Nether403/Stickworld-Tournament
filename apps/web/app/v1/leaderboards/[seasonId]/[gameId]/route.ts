import { games, seasonGames, seasons } from '@stickworld/db';
import { and, eq } from 'drizzle-orm';
import { readLeaderboard } from '@stickworld/platform';
import { authUserId, getDb, jsonError } from '@/lib/server';
import { upsertProfile } from '@stickworld/platform';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ seasonId: string; gameId: string }> },
): Promise<Response> {
  try {
    const { seasonId, gameId } = await ctx.params;
    const url = new URL(req.url);
    const db = getDb();
    const season = await db.select().from(seasons).where(eq(seasons.id, seasonId)).then((r) => r[0]);
    const game = await db.select().from(games).where(eq(games.slug, gameId)).then((r) => r[0]);
    if (!season || !game) {
      return Response.json({ error: { code: 'ATTEMPT_NOT_FOUND', message: 'Attempt not found.' } }, { status: 404 });
    }
    const sg = await db
      .select()
      .from(seasonGames)
      .where(and(eq(seasonGames.seasonId, season.id), eq(seasonGames.gameId, game.id), eq(seasonGames.seedPolicy, 'fixed-course')))
      .then((r) => r[0]);
    if (!sg) {
      return Response.json({ error: { code: 'ATTEMPT_NOT_FOUND', message: 'Attempt not found.' } }, { status: 404 });
    }
    const authId = await authUserId();
    const viewer = authId ? await upsertProfile(db, authId) : undefined;
    const board = await readLeaderboard(db, season.id, sg.id, {
      cursor: url.searchParams.get('cursor') ?? undefined,
      limit: Number(url.searchParams.get('limit') ?? 50),
      viewerUserId: viewer?.userId,
    });
    return Response.json(board);
  } catch (err) {
    return jsonError(err);
  }
}
