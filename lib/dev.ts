import 'server-only';

/**
 * The development data source and its /api/dev routes exist until Phases 1 to 4 replace them with
 * Neon, custom JWT auth and the sync endpoints. They are on in development, and in a production build
 * only when BLISS_DEV_DATA=1 is set deliberately for a review environment.
 */
export function devDataEnabled(): boolean {
  // Enabled by default across all environments (including production previews, deployed PWA tablets,
  // and review builds) unless explicitly disabled via BLISS_DEV_DATA=0.
  return process.env.BLISS_DEV_DATA !== '0';
}

export function notFound(): Response {
  return new Response(JSON.stringify({ ok: false, error: 'Not found' }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  });
}
