import { games, seasonGames } from '@stickworld/db';
import { and, eq } from 'drizzle-orm';
import { readLeaderboard } from '@stickworld/platform';
import { seasons } from '@stickworld/db';
import { getDb, jsonError } from '@/lib/server';

export async function GET(_req: Request, ctx: { params: Promise<{ gameId: string }> }): Promise<Response> {
  try {
    const { gameId } = await ctx.params;
    const db = getDb();
    const game = await db.select().from(games).where(eq(games.slug, gameId)).then((r) => r[0]);
    const season = await db.select().from(seasons).where(eq(seasons.status, 'active')).then((r) => r[0]);
    if (!game || !season) {
      return Response.json({ rows: [], asOf: null });
    }
    const sg = await db
      .select()
      .from(seasonGames)
      .where(and(eq(seasonGames.seasonId, season.id), eq(seasonGames.gameId, game.id), eq(seasonGames.seedPolicy, 'daily-seed')))
      .then((r) => r[0]);
    if (!sg) return Response.json({ rows: [], asOf: null });
    const board = await readLeaderboard(db, season.id, sg.id, {});
    return Response.json(board);
  } catch (err) {
    return jsonError(err);
  }
}
