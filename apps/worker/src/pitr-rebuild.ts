import { createDb, createPool, loadWorkspaceEnv, seasons } from '@stickworld/db';
import { rebuildSeasonForRestoreDrill, systemClock } from '@stickworld/platform';
import { eq } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';

loadWorkspaceEnv();

export function assertPitrRebuildOptIn(value: string | undefined): void {
  if (value !== '1') {
    throw new Error('refusing PITR rebuild without STICKWORLD_PITR_REBUILD=1');
  }
}

export function assertClosedSeasonForPitr(season: { slug: string; status: string }): void {
  if (season.status !== 'closed') {
    throw new Error(
      `season ${season.slug} is ${season.status}; PITR rebuild requires a closed season`,
    );
  }
}

async function main(): Promise<void> {
  const seasonSlug = process.argv[2];
  if (!seasonSlug) throw new Error('usage: node dist/pitr-rebuild.js <season-slug>');
  assertPitrRebuildOptIn(process.env.STICKWORLD_PITR_REBUILD);

  const pool = createPool();
  const db = createDb(pool);
  try {
    const season = await db
      .select({ id: seasons.id, slug: seasons.slug, status: seasons.status })
      .from(seasons)
      .where(eq(seasons.slug, seasonSlug))
      .then((rows) => rows[0]);
    if (!season) throw new Error(`unknown season ${seasonSlug}`);
    assertClosedSeasonForPitr(season);

    const rebuilt = await rebuildSeasonForRestoreDrill(db, systemClock, season.id);
    if (!rebuilt) throw new Error(`could not rebuild season ${seasonSlug}`);
    process.stdout.write(`rebuilt rankings for ${seasonSlug}\n`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
