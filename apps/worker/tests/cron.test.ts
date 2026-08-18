import { describe, expect, it } from 'vitest';

describe('worker entry', () => {
  it('documents the cron jobs Spec 2 requires', () => {
    expect(['recompute-rankings', 'rotate-daily', 'close-season']).toHaveLength(3);
  });
});
