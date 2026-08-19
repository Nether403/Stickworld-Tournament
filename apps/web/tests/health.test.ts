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

  it('returns a generic 500 without exposing a database error', async () => {
    const check = vi.fn(async () => {
      throw new Error('password authentication failed for secret-user');
    });

    const response = await databaseHealthResponse(check);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('{"status":"unavailable"}');
  });
});
