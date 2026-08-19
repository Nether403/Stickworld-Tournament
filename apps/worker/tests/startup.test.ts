import { describe, expect, it } from 'vitest';
import { ensureWorkerCanStart } from '../src/startup.js';

describe('worker startup', () => {
  it('refuses to start when the database has pending migrations', async () => {
    const database = {
      async query() {
        return { rows: [] };
      },
    };

    await expect(ensureWorkerCanStart(database)).rejects.toThrow('Pending database migrations');
  });
});
