import { readStandings } from '@stickworld/platform';
import { getDb, jsonError } from '@/lib/server';

export async function GET(_req: Request, ctx: { params: Promise<{ seasonId: string }> }): Promise<Response> {
  try {
    const { seasonId } = await ctx.params;
    const board = await readStandings(getDb(), seasonId);
    return Response.json(board);
  } catch (err) {
    return jsonError(err);
  }
}
