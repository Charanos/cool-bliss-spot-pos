import { execSync } from 'node:child_process';
import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

/**
 * One name for this build, the same in the server, the pages and the service worker, so a station can
 * tell it is running an older build than the server it talks to (lib/pos/updates.ts). Set BLISS_BUILD_ID
 * to name it; otherwise the commit, otherwise the time of the build. Kept in the environment once
 * chosen: Next loads this file again in each build worker, and they inherit it rather than choosing a
 * second, different name.
 */
if (!process.env.BLISS_BUILD_ID) {
  let commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? '';
  if (!commit) {
    try {
      commit = execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (execSync('git status --porcelain --untracked-files=no', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()) commit += `.${Date.now().toString(36)}`;
    } catch {
      commit = '';
    }
  }
  process.env.BLISS_BUILD_ID = commit || `t${Date.now().toString(36)}`;
}

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  // A tablet that comes back into range must not reload the page under a waiter who is mid-order.
  // The sync cycle already notices the network itself, and nothing is lost by staying put.
  reloadOnOnline: false,
  // The page the worker falls back to when a navigation has no network and no cached copy. Its
  // revision is the build's name, so a tablet holding an older copy fetches the new one, and the
  // worker reads its own build from it (app/sw.ts).
  additionalPrecacheEntries: [{ url: '/offline', revision: process.env.BLISS_BUILD_ID }],
});

import { version } from './package.json';

const config: NextConfig = {
  reactStrictMode: true,
  // The version a station reports with its pull, so the Console shows which build each device runs.
  env: { NEXT_PUBLIC_BLISS_VERSION: `${version}+${process.env.BLISS_BUILD_ID}`, NEXT_PUBLIC_BLISS_BUILD: process.env.BLISS_BUILD_ID },
  poweredByHeader: false,
  // Workspace packages ship TypeScript source; one build, one deploy. ADR-004.
  transpilePackages: ['@bliss/ui', '@bliss/shared', '@bliss/db'],
  experimental: {
    optimizePackageImports: ['@tabler/icons-react'],
  },
  async headers() {
    return [
      {
        // Service worker must never be cached; browsers should always re-validate.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      {
        // Security headers on all routes.
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default withSerwist(config);
