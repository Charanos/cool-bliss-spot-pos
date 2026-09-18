/**
 * Placeholder staff photographs for development, until staff carry a photo key the way products
 * carry an image key. Proposed amendment to docs/04-data-model.md: `staff.photo_key`, resolved by
 * the asset store and cached on the device so sign-in works offline.
 *
 * Keyed by name, one photograph per person, so two people can never share a face and a face never
 * changes when the team list changes. Anyone not listed signs in with their initials.
 */
const PHOTO: Record<string, string> = {
  Amina: '1580489944761-15a19d654956',
  Peter: '1506794778202-cad84cf45f1d',
};

export function staffPhoto(displayName: string): string | null {
  const key = PHOTO[displayName];
  return key ? `https://images.unsplash.com/photo-${key}?auto=format&fit=crop&crop=face&w=256&h=256&q=80` : null;
}
