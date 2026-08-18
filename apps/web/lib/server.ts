import { createDb, createPool, loadWorkspaceEnv, type Database } from '@stickworld/db';
import { randomBytes } from 'node:crypto';
import type { PlatformContext } from '@stickworld/platform';

loadWorkspaceEnv();

let db: Database | undefined;
let pool: ReturnType<typeof createPool> | undefined;

export function getDb(): Database {
  if (!db) {
    pool = createPool();
    db = createDb(pool);
  }
  return db;
}

export function platformContext(): PlatformContext {
  const secret = process.env.ATTEMPT_HMAC_SECRET;
  if (!secret) throw new Error('ATTEMPT_HMAC_SECRET is required');
  return {
    clock: { now: () => new Date() },
    entropy: { randomBytes: (n) => randomBytes(n) },
    secrets: { hmacSecret: secret, hmacSecretPrev: process.env.ATTEMPT_HMAC_SECRET_PREV ?? '' },
  };
}

export async function authIdentity(): Promise<{ id?: string; email?: string | null }> {
  const { auth } = await import('./auth/server');
  try {
    const result = await auth.getSession();
    return {
      id: result.data?.user?.id,
      email: result.data?.user?.email,
    };
  } catch {
    return {};
  }
}

export async function authUserId(): Promise<string | undefined> {
  return (await authIdentity()).id;
}

export async function authEmail(): Promise<string | null | undefined> {
  return (await authIdentity()).email;
}

export function jsonError(err: unknown): Response {
  if (err && typeof err === 'object' && 'code' in err && 'status' in err && 'toJSON' in err) {
    const api = err as { status: number; toJSON: () => unknown };
    return Response.json(api.toJSON(), { status: api.status });
  }
  return Response.json(
    { error: { code: 'INTERNAL', message: 'Something went wrong.' } },
    { status: 500 },
  );
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
}
