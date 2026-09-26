import { formatDate, plural } from '@bliss/shared/format';
import { describeRuleWindow, ruleCoversInstant } from '@bliss/shared/pricing';
import { Card, CardBody, CardHeader } from '@bliss/ui/components/console/card';
import { KeyValueList } from '@bliss/ui/components/console/section';
import { EmptyState } from '@bliss/ui/components/feedback';
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
      <TabIntro>A time rule switches a price list on for its hours. Where two overlap the higher priority wins, and a line keeps the price it was fired at.</TabIntro>
      {rules.length === 0 ? (
        <EmptyState title="No time rules" body="Every item sells at its base price all day. A rule is how a happy hour list comes on by itself." />
      ) : (
        <div className="grid grid-cols-1 gap-16 pad:grid-cols-2">
          {rules.map((r) => {
            const list = lists.find((l) => l.id === r.priceListId);
            const live = r.status === 'active' && ruleCoversInstant(r, now, outlet.timezone);
            const items = list ? pricing.itemsFor(list.id).length : 0;
            return (
              <Card key={r.id} as="article" tone={live ? 'poured' : undefined} className="h-full">
                <CardHeader
                  band
                  title={r.name}
                  subtitle={<span className="font-mono tabular">{describeRuleWindow(r)}</span>}
                  meta={r.status !== 'active' ? <StatusChip status="retired" label="Archived" /> : live ? <StatusChip status="poured" label="On now" /> : <StatusChip status="sent" label="Scheduled" />}
                />
                <CardBody className="pt-4">
                  <KeyValueList
                    layout="inline"
                    items={[
                      { label: 'Applies to', value: targetText(r.appliesTo, r.targetIds) },
                      {
                        label: 'Charges',
                        value: list ? (
                          <Link href={`/console/pricing/lists?list=${list.id}`} className="rounded-sm text-accent-text hover:underline">
                            {list.name}, {plural(items, 'price')}
                          </Link>
                        ) : (
                          'A list that no longer exists'
                        ),
                      },
                      { label: 'Priority', value: r.priority, mono: true },
                      ...(r.effectiveFrom || r.effectiveTo
                        ? [{ label: 'Effective', value: [r.effectiveFrom ? `From ${formatDate(r.effectiveFrom, outlet.timezone)}` : null, r.effectiveTo ? `until ${formatDate(r.effectiveTo, outlet.timezone)}` : null].filter(Boolean).join(' ') }]
                        : []),
                      ...(r.crossesMidnight ? [{ label: 'Past midnight', value: 'Belongs to the day the window opens' }] : []),
                    ]}
                  />
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
