import { formatBps } from '@bliss/shared/format';
import { isPositive, shareBps } from '@bliss/shared/money';
import { ButtonLink } from '@bliss/ui/components/button-link';
import { Card, CardFooter, CardHeader, CardStats, Stat } from '@bliss/ui/components/console/card';
import { InlineBar } from '@bliss/ui/components/console/inline-bar';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { EmptyState } from '@bliss/ui/components/feedback';
import { Money } from '@bliss/ui/components/money';
import { IconBottle, IconFlask, IconPercentage, IconPlus } from '@tabler/icons-react';
import type { Metadata } from 'next';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import { ViewHeader } from '../../_components/workspace';
import { PourSpecsCard } from './pour-specs';
import { costedRecipe } from './recipe-data';
import { RecipesCreate } from './recipes-client';

export const metadata: Metadata = { title: 'Recipes' };

/** Recipes and pour specs: how a sold serve comes out of stock, and what it costs to make. */
export default async function RecipesPage() {
  const actor = await identity.currentConsoleActor();
  const canEdit = identity.can(actor.staffId, 'price.write');
  const canCost = identity.can(actor.staffId, 'cost.read');
  const recipes = inventory.recipes().map(costedRecipe);
  const specs = inventory.pourSpecs();
  const serves = catalogue.variants().filter((v) => v.kind === 'serve' && v.serveVolumeMl && v.status === 'active');
  const withMargin = recipes.filter((r) => r.price && isPositive(r.price));
  const avgCostShare = withMargin.length ? Math.round(withMargin.reduce((n, r) => n + shareBps(r.cost, r.price!), 0) / withMargin.length) : null;
  const madeItems = catalogue
    .variants()
    .filter((v) => v.status === 'active' && !inventory.recipeFor(v.id))
    .map((v) => ({ value: v.id, label: v.name }));
  const stockItems = catalogue.stockVariants().map((v) => ({ value: v.id, label: v.name }));

  return (
    <>
      <ViewHeader
        page="/console/inventory/recipes"
        actions={
          canEdit ? (
            <ButtonLink href="/console/inventory/recipes?new=1" variant="create" icon={IconPlus}>
              Add a recipe
            </ButtonLink>
          ) : null
        }
      />
      <div className="flex flex-col gap-32">
        <MetricGrid columns={3}>
          <Metric label="Recipes" icon={IconFlask} value={String(recipes.length)} detail="Drinks made from more than one item" />
          <Metric label="Cost of the price" icon={IconPercentage} tone={avgCostShare !== null && avgCostShare > 3500 ? 'attention' : 'default'} value={canCost && avgCostShare !== null ? formatBps(avgCostShare) : 'Hidden'} detail={canCost ? 'What the parts cost, of the base price, on average' : 'Needs the cost permission'} />
          <Metric label="Pour specs" icon={IconBottle} value={String(specs.length)} detail={`Of ${serves.length} serves poured from a bottle`} />
        </MetricGrid>

        {recipes.length === 0 ? (
          <EmptyState title="No recipes yet" body="A single spirit or beer needs none; its pour spec does the work. Add one for a drink made from more than one item." />
        ) : (
          <div className="grid grid-cols-1 gap-16 pad:grid-cols-2 desktop:grid-cols-3">
            {recipes.map((r) => {
              const share = r.price && isPositive(r.price) ? Number(r.cost) / Number(r.price) : 0;
              return (
                <Card key={r.id} as="article" interactive className="group h-full">
                  <CardHeader band title={r.name} subtitle={r.variantName} href={`/console/inventory/recipes/${r.id}`} />
                  <ul className="flex flex-1 flex-col">
                    {r.parts.map((p) => (
                      <li key={p.componentVariantId} className="flex items-baseline justify-between gap-16 border-b border-rule px-20 py-8 last:border-b-0">
                        <span className="min-w-0 truncate text-body-sm text-ink-muted">{p.name}</span>
                        <span className="font-mono tabular text-num-md text-ink">{p.volumeMl ? `${p.volumeMl}ml` : p.qty}</span>
                      </li>
                    ))}
                  </ul>
                  <CardStats columns={2}>
                    <Stat label="Costs">{canCost ? <Money value={r.cost} currency={false} size="num-md" /> : 'Hidden'}</Stat>
                    <Stat label="Sells at">{r.price ? <Money value={r.price} currency={false} size="num-md" decimals="whole" /> : 'No price'}</Stat>
                  </CardStats>
                  {canCost ? (
                    <CardFooter>
                      <span className="inline-flex items-center gap-8 text-body-sm text-ink-muted">
                        <InlineBar value={share} tone={share > 0.35 ? 'attention' : 'accent'} />
                        {r.price ? `${Math.round(share * 100)}% of the price` : 'No base price'}
                      </span>
                    </CardFooter>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}

        <PourSpecsCard
          canEdit={canEdit}
          rows={serves.map((v) => {
            const spec = specs.find((s) => s.productVariantId === v.id);
            return { variantId: v.id, productId: v.productId, name: v.name, serveMl: v.serveVolumeMl!, depletionFactor: v.depletionFactor, nominalMl: spec?.nominalVolumeMl ?? null, tolerancePct: spec?.tolerancePct ?? null };
          })}
        />
      </div>
      <RecipesCreate canEdit={canEdit} items={madeItems} stockItems={stockItems} />
    </>
  );
}
