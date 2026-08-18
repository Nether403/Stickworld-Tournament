import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@stickworld/platform', '@stickworld/db', '@stickworld/replay'],
  serverExternalPackages: ['pg', 'drizzle-orm'],
};

export default nextConfig;
