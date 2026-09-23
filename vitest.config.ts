import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // Module services guard themselves with server-only; under test they run in plain Node.
      'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'modules/**/*.test.ts', 'app/**/*.test.ts', 'lib/**/*.test.ts', 'scripts/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**'],
    environment: 'node',
    // Tests run on a generated dataset in memory, never against the outlet's database.
    env: { BLISS_STORE: 'memory' },
    testTimeout: 30_000,
  },
});
