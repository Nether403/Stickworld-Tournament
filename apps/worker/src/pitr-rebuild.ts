import { createDb, createPool, loadWorkspaceEnv, seasons } from '@stickworld/db';
import { rebuildSeasonForRestoreDrill, systemClock } from '@stickworld/platform';
import { eq } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';

loadWorkspaceEnv();

async function main(): Promise<void> {
  const seasonSlug = process.argv[2];
  if (!seasonSlug) throw new Error('usage: node dist/pitr-rebuild.js <season-slug>');

  const pool = createPool();
  const db = createDb(pool);
  try {
    const season = await db
      .select({ id: seasons.id })
      .from(seasons)
      .where(eq(seasons.slug, seasonSlug))
      .then((rows) => rows[0]);
    if (!season) throw new Error(`unknown season ${seasonSlug}`);

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
