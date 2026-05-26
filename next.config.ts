import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'node:child_process';
import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const revision =
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim() ||
  crypto.randomUUID();

const withSerwist = withSerwistInit({
  additionalPrecacheEntries: [{ url: '/~offline', revision }],
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
});

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

export default withSerwist(nextConfig);
