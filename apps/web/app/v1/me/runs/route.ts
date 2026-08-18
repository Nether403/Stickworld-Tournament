import { attempts } from '@stickworld/db';
import { desc, eq } from 'drizzle-orm';
import { requireRankedUser } from '@stickworld/platform';
import { authUserId, getDb, jsonError } from '@/lib/server';

export async function GET(): Promise<Response> {
  try {
    const db = getDb();
    const user = await requireRankedUser(db, await authUserId());
    const rows = await db
      .select()
      .from(attempts)
      .where(eq(attempts.userId, user.userId))
      .orderBy(desc(attempts.issuedAt))
      .limit(50);
    return Response.json({
      runs: rows.map((row) => ({
        attemptId: row.id,
        status: row.status,
        issuedAt: row.issuedAt,
        expiresAt: row.expiresAt,
      })),
    });
  } catch (err) {
    return jsonError(err);
  }
}
