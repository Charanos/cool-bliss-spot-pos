'use client';

import { useState } from 'react';
import { cx } from '../lib/cx';
import { ICON_STROKE, type TablerIcon } from './icon';
import { Spinner } from './spinner';

export type CardActionTone = 'primary' | 'poured' | 'soft' | 'quiet';

const TONE: Record<CardActionTone, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  poured: 'bg-poured text-page hover:brightness-110',
  soft: 'bg-accent/[0.12] text-accent-text ring-1 ring-inset ring-accent/25 hover:bg-accent/20',
  quiet: 'bg-control text-ink hover:bg-control-hover',
};

/**
 * A card's next step: one bar across the foot of a tab card, the thing the table needs now (mark
 * served, ask for the bill, settle, clear the table). docs/16 section 8.
 *
 * It sits beside the card's own button, not inside it (a button in a button is invalid and eats
 * the tap), laid over the card's foot, so the card keeps `pb` room for it with `CARD_ACTION_ROOM`.
 * While its promise runs it shows a spinner and takes no second tap.
 */
export function CardAction({ label, icon: Icon, tone = 'soft', onClick, ariaLabel }: { label: string; icon: TablerIcon; tone?: CardActionTone; onClick: () => void | Promise<unknown>; ariaLabel?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
      className={cx(
        'absolute inset-x-12 bottom-12 z-[1] flex h-40 items-center justify-center gap-8 rounded-[12px] text-body-sm font-medium press-feedback active:scale-[0.98] disabled:opacity-70 pad:inset-x-16 pad:bottom-16',
        TONE[tone],
      )}
    >
      {busy ? <Spinner size={16} tone={tone === 'primary' || tone === 'poured' ? 'on-accent' : 'default'} /> : <Icon size={16} stroke={ICON_STROKE} aria-hidden="true" />}
      <span className="truncate">{label}</span>
    </button>
  );
}

/** Bottom padding a card keeps so its CardAction never covers what the card says. */
export const CARD_ACTION_ROOM = 'pb-[64px] pad:pb-[72px]';
