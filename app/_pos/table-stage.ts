import type { TableStage } from '@bliss/shared/trade';
import type { Tone } from '@bliss/ui/components/status';

/**
 * How each stage of a table reads, the same on the Floor and the Counter. docs/16 section 8.
 * `more` is the long form that shows from `pad` up; `live` breathes while something is under way.
 */
export const STAGE: Record<TableStage, { word: string; tone: Tone; more?: string; live?: boolean }> = {
  empty: { word: 'Nothing sent', tone: 'neutral' },
  at_bar: { word: 'At the bar', tone: 'accent', live: true },
  to_serve: { word: 'Poured', tone: 'poured', more: '· to serve', live: true },
  served: { word: 'Served', tone: 'served', more: '· not paid' },
  bill: { word: 'Bill asked', tone: 'low', live: true },
  seated: { word: 'Paid', tone: 'poured', more: '· still seated' },
  cleared: { word: 'Cleared', tone: 'neutral' },
};
