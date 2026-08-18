import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@stickworld/platform',
    '@stickworld/db',
    '@stickworld/replay',
    '@stickworld/sim-core',
    '@stickworld/game-host',
    '@stickworld/game-hookline-sprint',
    '@stickworld/game-pickaxe-ascent',
    '@stickworld/physics-kit',
    '@stickworld/scoring',
    '@stickworld/input',
    '@stickworld/ui',
    '@stickworld/telemetry',
    'phaser',
  ],
  serverExternalPackages: ['pg', 'drizzle-orm'],
};

export default nextConfig;
