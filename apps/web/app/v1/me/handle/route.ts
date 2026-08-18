import { claimHandle, upsertProfile } from '@stickworld/platform';
import { authUserId, getDb, jsonError, platformContext } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request): Promise<Response> {
  try {
    const authId = await authUserId();
    if (!authId) {
      return Response.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } }, { status: 401 });
    }
    const db = getDb();
    const profile = await upsertProfile(db, authId);
    const body = (await req.json()) as { handle?: string };
    const result = await claimHandle(db, platformContext().clock, profile.userId, body.handle ?? '');
    if (result.status === 'noop') return new Response(null, { status: 204 });
    return Response.json({ handle: result.handle });
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET(): Promise<Response> {
  try {
    const authId = await authUserId();
    if (!authId) {
      return Response.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } }, { status: 401 });
    }
    const db = getDb();
    const profile = await upsertProfile(db, authId);
    return Response.json(profile);
  } catch (err) {
    return jsonError(err);
  }
}
