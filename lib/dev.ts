import 'server-only';

/**
 * The development-only routes (the stock simulator under /api/dev) are on in development, and in a
 * production build only when BLISS_DEV_DATA=1 is set deliberately for a review environment. The
 * station API the tablets trade through lives under /api/station and is authenticated instead.
 */
export function devDataEnabled(): boolean {
  if (process.env.BLISS_DEV_DATA === '1') return true;
  if (process.env.BLISS_DEV_DATA === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

export function notFound(): Response {
  return new Response(JSON.stringify({ ok: false, error: 'Not found' }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  });
}
