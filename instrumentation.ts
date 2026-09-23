/**
 * Runs once per server instance, before it takes a request. With a database configured, it loads
 * the outlet's working set from Postgres, so the first tap never waits on it. docs/17.
 *
 * The Node check is the literal form the bundler understands, so the Edge build never sees pg.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { start } = await import('./instrumentation-node');
    await start();
  }
}
