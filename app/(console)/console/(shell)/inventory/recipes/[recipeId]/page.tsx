import { formatQty } from '@bliss/shared/format';
import { isPositive, subtract } from '@bliss/shared/money';
import { Card, CardHeader } from '@bliss/ui/components/console/card';
import { InlineBar } from '@bliss/ui/components/console/inline-bar';
import { Metric, MetricGrid } from '@bliss/ui/components/console/metric';
import { DetailHeader, LedgerItem, LedgerList, MetaRow } from '@bliss/ui/components/console/section';
import { Money } from '@bliss/ui/components/money';
import { IconCash, IconFlask, IconScale } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import * as availability from '@/modules/availability/service';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';
import { EntityLink } from '../../../_components/entity-link';
import { RecordCrumb } from '../../../_components/shell/crumbs';
import { costedRecipe } from '../recipe-data';
import { RecipeActions } from '../recipes-client';

export async function generateMetadata({ params }: { params: Promise<{ recipeId: string }> }): Promise<Metadata> {
  const { recipeId } = await params;
  return { title: inventory.recipes().find((r) => r.id === recipeId)?.name ?? 'Recipe' };
}

/** A recipe: each part, what it costs, how many serves the stock makes, and the margin. */
export default async function RecipePage({ params }: { params: Promise<{ recipeId: string }> }) {
  const { recipeId } = await params;
  const raw = inventory.recipes().find((r) => r.id === recipeId);
  if (!raw) notFound();
  const actor = await identity.currentConsoleActor();
  const canCost = identity.can(actor.staffId, 'cost.read');
  const r = costedRecipe(raw);
  const serves = availability.evaluate(r.variantId);
  const margin = r.price && isPositive(r.price) ? subtract(r.price, r.cost) : null;

  return (
    <div className="flex flex-col gap-32">
      <RecordCrumb label={r.name} />
      <DetailHeader
        back={{ href: '/console/inventory/recipes', label: 'Recipes' }}
        title={r.name}
        meta={
          <MetaRow
            items={[
              {
                icon: IconFlask,
                value: (
                  <EntityLink kind="product" id={r.productId} muted>
                    Makes {r.variantName}
                  </EntityLink>
                ),
              },
              { value: `${r.parts.length} parts` },
            ]}
          />
        }
        actions={
          <RecipeActions
            recipe={{ id: r.id, variantId: r.variantId, name: r.name, parts: raw.components.map((c) => ({ componentVariantId: c.componentVariantId, qty: c.qty, volumeMl: c.volumeMl, wastagePct: c.wastagePct })) }}
            items={[{ value: r.variantId, label: r.variantName }]}
            stockItems={catalogue.stockVariants().map((v) => ({ value: v.id, label: v.name }))}
            canEdit={identity.can(actor.staffId, 'price.write')}
          />
        }
      />

      <MetricGrid columns={3}>
        <Metric label="Costs to make" icon={IconScale} value={canCost ? <Money value={r.cost} size="num-kpi" /> : 'Hidden'} detail="At average cost, with wastage" />
        <Metric label="Sells at" icon={IconCash} tone="poured" value={r.price ? <Money value={r.price} size="num-kpi" decimals="whole" /> : 'No price'} detail={canCost && margin ? `Leaves ${Math.round((Number(margin) / Number(r.price!)) * 100)}% before VAT` : 'On the base list'} />
        <Metric label="Serves in stock" icon={IconFlask} tone={serves.state === 'finished' ? 'stop' : serves.state === 'available' ? 'default' : 'attention'} value={String(serves.qtyAvailable)} detail="The fewest any part allows" />
      </MetricGrid>

      <Card aria-labelledby="recipe-parts">
        <CardHeader band level="h2" titleId="recipe-parts" title="One serve takes" subtitle="Each part, its share of the cost, and how many serves its stock makes." />
        <LedgerList label="Parts">
          {r.parts.map((p) => {
            const onHand = inventory.onHand(p.componentVariantId);
            return (
              <LedgerItem key={p.componentVariantId}>
                <span className="grid grid-cols-1 items-center gap-8 desktop:grid-cols-[minmax(0,2fr)_120px_minmax(0,1fr)_120px]">
                  <EntityLink kind="product" id={p.productId} className="text-ui">
                    {p.name}
                  </EntityLink>
                  <span className="font-mono tabular text-num-md text-ink-muted">
                    {formatQty(p.qty, 3)}
                    {p.volumeMl ? `, ${p.volumeMl}ml` : ''}
                  </span>
                  <span className="inline-flex items-center gap-8">
                    {canCost ? (
                      <>
                        <InlineBar value={isPositive(r.cost) ? Number(p.cost) / Number(r.cost) : 0} />
                        <Money value={p.cost} currency={false} size="num-md" />
                      </>
                    ) : null}
                  </span>
                  <span className="text-right text-body-sm text-ink-muted">{p.qty > 0 ? `${Math.floor(onHand / p.qty)} serves` : ''}</span>
                </span>
              </LedgerItem>
            );
          })}
        </LedgerList>
      </Card>
    </div>
  );
}
