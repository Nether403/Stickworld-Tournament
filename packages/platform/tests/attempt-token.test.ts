import { describe, expect, it } from 'vitest';
import { signAttemptToken, verifyAttemptToken } from '../src/attempt-token.js';
import { ApiError } from '../src/errors.js';

const SECRET = 'a'.repeat(32);
const PREV = 'b'.repeat(32);

describe('attempt token', () => {
  it('round-trips a valid token', () => {
    const payload = {
      attemptId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      gameVersionId: '33333333-3333-4333-8333-333333333333',
      exp: Math.floor(Date.now() / 1000) + 60,
    };
    const token = signAttemptToken(payload, SECRET);
    expect(verifyAttemptToken(token, SECRET)).toEqual(payload);
  });

  it('accepts the previous secret during rotation', () => {
    const payload = {
      attemptId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      gameVersionId: '33333333-3333-4333-8333-333333333333',
      exp: Math.floor(Date.now() / 1000) + 60,
    };
    const token = signAttemptToken(payload, PREV);
    expect(verifyAttemptToken(token, SECRET, PREV).attemptId).toBe(payload.attemptId);
  });

  it('rejects tampering and expiry', () => {
    const payload = {
      attemptId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      gameVersionId: '33333333-3333-4333-8333-333333333333',
      exp: 1,
    };
    const token = signAttemptToken(payload, SECRET);
    expect(() => verifyAttemptToken(token, SECRET, '', 10)).toThrow(ApiError);
    expect(() => verifyAttemptToken(token.slice(0, -2) + 'aa', SECRET, '', 0)).toThrow(ApiError);
  });
});
