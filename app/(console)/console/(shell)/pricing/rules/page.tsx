import { formatDate, plural } from '@bliss/shared/format';
import { describeRuleWindow, ruleCoversInstant } from '@bliss/shared/pricing';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { StatusChip } from '@bliss/ui/components/status';
import type { Metadata } from 'next';
import Link from 'next/link';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as pricing from '@/modules/pricing/service';
import { TabIntro } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Time rules' };

/**
 * Time rules switch a price list on for a window. Windows are half open: a rule of 17:00 to 19:00
 * covers 18:59:59 and not 19:00:00, and a window past midnight belongs to the day it started.
 */
export default function RulesPage() {
  const outlet = identity.outlet();
  const now = Date.now();
  const lists = pricing.priceLists();
  const rules = [...pricing.rules()].sort((a, b) => b.priority - a.priority);

  const targetText = (appliesTo: string, ids: string[]) => {
    if (appliesTo === 'all') return 'Everything';
    const names = ids.map((id) => (appliesTo === 'category' ? catalogue.categoryById(id)?.name : appliesTo === 'product' ? catalogue.productById(id)?.name : catalogue.variantById(id)?.name)).filter(Boolean);
    return names.join(', ') || 'Nothing';
  };

  return (
    <>
      <TabIntro>When two rules overlap, the higher priority wins. A line keeps the rule it was fired under, even if it is settled after the window closes.</TabIntro>
      {rules.length === 0 ? <p className="text-body text-ink-muted">No time rules. Every item sells at its base price all day.</p> : null}
      <div className="grid grid-cols-1 gap-16 tablet:grid-cols-2">
        {rules.map((r) => {
          const list = lists.find((l) => l.id === r.priceListId);
          const live = r.status === 'active' && ruleCoversInstant(r, now, outlet.timezone);
          const items = list ? pricing.itemsFor(list.id).length : 0;
          return (
            <RevealSection key={r.id} className="flex flex-col gap-12 rounded-md border border-hairline bg-raised p-20 shadow-raised">
              <div className="flex items-start justify-between gap-12">
                <div>
                  <h2 className="text-subtitle text-ink">{r.name}</h2>
                  <p className="mt-2 font-mono tabular text-num text-ink">{describeRuleWindow(r)}</p>
                </div>
                {r.status !== 'active' ? <StatusChip status="retired" label="Archived" /> : live ? <StatusChip status="poured" label="On now" /> : <StatusChip status="sent" label="Scheduled" />}
              </div>
              <dl className="grid grid-cols-[120px_1fr] gap-x-16 gap-y-8 text-body-sm">
                <dt className="text-ink-subtle">Applies to</dt>
                <dd className="text-ink">{targetText(r.appliesTo, r.targetIds)}</dd>
                <dt className="text-ink-subtle">Charges</dt>
                <dd>
                  {list ? (
                    <Link href={`/console/pricing/lists?list=${list.id}`} className="text-accent-text hover:underline">
                      {list.name}, {plural(items, 'price')}
                    </Link>
                  ) : (
                    <span className="text-ink-muted">A list that no longer exists</span>
                  )}
                </dd>
                <dt className="text-ink-subtle">Priority</dt>
                <dd className="font-mono tabular text-num-sm text-ink">{r.priority}</dd>
                {r.effectiveFrom || r.effectiveTo ? (
                  <>
                    <dt className="text-ink-subtle">Effective</dt>
                    <dd className="text-ink">
                      {r.effectiveFrom ? `from ${formatDate(r.effectiveFrom, outlet.timezone)}` : ''} {r.effectiveTo ? `until ${formatDate(r.effectiveTo, outlet.timezone)}` : ''}
                    </dd>
                  </>
                ) : null}
                {r.crossesMidnight ? (
                  <>
                    <dt className="text-ink-subtle">Past midnight</dt>
                    <dd className="text-ink">Belongs to the day the window opens</dd>
                  </>
                ) : null}
              </dl>
            </RevealSection>
          );
        })}
      </div>
    </>
  );
}
