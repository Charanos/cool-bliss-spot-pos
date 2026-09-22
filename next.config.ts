import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  // A tablet that comes back into range must not reload the page under a waiter who is mid-order.
  // The sync cycle already notices the network itself, and nothing is lost by staying put.
  reloadOnOnline: false,
  // The page the worker falls back to when a navigation has no network and no cached copy. Its
  // revision changes per build, so a tablet holding an older copy fetches the new one. Written
  // inline because Next compiles this file on its own and a top level const does not survive it.
  additionalPrecacheEntries: [{ url: '/offline', revision: process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now()) }],
});

const config: NextConfig = {
  reactStrictMode: true,
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

