import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
};

export default nextConfig;
