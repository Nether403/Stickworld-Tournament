import { dailyBoards, seasonGames, type Database } from '@stickworld/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { Entropy } from './context.js';
import { packSeed, seedFromBytes, isDegenerateSeed } from './seed128.js';

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addUtcDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function freshSeed(entropy: Entropy): Buffer {
  let seed = seedFromBytes(entropy.randomBytes(16));
  let n = 0;
  while (isDegenerateSeed(seed)) {
    n += 1;
    if (n > 8) throw new Error('degenerate daily seed');
    seed = seedFromBytes(entropy.randomBytes(16));
  }
  return packSeed(seed);
}

export async function rotateDaily(db: Database, entropy: Entropy, now = new Date()): Promise<void> {
  const today = utcDateString(now);
  const yesterday = addUtcDays(today, -1);
  const tomorrow = addUtcDays(today, 1);
  const dailies = await db.select().from(seasonGames).where(eq(seasonGames.seedPolicy, 'daily-seed'));
  for (const sg of dailies) {
    await db
      .update(dailyBoards)
      .set({ archivedAt: now })
      .where(
        and(
          eq(dailyBoards.seasonGameId, sg.id),
          eq(dailyBoards.utcDate, yesterday),
          isNull(dailyBoards.archivedAt),
        ),
      );
    for (const day of [today, tomorrow]) {
      await db
        .insert(dailyBoards)
        .values({ seasonGameId: sg.id, utcDate: day, seed: freshSeed(entropy) })
        .onConflictDoNothing();
    }
  }
}
