import { createDb, createPool, loadWorkspaceEnv, seasons } from '@stickworld/db';
import { recomputeAllDirty, rotateDaily, closeSeason, systemClock } from '@stickworld/platform';
import { emit, type Tags } from '@stickworld/telemetry';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

loadWorkspaceEnv();

const job = process.argv[2];

export interface CronOperations {
  recomputeRankings(): Promise<void>;
  rotateDaily(): Promise<void>;
  closeSeason(slug: string): Promise<void>;
}

const durationMs = (startedAt: number): number =>
  Math.round((performance.now() - startedAt) * 1_000) / 1_000;

function failureCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'INTERNAL';
}

export async function runCronJob(
  jobName: string | undefined,
  operations: CronOperations,
  slug = 'ci',
): Promise<void> {
  const startedAt = performance.now();
  const tags: Tags = {
    gameId: jobName ?? 'unknown',
    gameVersion: 'n/a',
    mode: 'ranked',
    browserFamily: 'unknown',
    deviceClass: 'unknown',
  };
  emit('cron.start', tags);
  try {
    if (jobName === 'recompute-rankings') {
      await operations.recomputeRankings();
    } else if (jobName === 'rotate-daily') {
      await operations.rotateDaily();
    } else if (jobName === 'close-season') {
      await operations.closeSeason(slug);
    } else {
      throw new Error(
        'usage: node dist/cron.js <recompute-rankings|rotate-daily|close-season> [slug]',
      );
    }
    emit('cron.ok', { ...tags, durationMs: durationMs(startedAt) });
  } catch (error) {
    emit('cron.reject', {
      ...tags,
      reasonCode: failureCode(error),
      durationMs: durationMs(startedAt),
    });
    throw error;
  }
}

async function main(): Promise<void> {
  const pool = createPool();
  const db = createDb(pool);
  try {
    await runCronJob(
      job,
      {
        recomputeRankings: () => recomputeAllDirty(db, systemClock),
        rotateDaily: () => rotateDaily(db, { randomBytes: (n) => randomBytes(n) }),
        closeSeason: async (slug) => {
          const season = await db
            .select()
            .from(seasons)
            .where(eq(seasons.slug, slug))
            .then((rows) => rows[0]);
          if (!season) throw new Error(`unknown season ${slug}`);
          await closeSeason(db, systemClock, season.id);
        },
      },
      process.argv[3],
    );
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
