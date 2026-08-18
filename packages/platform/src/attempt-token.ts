import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from './errors.js';
import { HMAC_SECRET_MIN_BYTES } from './limits.js';

export interface AttemptTokenPayload {
  attemptId: string;
  userId: string;
  gameVersionId: string;
  exp: number;
}

function b64url(data: Buffer | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return buf.toString('base64url');
}

function hmac(json: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(json, 'utf8').digest();
}

export function assertSecret(secret: string): void {
  if (Buffer.byteLength(secret, 'utf8') < HMAC_SECRET_MIN_BYTES) {
    throw new Error('ATTEMPT_HMAC_SECRET must be at least 32 bytes');
  }
}

export function signAttemptToken(payload: AttemptTokenPayload, secret: string): string {
  assertSecret(secret);
  const json = JSON.stringify(payload);
  return `${b64url(json)}.${b64url(hmac(json, secret))}`;
}

function verifyWithSecret(token: string, secret: string): AttemptTokenPayload | undefined {
  const dot = token.indexOf('.');
  if (dot <= 0) return undefined;
  const jsonPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);
  let json: string;
  let sig: Buffer;
  try {
    json = Buffer.from(jsonPart, 'base64url').toString('utf8');
    sig = Buffer.from(sigPart, 'base64url');
  } catch {
    return undefined;
  }
  const expected = hmac(json, secret);
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return undefined;
  try {
    const parsed = JSON.parse(json) as AttemptTokenPayload;
    if (
      typeof parsed.attemptId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.gameVersionId !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export function verifyAttemptToken(
  token: string,
  secret: string,
  prev = '',
  nowSeconds = Math.floor(Date.now() / 1000),
): AttemptTokenPayload {
  const payload = verifyWithSecret(token, secret) ?? (prev ? verifyWithSecret(token, prev) : undefined);
  if (!payload) throw new ApiError('TOKEN_INVALID');
  if (payload.exp < nowSeconds) throw new ApiError('ATTEMPT_EXPIRED');
  return payload;
}
