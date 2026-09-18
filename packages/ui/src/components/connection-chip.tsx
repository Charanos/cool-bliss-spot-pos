'use client';

import { useEffect, useRef } from 'react';
import { cx } from '../lib/cx';
import { connChange } from '../motion/floor';
import { Dot } from './status';

export type ConnectionState = 'synced' | 'offline' | 'unreachable' | 'sending';

export interface ConnectionChipProps {
  state: ConnectionState;
  /** Orders held on this device and not yet acknowledged. */
  heldOrders: number;
  /** On the Floor, Synced is a dot with no text. */
  compact?: boolean;
  className?: string;
}

function copy(state: ConnectionState, held: number): string {
  switch (state) {
    case 'synced':
      return 'Synced';
    case 'sending':
      return `Back online. Sending ${held} ${held === 1 ? 'order' : 'orders'}.`;
    case 'offline':
      return `Offline. ${held} ${held === 1 ? 'order' : 'orders'} held.`;
    case 'unreachable':
      return 'No connection. Orders are saved on this device.';
  }
}

/**
 * Persistent connection state in the base layer. docs/06-design-system.md section 6.9.
 * Never a toast, never a modal, never a red banner. Offline is a normal operating mode here.
 * A polite live region, because a cashier does not need interrupting mid-count.
 */
export function ConnectionChip({ state, heldOrders, compact = false, className }: ConnectionChipProps) {
  const dotRef = useRef<HTMLSpanElement>(null);
  const previous = useRef(state);

  useEffect(() => {
    if (previous.current !== state && dotRef.current) connChange(dotRef.current);
    previous.current = state;
  }, [state]);

  const text = copy(state, heldOrders);
  const tone = state === 'synced' ? 'poured' : state === 'unreachable' ? 'low' : 'info';
  const showText = !(compact && state === 'synced');

  return (
    <span className={cx('inline-flex min-w-0 items-center gap-8', className)} role="status" aria-live="polite" aria-label={text}>
      <span ref={dotRef} className="inline-flex">
        <Dot tone={tone} />
      </span>
      {showText ? (
        <span className={cx('truncate text-body', state === 'synced' ? 'text-ink-muted' : state === 'unreachable' ? 'text-low' : 'text-info')}>
          {text}
        </span>
      ) : null}
    </span>
  );
}
