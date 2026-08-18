import { ApiError, listUserNotices, upsertProfile } from '@stickworld/platform';
import { authIdentity, getDb, jsonError } from '@/lib/server';

export async function GET(): Promise<Response> {
  try {
    const identity = await authIdentity();
    if (!identity.id) throw new ApiError('UNAUTHENTICATED');
    const db = getDb();
    const profile = await upsertProfile(db, identity.id, identity.email);
    const notices = await listUserNotices(db, profile.userId);
    return Response.json({ notices });
  } catch (error) {
    return jsonError(error);
  }
}
