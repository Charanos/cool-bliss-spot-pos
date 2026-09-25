import { plural } from '@bliss/shared/format';
import { RevealSection } from '@bliss/ui/components/console/shell';
import { StatusChip } from '@bliss/ui/components/status';
import { categoryEdgeClass } from '@bliss/ui/lib/seat';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import { TabIntro } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Categories' };

const ROUTING: Record<string, string> = { bar: 'Bar screen', kitchen: 'Kitchen', none: 'Not routed' };

/** Categories set the floor's tabs, where a fired line goes, and whether stock is tracked. */
export default function CategoriesPage() {
  const categories = catalogue.categories();
  const products = catalogue.products();

  return (
    <>
      <TabIntro>The colour marks the category edge on every floor tile. Order here is the order of the floor&rsquo;s category tabs.</TabIntro>
      <RevealSection>
        <div role="table" aria-label="Categories">
          <div role="row" className="grid grid-cols-[48px_minmax(180px,1.5fr)_140px_140px_120px_110px] gap-16 border-b border-hairline py-8">
            {['Order', 'Category', 'Fired lines go to', 'Stock', 'Products', 'State'].map((h, i) => (
              <span key={h} role="columnheader" className={i === 0 || i === 4 ? 'text-right text-label text-ink-subtle' : 'text-label text-ink-subtle'}>
                {h}
              </span>
            ))}
          </div>
          {categories.map((c) => {
            const count = products.filter((p) => p.categoryId === c.id && p.status === 'active').length;
            return (
              <div key={c.id} role="row" className="grid min-h-row-floor grid-cols-[48px_minmax(180px,1.5fr)_140px_140px_120px_110px] items-center gap-16 border-b border-rule">
                <span role="cell" className="text-right font-mono tabular text-num text-ink-subtle">
                  {c.sortOrder}
                </span>
                <span role="cell" className="flex items-center gap-12">
                  <span aria-hidden="true" className={`h-[24px] w-[3px] rounded-sm ${categoryEdgeClass(c.colourToken)}`} />
                  <span className="text-body text-ink">{c.name}</span>
                </span>
                <span role="cell" className="text-body text-ink-muted">
                  {ROUTING[c.routingTarget]}
                </span>
                <span role="cell" className="text-body text-ink-muted">
                  {c.trackStock ? 'Tracked' : 'Not tracked'}
                </span>
                <span role="cell" className="text-right font-mono tabular text-num text-ink">
                  {plural(count, 'product')}
                </span>
                <span role="cell">
                  <StatusChip status={c.status === 'active' ? 'active' : 'retired'} label={c.status === 'active' ? 'On sale' : 'Archived'} />
                </span>
              </div>
            );
          })}
        </div>
      </RevealSection>
    </>
  );
}
