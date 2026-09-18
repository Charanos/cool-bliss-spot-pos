import { LAST_FEW_SERVES } from '@bliss/shared/availability';
import { z } from 'zod';
import { devDataEnabled, notFound } from '@/lib/dev';
import { wireResponse } from '@/lib/wire';
import * as availability from '@/modules/availability/service';
import * as catalogue from '@/modules/catalogue/service';
import * as identity from '@/modules/identity/service';
import * as inventory from '@/modules/inventory/service';

export const dynamic = 'force-dynamic';

const body = z.object({
  variantId: z.string(),
  target: z.enum(['low', 'last_few', 'finished', 'restock', 'hold', 'release']),
});

/**
 * Development stock simulator, so a reviewer can watch a tile move through low, last few and
 * finished on the Floor. It writes real ledger movements and real holds through the inventory
 * module, so the availability module derives the new state exactly as it would in service.
 */
export async function POST(request: Request) {
  if (!devDataEnabled()) return notFound();
  const parsed = body.safeParse(await request.json());
  if (!parsed.success) return wireResponse({ ok: false }, { status: 400 });
  const { variantId, target } = parsed.data;

  const actor = { staffId: identity.staffList().find((s) => s.displayName === 'Kevin')!.id, deviceId: null };
  const bar = inventory.locations().find((l) => l.kind === 'service')!;
  const stock = catalogue.stockVariantFor(variantId);

  if (target === 'hold') {
    inventory.placeHold({ variantId, reason: 'Bottle broke at the bar, checking the rest', expectedBack: null, actor });
  } else if (target === 'release') {
    const hold = inventory.activeHolds().find((h) => h.productVariantId === (stock?.stockVariantId ?? variantId));
    if (hold) inventory.releaseHold({ holdId: hold.id, note: 'Checked, the rest are sealed and fine', actor });
  } else if (stock) {
    const current = inventory.onHand(stock.stockVariantId);
    const entry = availability.evaluate(variantId);
    const serves = (units: number) => (catalogue.variantById(variantId)?.kind === 'serve' ? units * stock.factor : units);
    const goal =
      target === 'finished' ? 0 : target === 'last_few' ? serves(Math.min(LAST_FEW_SERVES, 2)) : target === 'low' ? serves(Math.max(LAST_FEW_SERVES + 1, Math.floor(entry.threshold * 0.6))) : current + 48;
    const delta = Math.round((goal - current) * 10_000) / 10_000;
    if (delta !== 0) {
      // Everything is sold from the bar shelf first; the store holds the balance.
      const fromBar = delta < 0 ? Math.max(delta, -inventory.onHand(stock.stockVariantId, bar.id)) : delta;
      inventory.recordMovement({ variantId: stock.stockVariantId, locationId: bar.id, qtyDelta: fromBar, type: delta < 0 ? 'sale' : 'receipt', sourceType: 'dev_simulation', sourceId: null, reason: null, actor });
      const rest = Math.round((delta - fromBar) * 10_000) / 10_000;
      if (rest !== 0) {
        const store = inventory.locations().find((l) => l.kind === 'store')!;
        inventory.recordMovement({ variantId: stock.stockVariantId, locationId: store.id, qtyDelta: rest, type: 'sale', sourceType: 'dev_simulation', sourceId: null, reason: null, actor });
      }
    }
  }

  return wireResponse({ ok: true, availabilityVersion: availability.map().version, entry: availability.evaluate(variantId) });
}
