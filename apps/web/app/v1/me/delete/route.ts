import { anonymiseProfile, ApiError, upsertProfile } from '@stickworld/platform';
import { authIdentity, getDb, jsonError, platformContext } from '@/lib/server';

export async function POST(): Promise<Response> {
  try {
    const identity = await authIdentity();
    if (!identity.id) throw new ApiError('UNAUTHENTICATED');
    const db = getDb();
    const profile = await upsertProfile(db, identity.id, identity.email);
    const result = await anonymiseProfile(db, platformContext().clock, profile.userId);
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
