import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadWorkspaceEnv, requireEnv } from './env.js';
import { schema } from './schema.js';

const here = dirname(fileURLToPath(import.meta.url));

const TRIGGER_SQL = `
CREATE OR REPLACE FUNCTION assert_verified_run() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM score_submissions s
    WHERE s.run_id = NEW.run_id AND s.verification_status = 'verified'
  ) THEN
    RAISE EXCEPTION 'verified_results require a verified submission';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS verified_results_assert_verified ON verified_results;
CREATE TRIGGER verified_results_assert_verified
  BEFORE INSERT OR UPDATE ON verified_results
  FOR EACH ROW EXECUTE FUNCTION assert_verified_run();
`;

export async function applyMigrations(connectionString?: string): Promise<void> {
  loadWorkspaceEnv();
  const url = connectionString ?? requireEnv('DATABASE_URL_UNPOOLED');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS citext');
    const db = drizzle(client, { schema });
    const migrationsFolder = resolve(here, '../drizzle');
    await migrate(db, { migrationsFolder });
    await client.query(TRIGGER_SQL);
  } finally {
    await client.end();
  }
}

/** Drop Spec 2 tables on a throwaway branch, including the Drizzle journal. */
export async function rollbackInitial(connectionString?: string): Promise<void> {
  loadWorkspaceEnv();
  const url = connectionString ?? requireEnv('DATABASE_URL_UNPOOLED');
  const complianceDown = readFileSync(
    resolve(here, '../drizzle/0002_spec5_compliance.down.sql'),
    'utf8',
  );
  const initialDown = readFileSync(resolve(here, '../drizzle/0000_init.down.sql'), 'utf8');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(complianceDown);
    await client.query(initialDown);
    await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  applyMigrations().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
