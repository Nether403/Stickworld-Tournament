import { createDb, createPool, loadWorkspaceEnv } from '@stickworld/db';
import { processNextJob } from '@stickworld/platform/verify';
import { systemClock } from '@stickworld/platform';
import { pathToFileURL } from 'node:url';
import { ensureWorkerCanStart } from './startup.js';

loadWorkspaceEnv();

const workerId = process.env.WORKER_ID ?? `worker-${process.pid}`;

async function main(): Promise<void> {
  const pool = createPool();
  try {
    await ensureWorkerCanStart(pool);
  } catch (error) {
    await pool.end();
    throw error;
  }
  const db = createDb(pool);
  process.on('SIGTERM', () => {
    void pool.end().then(() => process.exit(0));
  });
  for (;;) {
    const did = await processNextJob(db, systemClock, workerId);
    if (!did) await new Promise((r) => setTimeout(r, 500));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
