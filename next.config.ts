import path from 'path';
import { fileURLToPath } from 'url';
import type { NextConfig } from 'next';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** Avoid picking a parent folder when another lockfile exists (e.g. ~/package-lock.json). */
  turbopack: { root: projectRoot },
  transpilePackages: ['lighter-sdk-client'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
        pathname: '/coins/images/**',
      },
      {
        protocol: 'https',
        hostname: 'app.hyperliquid.xyz',
        pathname: '/coins/**',
      },
    ],
  },
};

export default nextConfig;
