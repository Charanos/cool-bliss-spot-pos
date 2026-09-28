import { cx } from '../lib/cx';

type MarkSize = 24 | 32 | 40 | 48 | 64 | 80 | 96;

/**
 * The Cool Bliss marks, drawn as vector in public/brand (scripts/brand/make-logo.cjs):
 *
 *   mark      the glass alone, with its C in the wine, for small places: rails, headers, icons
 *   logo      the glass whose stem runs down into the I of BLISS, with COOL beside it, for the
 *             places the name is read: the sign-in screens and the top of a printed bill
 *
 * Each has a version for a dark surface, where the wine lifts a little so the glass reads against
 * the page. Decorative by default, because the mark almost always sits beside the name or inside a
 * link that carries one; pass `label` where the mark alone identifies the place.
 */
export function BlissMark({ size = 40, label, surface = 'dark', className }: { size?: MarkSize; label?: string; surface?: 'dark' | 'light'; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a vector mark, sharp at any size; nothing to optimise
    <img
      src={surface === 'dark' ? '/brand/mark-on-dark.svg' : '/brand/mark.svg'}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      decoding="async"
      className={cx('inline-block shrink-0 object-contain', className)}
    />
  );
}

/** The full logo, COOL BLISS under the glass. `size` is its height. */
export function BlissWordmark({ size = 48, label, surface = 'dark', className }: { size?: MarkSize; label?: string; surface?: 'dark' | 'light'; className?: string }) {
  // The logo is a touch taller than it is wide (520 by 534).
  const width = Math.round((size * 520) / 534);
  return (
    <span className={cx('inline-flex items-center', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a vector logo, sharp at any size; nothing to optimise */}
      <img
        src={surface === 'dark' ? '/brand/logo-on-dark.svg' : '/brand/logo.svg'}
        alt={label ?? ''}
        aria-hidden={label ? undefined : true}
        width={width}
        height={size}
        decoding="async"
        className="inline-block shrink-0 object-contain"
      />
    </span>
  );
}
