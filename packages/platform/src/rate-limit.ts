import { rateLimitHits, type Database } from '@stickworld/db';
import { sql } from 'drizzle-orm';
import { ApiError } from './errors.js';
import type { ReasonCode } from './reason-codes.js';

export async function hitRateLimit(
  db: Database,
  key: string,
  windowStart: Date,
  limit: number,
  reasonCode: ReasonCode = 'RATE_LIMITED',
): Promise<void> {
  const rows = await db
    .insert(rateLimitHits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitHits.key, rateLimitHits.windowStart],
      set: { count: sql`${rateLimitHits.count} + 1` },
    })
    .returning({ count: rateLimitHits.count });
  const count = rows[0]?.count ?? 0;
  if (count > limit) throw new ApiError(reasonCode);
}

export function floorWindow(now: Date, ms: number): Date {
  return new Date(Math.floor(now.getTime() / ms) * ms);
}
