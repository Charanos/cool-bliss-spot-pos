import { formatQty } from '@bliss/shared/format';
import { Card } from '@bliss/ui/components/console/card';
import { Section } from '@bliss/ui/components/console/section';
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

  const head = 'px-12 py-12 text-label text-ink-subtle';
  return (
    <>
      <TabIntro>How a sold serve comes out of stock. A Smirnoff and Coke takes a measure of the spirit and a bottle of the mixer.</TabIntro>
      <div className="flex flex-col gap-40">
        <Section id="recipes" title="Recipes" description="Drinks made from more than one stocked item.">
          <Card>
            {recipes.length === 0 ? (
              <p className="px-20 py-16 text-body-sm text-ink-muted">No recipes yet. A single spirit or beer needs none; its pour spec below does the work.</p>
            ) : (
              <ul className="flex flex-col">
                {recipes.map((r) => (
                  <li key={r.id} className="grid grid-cols-[minmax(200px,1fr)_2fr] gap-24 border-b border-rule px-20 py-16 last:border-b-0">
                    <span className="text-ui font-medium text-ink">{r.name}</span>
                    <ul className="flex flex-col gap-8">
                      {r.components.map((c) => (
                        <li key={c.componentVariantId} className="flex items-baseline justify-between gap-16">
                          <span className="text-body-sm text-ink-muted">{catalogue.variantById(c.componentVariantId)?.name ?? 'Item no longer stocked'}</span>
                          <span className="font-mono tabular text-num-md text-ink">
                            {formatQty(c.qty, 3)}
                            {c.volumeMl ? <span className="text-ink-subtle">, {c.volumeMl}ml</span> : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Section>

        <Section id="pour-specs" title="Pour specs" description="The measure each serve pours, and how much of a bottle that is.">
          <Card>
            <div className="scroll-x">
              <table className="w-full border-collapse">
                <caption className="sr-only">Pour specs</caption>
                <thead>
                  <tr className="border-b border-edge card-band">
                    <th scope="col" className={`${head} pl-20 text-left`}>
                      Serve
                    </th>
                    <th scope="col" className={`${head} text-right`}>
                      Pour
                    </th>
                    <th scope="col" className={`${head} text-right`}>
                      Tolerance
                    </th>
                    <th scope="col" className={`${head} text-right`}>
                      Of a bottle
                    </th>
                    <th scope="col" className={`${head} pr-20 text-right`}>
                      Serves a bottle
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {serves.map((v) => {
                    const spec = specs.find((s) => s.productVariantId === v.id);
                    return (
                      <tr key={v.id} className="border-b border-rule last:border-b-0">
                        <td className="py-12 pl-20 pr-12 text-ui text-ink">{v.name}</td>
                        <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink">{v.serveVolumeMl}ml</td>
                        <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{spec ? `${spec.tolerancePct}%` : 'Default'}</td>
                        <td className="px-12 py-12 text-right font-mono tabular text-num-md text-ink-muted">{formatQty(v.depletionFactor, 4)}</td>
                        <td className="py-12 pl-12 pr-20 text-right font-mono tabular text-num-md text-ink">{v.depletionFactor > 0 ? Math.floor(1 / v.depletionFactor + 1e-9) : 'None'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </Section>
      </div>
    </>
  );
}
