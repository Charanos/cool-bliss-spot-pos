import 'server-only';

/**
 * The development data source and its /api/dev routes exist until Phases 1 to 4 replace them with
 * Neon, custom JWT auth and the sync endpoints. They are on in development, and in a production build
 * only when BLISS_DEV_DATA=1 is set deliberately for a review environment.
 */
export function devDataEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.BLISS_DEV_DATA === '1';
}

export function notFound(): Response {
  return new Response('Not found', { status: 404 });
}
