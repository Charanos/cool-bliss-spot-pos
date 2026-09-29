import { ICON_STROKE, type TablerIcon } from '@bliss/ui/components/icon';
import { cx } from '@bliss/ui/lib/cx';
import { IconAlertOctagon, IconAlertTriangle, IconArrowRight, IconChecks, IconInfoCircle, IconUrgent } from '@tabler/icons-react';
import Link from 'next/link';
import type { OverviewData } from '../_data';
import { Panel } from './panel';

const LOOK: Record<'stop' | 'low' | 'info', { icon: TablerIcon; wash: string; word: string }> = {
  stop: { icon: IconAlertOctagon, wash: 'bg-stop-wash text-stop', word: 'Now' },
  low: { icon: IconAlertTriangle, wash: 'bg-low-wash text-low', word: 'Today' },
  info: { icon: IconInfoCircle, wash: 'bg-info-wash text-info', word: 'Soon' },
};

/** What needs a person, most urgent first: each row says what, how urgent, and opens where it is dealt with. */
export function AttentionPanel({ d }: { d: OverviewData }) {
  const items = d.attention;
  const urgent = items.filter((i) => i.tone === 'stop').length;
  return (
    <Panel
      id="overview-attention"
      icon={items.length > 0 ? IconUrgent : IconChecks}
      tone={urgent > 0 ? 'stop' : items.length > 0 ? 'low' : 'poured'}
      title="Needs you"
      subtitle={items.length > 0 ? (urgent > 0 ? `${urgent} now, most urgent first` : 'Most urgent first') : 'Nothing is waiting on you'}
      meta={items.length > 0 ? <span className={cx('rounded-pill px-8 font-mono tabular text-micro', urgent > 0 ? 'bg-stop-wash text-stop' : 'bg-low-wash text-low')}>{items.length}</span> : null}
    >
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-12 px-20 py-40 text-center">
          <span className="flex size-control-xl items-center justify-center rounded-pill bg-poured-wash text-poured">
            <IconChecks size={28} stroke={ICON_STROKE} aria-hidden="true" />
          </span>
          <p className="text-title-card text-ink">All clear</p>
          <p className="measure text-body-sm text-ink-muted">No tab left from an earlier day, no drawer out, no order stuck on a tablet, nothing on hold or running short.</p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => {
            const look = LOOK[item.tone];
            const Glyph = look.icon;
            return (
              <li key={item.text} className="border-t border-edge first:border-t-0">
                <Link href={item.href} className="group flex items-center gap-12 px-20 py-12 transition-hover hover:bg-band focus-visible:bg-band">
                  <span className={cx('flex size-control-sm shrink-0 items-center justify-center rounded-md', look.wash)}>
                    <Glyph size={16} stroke={ICON_STROKE} aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="text-body-sm text-ink">{item.text}</span>
                    <span className="label-caps text-ink-subtle">{look.word}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-4 rounded-pill px-8 py-4 text-body-sm text-ink-muted transition-hover group-hover:bg-band-strong group-hover:text-ink">
                    {item.cta}
                    <IconArrowRight size={14} stroke={ICON_STROKE} aria-hidden="true" className="transition-transform group-hover:translate-x-2 motion-reduce:transition-none" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
