import { cx } from '@bliss/ui/lib/cx';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** The business day runs 06:00 to 06:00, so an evening happy hour and a late night sit in one row. */
const START = 6 * 60;
const HOURS = [6, 9, 12, 15, 18, 21, 0, 3];
const TONES = ['bg-chart', 'bg-attention', 'bg-poured', 'bg-served', 'bg-info', 'bg-low'];

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const shift = (m: number) => (m - START + 1440) % 1440;

export interface TimelineRule {
  id: string;
  name: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  live?: boolean;
}

/**
 * A week of time rules at a glance: one row a day, the business day from 06:00 to 06:00 across,
 * each rule a bar in its own colour. Decorative beside the list of rules, which says it in words.
 */
export function WeekTimeline({ rules }: { rules: readonly TimelineRule[] }) {
  return (
    <figure className="flex flex-col gap-8" aria-label="The week's time rules">
      <div className="grid grid-cols-[40px_minmax(0,1fr)] items-end gap-12">
        <span />
        <div className="relative h-16">
          {HOURS.map((h) => (
            <span key={h} className="absolute -translate-x-1/2 font-mono tabular text-num-sm text-ink-subtle" style={{ left: `${(shift(h * 60) / 1440) * 100}%` }}>
              {String(h).padStart(2, '0')}
            </span>
          ))}
        </div>
      </div>
      {DAYS.map((day, i) => (
        <div key={day} className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-12">
          <span className="text-body-sm text-ink-muted">{day}</span>
          <div className="relative h-24 rounded-md bg-band">
            {HOURS.slice(1).map((h) => (
              <span key={h} aria-hidden="true" className="absolute inset-y-0 w-px bg-rule" style={{ left: `${(shift(h * 60) / 1440) * 100}%` }} />
            ))}
            {rules.map((r, n) => {
              if (!r.daysOfWeek.includes(i + 1)) return null;
              const s = shift(minutes(r.startTime));
              let e = shift(minutes(r.endTime));
              if (e <= s) e = 1440;
              return (
                <span
                  key={r.id}
                  title={`${r.name}, ${r.startTime} to ${r.endTime}`}
                  className={cx('absolute inset-y-4 rounded-sm opacity-85', TONES[n % TONES.length], r.live && 'ring-2 ring-ink')}
                  style={{ left: `${(s / 1440) * 100}%`, width: `${((e - s) / 1440) * 100}%` }}
                />
              );
            })}
          </div>
        </div>
      ))}
      <figcaption className="mt-8 flex flex-wrap gap-16">
        {rules.map((r, n) => (
          <span key={r.id} className="inline-flex items-center gap-6 text-body-sm text-ink-muted">
            <span aria-hidden="true" className={cx('size-dot rounded-dot', TONES[n % TONES.length])} />
            {r.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
