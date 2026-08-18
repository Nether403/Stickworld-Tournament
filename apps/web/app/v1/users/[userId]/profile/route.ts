import { profiles } from '@stickworld/db';
import { eq } from 'drizzle-orm';
import { getDb, jsonError } from '@/lib/server';

export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }): Promise<Response> {
  try {
    const { userId } = await ctx.params;
    const row = await getDb().select().from(profiles).where(eq(profiles.userId, userId)).then((r) => r[0]);
    if (!row) {
      return Response.json({ error: { code: 'ATTEMPT_NOT_FOUND', message: 'Attempt not found.' } }, { status: 404 });
    }
    return Response.json({ userId: row.userId, handle: row.handle, createdAt: row.createdAt });
  } catch (err) {
    return jsonError(err);
  }
}
