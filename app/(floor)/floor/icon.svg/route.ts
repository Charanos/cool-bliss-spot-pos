import { colour } from '@bliss/ui/tokens';

export const dynamic = 'force-static';

/** The Bliss mark: two offset rounded squares, glacier on frost. Drawn from tokens. */
export function GET() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${colour.frost[950]}"/><rect x="14" y="24" width="24" height="24" rx="7" fill="${colour.glacier[600]}"/><rect x="26" y="14" width="24" height="24" rx="7" fill="${colour.glacier[300]}"/></svg>`;
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } });
}
