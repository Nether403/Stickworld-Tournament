import { assertMigrationsCurrent, type MigrationQueryClient } from '@stickworld/db';

export async function ensureWorkerCanStart(database: MigrationQueryClient): Promise<void> {
  await assertMigrationsCurrent(database);
}
