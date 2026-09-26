'use client';

import { useStaffDirectory } from './queries';

/**
 * A person's photograph on a station: the one uploaded for them in the Console, carried in the staff
 * directory the device keeps, or null for initials. Never a stock photograph (docs/08, Console).
 */
export function useStaffPhotos(): (staffId: string | null | undefined) => string | null {
  const staff = useStaffDirectory();
  return (staffId) => (staffId ? (staff?.find((s) => s.id === staffId)?.avatarUrl ?? null) : null);
}
