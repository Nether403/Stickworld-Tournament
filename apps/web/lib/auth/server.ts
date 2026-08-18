import { createNeonAuth } from '@neondatabase/auth/next/server';

function cookieSecret(): string {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (secret && secret.length >= 32) return secret;
  return 'dev-only-not-for-production-use-32b';
}

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL || 'https://placeholder.invalid/neondb/auth',
  cookies: {
    secret: cookieSecret(),
  },
});
