import type { NextConfig } from 'next';

function neonAuthOrigin(): string | undefined {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) return undefined;
  try {
    return new URL(baseUrl).origin;
  } catch {
    return undefined;
  }
}

const connectSources = ["'self'", neonAuthOrigin(), 'https://accounts.google.com'].filter(
  (source): source is string => Boolean(source),
);
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  `connect-src ${connectSources.join(' ')}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  transpilePackages: [
    '@stickworld/platform',
    '@stickworld/db',
    '@stickworld/replay',
    '@stickworld/sim-core',
    '@stickworld/game-host',
    '@stickworld/physics-kit',
    '@stickworld/scoring',
    '@stickworld/input',
    '@stickworld/telemetry',
    '@stickworld/ui',
    '@stickworld/game-hookline-sprint',
    '@stickworld/game-pickaxe-ascent',
    '@stickworld/game-launch-lab',
    '@stickworld/game-ragdoll-archery-rush',
    '@stickworld/game-hammer-throw-havoc',
    '@stickworld/game-pogo-tower',
    '@stickworld/game-rooftop-relay',
    '@stickworld/game-balance-bike-blitz',
    '@stickworld/game-cargo-chaos',
    '@stickworld/game-demolition-dive',
    'phaser',
  ],
  serverExternalPackages: ['pg', 'drizzle-orm'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
