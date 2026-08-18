import { scoreSubmissions } from '@stickworld/db';
import { eq } from 'drizzle-orm';
import { getDb, jsonError } from '@/lib/server';

export async function GET(_req: Request, ctx: { params: Promise<{ runId: string }> }): Promise<Response> {
  try {
    const { runId } = await ctx.params;
    const db = getDb();
    const row = await db.select().from(scoreSubmissions).where(eq(scoreSubmissions.runId, runId)).then((r) => r[0]);
    if (!row) {
      return Response.json({ error: { code: 'ATTEMPT_NOT_FOUND', message: 'Attempt not found.' } }, { status: 404 });
    }
    return Response.json({
      runId,
      status: row.verificationStatus,
      reasonCode: row.reasonCode,
      firstDivergentTick: row.firstDivergentTick,
      verifiedScore: row.verifiedScore?.toString() ?? null,
      asOf: row.verifiedAt?.toISOString() ?? null,
    });
  } catch (err) {
    return jsonError(err);
  }
}
