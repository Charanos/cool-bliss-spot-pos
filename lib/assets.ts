/**
 * Catalogue photographs resolve through the asset store; a tablet caches them for offline use. One
 * function for every surface, so the Floor, the Counter and the Console ask for the same image.
 */
export function assetUrl(key: string | null, width = 320, height = 176): string | null {
  if (!key) return null;
  // A photo uploaded in the Console is already a path on this server.
  if (key.startsWith('/api/uploads/')) return key;
  return `https://images.unsplash.com/photo-${key}?auto=format&fit=crop&w=${width}&h=${height}&q=70`;
}
