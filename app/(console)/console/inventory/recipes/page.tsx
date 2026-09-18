import { formatQty } from '@bliss/shared/format';
import { RevealSection } from '@bliss/ui/components/console/shell';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as inventory from '@/modules/inventory/service';
import { TabIntro } from '../../_components/workspace';

export const metadata: Metadata = { title: 'Recipes' };

/**
 * Pour specs and recipes: how a sold serve depletes stock. A Smirnoff and Coke writes two movements,
 * the spirit and the mixer. docs/05 section 2.4.
 */
export default function RecipesPage() {
  const specs = inventory.pourSpecs();
  const recipes = inventory.recipes();
  const serves = catalogue.variants().filter((v) => v.kind === 'serve' && v.serveVolumeMl);

  return (
    <>
      <TabIntro>Theoretical depletion is sold serves times the depletion factor. Pour variance compares it with counted depletion.</TabIntro>

      <RevealSection>
        <h2 className="text-subtitle text-ink">Recipes</h2>
        <ul className="mt-12 border-t border-rule">
          {recipes.map((r) => (
            <li key={r.id} className="grid grid-cols-[minmax(200px,1fr)_2fr] gap-24 border-b border-rule py-16">
              <span className="text-body text-ink">{r.name}</span>
              <ul className="flex flex-col gap-8">
                {r.components.map((c) => (
                  <li key={c.componentVariantId} className="flex items-baseline justify-between gap-16">
                    <span className="text-body text-ink-muted">{catalogue.variantById(c.componentVariantId)?.name}</span>
                    <span className="font-mono tabular text-num text-ink">
                      {formatQty(c.qty, 3)} {c.volumeMl ? <span className="text-ink-subtle">· {c.volumeMl}ml</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </RevealSection>

      <RevealSection className="mt-40">
        <h2 className="text-subtitle text-ink">Pour specs</h2>
        <div role="table" aria-label="Pour specs" className="mt-12">
          <div role="row" className="grid grid-cols-[minmax(200px,1.5fr)_100px_110px_140px_120px] gap-16 border-b border-hairline pb-8">
            {['Serve', 'Pour', 'Tolerance', 'Per stock unit', 'Serves a bottle'].map((h, i) => (
              <span key={h} role="columnheader" className={i > 0 ? 'text-right text-label text-ink-subtle' : 'text-label text-ink-subtle'}>
                {h}
              </span>
            ))}
          </div>
          {serves.map((v) => {
            const spec = specs.find((s) => s.productVariantId === v.id);
            return (
              <div key={v.id} role="row" className="grid min-h-row grid-cols-[minmax(200px,1.5fr)_100px_110px_140px_120px] items-center gap-16 border-b border-rule">
                <span role="cell" className="text-body text-ink">
                  {v.name}
                </span>
                <span role="cell" className="text-right font-mono tabular text-num text-ink">
                  {v.serveVolumeMl}ml
                </span>
                <span role="cell" className="text-right font-mono tabular text-num text-ink-muted">
                  {spec ? `${spec.tolerancePct}%` : '··'}
                </span>
                <span role="cell" className="text-right font-mono tabular text-num text-ink-muted">
                  {formatQty(v.depletionFactor, 4)}
                </span>
                <span role="cell" className="text-right font-mono tabular text-num text-ink">
                  {v.depletionFactor > 0 ? Math.floor(1 / v.depletionFactor + 1e-9) : '··'}
                </span>
              </div>
            );
          })}
        </div>
      </RevealSection>
    </>
  );
}
