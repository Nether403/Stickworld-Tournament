import type { NextConfig } from 'next';

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
    'phaser',
  ],
  serverExternalPackages: ['pg', 'drizzle-orm'],
};

export default nextConfig;
