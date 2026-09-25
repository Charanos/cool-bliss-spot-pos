/**
 * Placeholder staff photographs for development, until staff carry a photo key the way products
 * carry an image key. Proposed amendment to docs/04-data-model.md: `staff.photo_key`, resolved by
 * the asset store and cached on the device so sign-in works offline.
 *
 * Keyed by name, one photograph per person, so two people can never share a face and a face never
 * changes when the team list changes. Anyone not listed signs in with their initials.
 */
const PHOTO: Record<string, string> = {
  Amina: '1589156191108-c762ff4b96ab',
  Peter: '1546525848-3ce03ca516f6',
  Grace: '1589156280159-27698a70f29e',
  Kevin: '1518882570151-157128e78fa1',
  Sam: '1531901599143-df5010ab9438',
  Dan: '1563721572772-fbf713fff374',
};

export function staffPhoto(displayName: string): string | null {
  const key = PHOTO[displayName];
  return key ? `https://images.unsplash.com/photo-${key}?auto=format&fit=crop&crop=face&w=256&h=256&q=80` : null;
}
