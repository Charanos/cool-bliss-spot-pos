import type { TenderKind } from '@bliss/shared/domain';
import type { TablerIcon } from '@bliss/ui/components/icon';
import { IconCash, IconCheck, IconCreditCard, IconDeviceMobile, IconUserDollar } from '@tabler/icons-react';

/** How a tender is named and drawn, the same at the till, on a bill and in history. */
export const TENDER_WORD: Record<TenderKind, string> = { cash: 'Cash', mpesa: 'M-Pesa', card: 'Card', account: 'Account', comp: 'Complimentary' };

export const TENDER_ICON: Record<TenderKind, TablerIcon> = { cash: IconCash, mpesa: IconDeviceMobile, card: IconCreditCard, account: IconUserDollar, comp: IconCheck };

/** The fill a tender takes in a split bar. Fixed per tender, never by rank. */
export const TENDER_FILL: Record<TenderKind, string> = { cash: 'bg-money', mpesa: 'bg-poured', card: 'bg-served', account: 'bg-accent', comp: 'bg-ink-subtle' };
