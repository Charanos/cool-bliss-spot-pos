import Image from 'next/image';
import { cx } from '../lib/cx';

type MarkSize = 24 | 32 | 40 | 48 | 64 | 80 | 96;

/**
 * The Bliss mark. Decorative by default, because it almost always sits beside the product name or
 * inside a link that carries one; pass `label` where the mark alone identifies the product.
 */
export function BlissMark({ size = 40, label, className }: { size?: MarkSize; label?: string; className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      priority={size >= 64}
      className={cx('inline-block shrink-0 object-contain', className)}
    />
  );
}

export function BlissWordmark({ size = 48, label, className }: { size?: MarkSize; label?: string; className?: string }) {
  return (
    <span className={cx('inline-flex items-center', className)}>
      <BlissMark size={size} label={label} />
    </span>
  );
}
