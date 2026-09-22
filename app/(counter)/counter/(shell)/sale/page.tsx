'use client';

import { plural } from '@bliss/shared/format';
import { type Cents, ZERO, formatKes, isPositive, multiplyByQty, subtract, sum } from '@bliss/shared/money';
import { amountDue } from '@bliss/shared/settlement';
import { Button } from '@bliss/ui/components/button';
import { FilterChips } from '@bliss/ui/components/choice';
import { InlineNotice, Skeleton } from '@bliss/ui/components/feedback';
import { SearchField, Stepper } from '@bliss/ui/components/fields';
import { ProductTile } from '@bliss/ui/components/floor/product-tile';
import { Sheet } from '@bliss/ui/components/floor/sheet';
import { ICON_STROKE } from '@bliss/ui/components/icon';
import { Money } from '@bliss/ui/components/money';
import { useNow } from '@bliss/ui/hooks';
import { IconArrowRight, IconCheck, IconShoppingBag, IconTrash } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BaseAction } from '@/app/_pos/base-layer';
import { PageHeader } from '@/app/_pos/chrome';
import { type TenderDraft, settle } from '@/lib/pos/counter';
import { useDrawerState, useSaleItems } from '@/lib/pos/counter-queries';
import { useOutlet } from '@/lib/pos/queries';
import { haptic } from '@/lib/pos/haptics';
import { notify } from '@bliss/ui/components/notices';
import { PANE, Quiet } from '../../_components/parts';
import { TenderPanel } from '../../_components/tender-panel';

