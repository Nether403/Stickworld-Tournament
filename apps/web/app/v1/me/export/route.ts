import { ApiError, exportUserData, upsertProfile } from '@stickworld/platform';
import { authIdentity, getDb, jsonError } from '@/lib/server';

export async function GET(): Promise<Response> {
  try {
    const identity = await authIdentity();
    if (!identity.id) throw new ApiError('UNAUTHENTICATED');
    const db = getDb();
    const profile = await upsertProfile(db, identity.id, identity.email);
    const snapshot = await exportUserData(db, profile.userId);
    return Response.json(snapshot, {
      headers: {
        'Content-Disposition': 'attachment; filename="stickworld-export.json"',
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
