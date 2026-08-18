import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { loadWorkspaceEnv, requireEnv } from './env.js';
import { schema } from './schema.js';

loadWorkspaceEnv();

export type Database = NodePgDatabase<typeof schema>;

export function createPool(connectionString = requireEnv('DATABASE_URL')): pg.Pool {
  return new pg.Pool({ connectionString, max: 8 });
}

export function createDb(pool: pg.Pool): Database {
  return drizzle(pool, { schema });
}

export function createDirectPool(connectionString = requireEnv('DATABASE_URL_UNPOOLED')): pg.Pool {
  return new pg.Pool({ connectionString, max: 2 });
}
