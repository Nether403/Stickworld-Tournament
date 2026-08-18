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
    '@stickworld/game-pickaxe-ascent',
    '@stickworld/game-launch-lab',
    '@stickworld/game-ragdoll-archery-rush',
    '@stickworld/game-hammer-throw-havoc',
    'phaser',
  ],
  serverExternalPackages: ['pg', 'drizzle-orm'],
};

export default nextConfig;
