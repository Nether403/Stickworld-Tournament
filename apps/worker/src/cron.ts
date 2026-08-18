import { createDb, createPool, loadWorkspaceEnv, seasons } from '@stickworld/db';
import { recomputeAllDirty, rotateDaily, closeSeason, systemClock } from '@stickworld/platform';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';

loadWorkspaceEnv();

const job = process.argv[2];

async function main(): Promise<void> {
  const pool = createPool();
  const db = createDb(pool);
  try {
    if (job === 'recompute-rankings') {
      await recomputeAllDirty(db, systemClock);
    } else if (job === 'rotate-daily') {
      await rotateDaily(db, { randomBytes: (n) => randomBytes(n) });
    } else if (job === 'close-season') {
      const slug = process.argv[3] ?? 'ci';
      const season = await db.select().from(seasons).where(eq(seasons.slug, slug)).then((r) => r[0]);
      if (!season) throw new Error(`unknown season ${slug}`);
      await closeSeason(db, systemClock, season.id);
    } else {
      throw new Error('usage: node dist/cron.js <recompute-rankings|rotate-daily|close-season> [slug]');
    }
  } finally {
    await pool.end();
  }
}

void main();
