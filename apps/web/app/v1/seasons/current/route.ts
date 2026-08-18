import { seasons } from '@stickworld/db';
import { eq } from 'drizzle-orm';
import { getDb, jsonError } from '@/lib/server';

export async function GET(): Promise<Response> {
  try {
    const db = getDb();
    const row = await db.select().from(seasons).where(eq(seasons.status, 'active')).then((r) => r[0]);
    if (!row) return Response.json({ season: null });
    return Response.json({
      season: { id: row.id, slug: row.slug, status: row.status, startsAt: row.startsAt, endsAt: row.endsAt },
    });
  } catch (err) {
    return jsonError(err);
  }
}
