import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages ship TypeScript source; one build, one deploy. ADR-004.
  transpilePackages: ['@bliss/ui', '@bliss/shared', '@bliss/db'],
  experimental: {
    optimizePackageImports: ['@tabler/icons-react'],
  },
};

export default config;
