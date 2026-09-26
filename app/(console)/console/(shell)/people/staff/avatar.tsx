import { cx } from '@bliss/ui/lib/cx';
import { seatBgClass } from '@bliss/ui/lib/seat';

/**
 * A person in the Console: their uploaded photo, or their initials on their own colour. Never a
 * stock photograph; a face that is not theirs would be a false record.
 */
export function StaffAvatar({ name, avatarUrl, colourIndex, size = 'sm' }: { name: string; avatarUrl: string | null; colourIndex: number; size?: 'sm' | 'md' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-dot font-medium text-seat-ink',
        size === 'md' ? 'size-control-md text-body-sm' : 'size-control-sm text-num-sm',
        avatarUrl ? 'bg-control' : seatBgClass(colourIndex + 1),
      )}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- an uploaded file served by the app, already sized
        <img src={avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        initials || '?'
      )}
    </span>
  );
}
