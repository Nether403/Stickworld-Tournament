import { sql } from 'drizzle-orm';
import { databaseHealthResponse } from '@/lib/health';
import { getDb } from '@/lib/server';

export async function GET(): Promise<Response> {
  return databaseHealthResponse(async () => {
    await getDb().execute(sql`select 1`);
  });
}
