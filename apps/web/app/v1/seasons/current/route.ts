import { seasons } from '@stickworld/db';
import { asc, eq } from 'drizzle-orm';
import { getDb, jsonError } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(seasons)
      .where(eq(seasons.status, 'active'))
      .orderBy(asc(seasons.slug));
    const row = rows.find((season) => season.slug === 'ci') ?? rows[0];
    if (!row) return Response.json({ season: null });
    return Response.json({
      season: { id: row.id, slug: row.slug, status: row.status, startsAt: row.startsAt, endsAt: row.endsAt },
    });
  } catch (err) {
    return jsonError(err);
  }
}