/** Whether the screen is at least this wide, following it as it turns. False until mounted. */
function useMinWidth(px: number): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${px}px)`);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [px]);
  return wide;
}

interface CartLine {
  variantId: string;
  name: string;
  unitPrice: Cents;
  qty: number;
}

/**
 * A quick sale: a sealed bottle or a packet over the counter, with no tab and no seat. docs/14
 * section 6.
 *
 * The tiles are the Floor's own, photographs and stock marks included, so a bottle looks the same at
 * both stations. The cart and the tender panel sit beside them, and the bill carries scope
 * `quick_sale`, so the stock leaves on the same footing as everything poured at a table.
 */
export default function QuickSalePage() {
  const outlet = useOutlet();
  const now = useNow(60_000);
  const catalogue = useSaleItems(now, outlet?.timezone ?? 'Africa/Nairobi');
  const drawer = useDrawerState();

  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  // The add callback reads the cart through a ref, so it stays stable for the memoised tiles.
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const [tenders, setTenders] = useState<TenderDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ change: Cents; paid: Cents } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const wide = useMinWidth(768);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalogue?.items ?? []).filter((i) => (category === 'all' || i.categoryId === category) && (!q || i.name.toLowerCase().includes(q)));
  }, [catalogue, category, query]);

  const subtotal = sum(cart.map((l) => multiplyByQty(l.unitPrice, l.qty)));
  const due = amountDue(subtotal).due;
  const covered = cart.length > 0 && !isPositive(subtract(due, sum(tenders.map((t) => t.amount))));
  const count = cart.reduce((n, l) => n + l.qty, 0);

  const add = useCallback(
    (variantId: string) => {
      const item = catalogue?.items.find((i) => i.variantId === variantId);
      if (!item?.price || item.state === 'finished') return;
      const price = item.price;
      setDone(null);
      setTenders([]);
      const qty = (cartRef.current.find((l) => l.variantId === variantId)?.qty ?? 0) + 1;
      setCart((c) => {
        const found = c.find((l) => l.variantId === variantId);
        return found ? c.map((l) => (l.variantId === variantId ? { ...l, qty: l.qty + 1 } : l)) : [...c, { variantId, name: item.name, unitPrice: price, qty: 1 }];
      });
      haptic('tap');
      notify({
        key: `sale:${variantId}`,
        count: true,
        holdMs: 2400,
        title: `${item.name} added`,
        body: `${qty} in this sale.`,
        undo: () => {
          setTenders([]);
          setCart((c) => c.flatMap((l) => (l.variantId !== variantId ? [l] : l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : [])));
        },
      });
    },
    [catalogue],
  );

  const onSettle = async () => {
    if (busy || !covered) return;
    setBusy(true);
    setError(null);
    try {
      await settle({
        scope: 'quick_sale',
        tabId: null,
        tabSeatId: null,
        lineIds: [],
        items: cart.map((l) => ({ productVariantId: l.variantId, qty: l.qty, unitPriceCents: l.unitPrice, name: l.name })),
        split: null,
        subtotal,
        tenders,
      });
      const change = sum(tenders.map((t) => (t.tendered ? subtract(t.tendered, t.amount) : ZERO)));
      setDone({ change, paid: due });
      setCart([]);
      setTenders([]);
      setSheetOpen(false);
      haptic('success');
      notify({
        key: 'sale:done',
        title: `Sale recorded · ${formatKes(due, { decimals: 'whole' })}`,
        body: `${plural(count, 'item')} over the counter.${isPositive(change) ? ` Give ${formatKes(change, { decimals: 'whole' })} change.` : ''}`,
        holdMs: isPositive(change) ? 8000 : 4000,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That sale did not go through. Nothing was recorded.');
    } finally {
      setBusy(false);
    }
  };

  const clearCart = () => {
    const kept = cart;
    setCart([]);
    setTenders([]);
    setSheetOpen(false);
    notify({ tone: 'info', key: 'sale:cleared', title: 'Sale cleared', body: `${plural(count, 'item')} taken off. Nothing was recorded.`, undo: () => setCart(kept) });
  };

  const doneCard = done ? (
    <div className="flex flex-col gap-12 rounded-[20px] bg-poured-wash p-16 tablet:p-20">
      <p className="flex items-center gap-8 text-body-lg text-poured">
        <IconCheck size={20} stroke={ICON_STROKE} aria-hidden="true" />
        Sale recorded · {formatKes(done.paid, { decimals: 'whole' })}
      </p>
      {isPositive(done.change) ? (
        <div>
          <span className="caps text-ink-subtle">Change to give</span>
          <Money value={done.change} size="display" tone="money" decimals="whole" />
        </div>
      ) : (
        <p className="text-body text-ink-muted">No change to give.</p>
      )}
    </div>
  ) : null;

  const cartBody = (
    <>
      <header className="flex min-h-control-lg items-center justify-between gap-12 border-b border-rule-raised/30 px-16 py-8">
        <h2 className="caps text-ink-subtle">{cart.length === 0 ? 'This sale' : `This sale · ${plural(count, 'item')}`}</h2>
        {cart.length > 0 ? (
          <Button variant="ghost" size="sm" icon={IconTrash} onClick={clearCart}>
            Clear
          </Button>
        ) : null}
      </header>
      {cart.length === 0 ? (
        <p className="flex items-center gap-12 px-16 py-20 text-body text-ink-muted">
          <IconShoppingBag size={20} stroke={ICON_STROKE} aria-hidden="true" className="shrink-0 text-ink-subtle" />
          Tap a bottle to start a sale.
        </p>
      ) : (
        <ul className="py-4">
          {cart.map((line) => (
            <li key={line.variantId} className="flex min-h-row-floor items-center gap-12 border-b border-rule-raised/20 px-16 py-6 last:border-b-0">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink">{line.name}</span>
                <span className="block font-mono text-micro text-ink-subtle">{formatKes(line.unitPrice, { decimals: 'whole' })} each</span>
              </span>
              <Stepper
                value={line.qty}
                min={0}
                max={99}
                size="md"
                label={`How many ${line.name}`}
                onChange={(qty) => {
                  setTenders([]);
                  setCart((c) => (qty === 0 ? c.filter((l) => l.variantId !== line.variantId) : c.map((l) => (l.variantId === line.variantId ? { ...l, qty } : l))));
                }}
              />
              <Money value={multiplyByQty(line.unitPrice, line.qty)} size="num-sm" decimals="whole" className="w-[72px] justify-end" />
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const errorNotice = error ? (
    <InlineNotice tone="stop" action={<Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>}>
      {error}
    </InlineNotice>
  ) : null;

  const tenderPanel = <TenderPanel due={due} caption={plural(count, 'item')} tenders={tenders} onChange={setTenders} drawerOpen={Boolean(drawer?.open && drawer.open.status === 'open')} />;

  return (
    <div className="flex h-full min-h-0 flex-col pad:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PageHeader
          title="Quick sale"
          facts={[catalogue ? { key: 'n', text: `${catalogue.items.length} sealed` } : { key: 'r', text: 'Reading the shelf' }]}
          aside={
            <div className="w-full pad:w-[240px]">
              <SearchField label="Find an item" hideLabel placeholder="Find an item" value={query} onChange={(e) => setQuery(e.target.value)} onClear={() => setQuery('')} />
            </div>
          }
        >
          <FilterChips
            label="Category"
            size="md"
            value={category}
            onChange={setCategory}
            options={[{ value: 'all', label: 'All', count: catalogue?.items.length }, ...(catalogue?.categories ?? []).map((c) => ({ value: c.id, label: c.name, count: catalogue?.items.filter((i) => i.categoryId === c.id).length }))]}
            className="overflow-x-auto no-scrollbar"
          />
        </PageHeader>

        <div className="scroll-region px-12 pb-24 pt-16 pad:px-24 pad:pt-24">
          {catalogue === undefined ? (
            <div className="grid grid-cols-2 gap-8 pad:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] pad:gap-12">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-[192px] rounded-md" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Quiet title={query ? 'Nothing matches that' : 'Nothing to sell here'} body="Only sealed items are sold over the counter. Try another category, or the full list." />
          ) : (
            <div className="grid grid-cols-2 gap-8 pad:grid-cols-[repeat(auto-fill,minmax(168px,1fr))] pad:gap-12">
              {items.map((t) => (
                <ProductTile
                  key={t.variantId}
                  variantId={t.variantId}
                  name={t.name}
                  price={t.price}
                  ruled={Boolean(t.ruleName)}
                  state={t.state}
                  reason={t.reason}
                  qtyAvailable={t.qtyAvailable}
                  category={t.colour}
                  glyph={t.glyph}
                  imageUrl={t.imageUrl}
                  onAdd={add}
                  onLongPress={add}
                  inCart={cart.find((l) => l.variantId === t.variantId)?.qty ?? 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* From a tablet held upright: the sale beside the shelf, cart and tender each on their own pane. */}
      <aside
        aria-label="This sale"
        className="hidden shrink-0 flex-col gap-16 overflow-y-auto border-l border-rule-raised/30 bg-sunken/30 p-16 backdrop-blur-glass pad:flex pad:w-[380px] tablet:w-panel-tender tablet:gap-20 tablet:p-24"
      >
        {doneCard}
        <section className={`${PANE} overflow-hidden`}>{cartBody}</section>
        {errorNotice}
        {cart.length > 0 ? <div className={`${PANE} p-16 tablet:p-20`}>{tenderPanel}</div> : null}
      </aside>

      {/* On a phone the shelf keeps the screen; the sale opens over it. */}
      <Sheet
        open={sheetOpen && !wide}
        onClose={() => setSheetOpen(false)}
        eyebrow="Quick sale"
        title={cart.length === 0 ? 'This sale' : `${plural(count, 'item')} · ${formatKes(due, { decimals: 'whole' })}`}
        footer={
          <Button variant="primary" size="lg" fullWidth loading={busy} disabled={!covered} onClick={() => void onSettle()}>
            {covered ? `Take ${formatKes(due, { decimals: 'whole' })}` : 'Record how it was paid'}
          </Button>
        }
      >
        <div className="flex flex-col gap-16">
          <section className="overflow-hidden rounded-md border border-rule-raised/30">{cartBody}</section>
          {errorNotice}
          {cart.length > 0 ? tenderPanel : null}
        </div>
      </Sheet>

      <BaseAction>
        {done && cart.length === 0 ? (
          <Button variant="secondary" size="xl" icon={IconArrowRight} iconPosition="end" onClick={() => setDone(null)}>
            Next sale
          </Button>
        ) : wide ? (
          <Button variant="primary" size="xl" loading={busy} disabled={!covered} onClick={() => void onSettle()}>
            {cart.length === 0 ? 'Take payment' : `Take ${formatKes(due, { decimals: 'whole' })}`}
          </Button>
        ) : (
          <Button variant="primary" size="xl" icon={IconShoppingBag} disabled={cart.length === 0} onClick={() => setSheetOpen(true)}>
            {cart.length === 0 ? 'Tap a bottle to start' : `Pay ${formatKes(due, { decimals: 'whole' })} · ${plural(count, 'item')}`}
          </Button>
        )}
      </BaseAction>
    </div>
  );
}
