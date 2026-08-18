import { createDb, createPool, loadWorkspaceEnv } from '@stickworld/db';
import { processNextJob } from '@stickworld/platform/verify';
import { systemClock } from '@stickworld/platform';

loadWorkspaceEnv();

const workerId = process.env.WORKER_ID ?? `worker-${process.pid}`;

async function main(): Promise<void> {
  const pool = createPool();
  const db = createDb(pool);
  process.on('SIGTERM', () => {
    void pool.end().then(() => process.exit(0));
  });
  for (;;) {
    const did = await processNextJob(db, systemClock, workerId);
    if (!did) await new Promise((r) => setTimeout(r, 500));
  }
}

void main();
