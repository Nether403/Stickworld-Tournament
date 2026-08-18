import { games } from '@stickworld/db';
import { getDb, jsonError } from '@/lib/server';

export async function GET(): Promise<Response> {
  try {
    const db = getDb();
    const rows = await db.select({ slug: games.slug, registryId: games.registryId }).from(games);
    return Response.json({ games: rows });
  } catch (err) {
    return jsonError(err);
  }
}
