import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: true,
});

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript source; one build, one deploy. ADR-004.
  transpilePackages: ['@bliss/ui', '@bliss/shared', '@bliss/db'],
  experimental: {
    optimizePackageImports: ['@tabler/icons-react'],
  },
};

export default withSerwist(config);
