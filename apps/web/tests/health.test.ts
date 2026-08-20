import { describe, expect, it, vi } from 'vitest';
import { databaseHealthResponse } from '../lib/health.js';

describe('databaseHealthResponse', () => {
  it('returns 200 after the pooled database check succeeds', async () => {
    const check = vi.fn(async () => ({ rows: [{ '?column?': 1 }] }));

    const response = await databaseHealthResponse(check);

    expect(check).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('returns 500 when STICKWORLD_HEALTH_FAIL=1 without touching the database', async () => {
    const previous = process.env.STICKWORLD_HEALTH_FAIL;
    process.env.STICKWORLD_HEALTH_FAIL = '1';
    const check = vi.fn(async () => ({ rows: [{ '?column?': 1 }] }));
    try {
      const response = await databaseHealthResponse(check);
      expect(check).not.toHaveBeenCalled();
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ status: 'unavailable' });
    } finally {
      if (previous === undefined) delete process.env.STICKWORLD_HEALTH_FAIL;
      else process.env.STICKWORLD_HEALTH_FAIL = previous;
    }
  });

  it('returns a generic 500 without exposing a database error', async () => {
    const check = vi.fn(async () => {
      throw new Error('password authentication failed for secret-user');
    });

    const response = await databaseHealthResponse(check);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('{"status":"unavailable"}');
  });
});
