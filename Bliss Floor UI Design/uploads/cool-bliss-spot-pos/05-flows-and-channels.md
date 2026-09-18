# Flows, channels and execution, Bliss

Version 1.0
7 September 2026

Read this before writing any code that touches an order. Every state transition in the product is enumerated here, and anything not listed is not a legal transition.

---

## 1. State machines

### 1.1 Tab

```
                    ┌──────────────────────────────┐
                    │                              ▼
  [open] ──────► part_settled ──────► settling ──────► settled
     │                 │                  │
     │                 │                  └──────► open   (tender abandoned)
     │                 │
     ├──────────────── settling ──────────────────► settled
     │
     ├──────► merged_into  (terminal, points at the surviving tab)
     │
     └──────► voided       (terminal, requires reason, only when no line is served)
```

| Transition | Trigger | Guard |
|---|---|---|
| → `open` | `openTab` | Table free or walk-up. Seats created from guest count. |
| `open` → `part_settled` | `settleSeat` on one of several seats | At least one seat still active with unsettled lines |
| `part_settled` → `part_settled` | `settleSeat` again | More than one active seat remains |
| `open` or `part_settled` → `settling` | Counter opens the tender panel | No other device holds the tab in `settling` |
| `settling` → `open` | Tender abandoned or timed out after 5 minutes | |
| `settling` → `settled` | All remaining lines on a settled bill | Every non-voided line belongs to a settled bill |
| `open` → `merged_into` | `mergeTabs` | Both tabs `open`, same outlet, neither `settling` |
| `open` → `voided` | `voidTab` with reason | No line has status `served`. Otherwise lines must be voided individually. |

**Locking.** `settling` is a soft lock held by one device. The lock carries `device_id` and `locked_at`, and expires after five minutes so an abandoned counter session never strands a tab.

### 1.2 Seat

```
  [active] ──────► settled   (terminal for this tab)
      │
      └──────► removed       (only with zero attached non-voided lines)
```

| Transition | Guard |
|---|---|
| → `active` | Created on tab open from guest count, or added manually |
| `active` → `settled` | `settleSeat` writes a bill scoped to the seat, snapshots seat number and label onto the bill lines |
| `active` → `removed` | Zero non-voided lines attached. `seat_no` is never reused on the same tab. |

A tab with exactly one active seat renders no seat controls anywhere. The model is still there, the interface is not.

### 1.3 Order

```
  [draft] ──────► fired ──────► partially_served ──────► served
      │              │                  │
      └──► voided    └──► voided        └──► voided
```

`draft` exists only on the client. An order that reaches the server is at least `fired`. Line-level serving rolls up: when the first line is served the order moves to `partially_served`, when the last one is, it moves to `served`.

### 1.4 Order line

```
  [pending] ──────► served
      │
      └──────► voided   (reason required, approval if already served)
```

Plus two non-status mutations that are legal at any point before settlement:

| Mutation | Legal when | Audited as |
|---|---|---|
| Move between seats | Line not on a settled bill | `line.moved_seat` with both seat identifiers |
| Add or edit a note | Line status `pending` | `line.noted` |

A line cannot change variant, quantity or price after firing. Those are a void plus a new line, because the bar may already have poured it.

### 1.5 Bill

```
  [open] ──────► settled ──────► partially_refunded ──────► refunded
      │
      └──────► voided   (only while open)
```

A bill is created in `open` state the moment settlement begins, and closes atomically: either every tender is recorded and the bill is `settled`, or nothing is written.

### 1.6 Stock count

```
  [open] ──────► counting ──────► review ──────► committed
      │              │              │
      └──► cancelled └──► cancelled └──► cancelled
```

`expected_qty` is not returned by the API until `review`. Committing writes `count_adjustment` movements with the supplied reasons, triggers an availability recompute for every affected variant, and locks the count permanently. There is no transition out of `committed`.

### 1.7 Goods receipt

```
  [draft] ──────► posted   (terminal)
      │
      └──────► cancelled
```

Posting writes `receipt` movements, updates moving average cost, updates `supplier_products.last_cost_cents`, advances the purchase order status, and triggers an availability recompute.

### 1.8 Drawer session

```
  [open] ──────► counting ──────► closed   (terminal)
```

`expected_cash_cents` is withheld until the counted figure is committed. A variance above the outlet threshold blocks close until a reason of at least ten characters exists. A closed session never reopens. A correction is a new, linked adjustment.

### 1.9 Routing ticket

```
  [queued] ──────► delivered ──────► acknowledged
      │                 │
      └──► failed ◄─────┘   (retry returns to queued)
```

`delivered` means the printer accepted it or the bar screen rendered it. `acknowledged` means a human at the bar tapped it. Acknowledgement is optional and configured per outlet.

---

## 2. Sequence flows

### 2.1 Open a tab

```
Waiter            Floor PWA              API                 events
  │                   │                   │                    │
  │─ tap table ──────►│                   │                    │
  │                   │ local tab created │                    │
  │◄─ seat picker ────│ (UUIDv7, optimistic)                   │
  │─ 4 guests ───────►│                   │                    │
  │                   │ 4 seats created locally                │
  │                   │─ outbox: tab.open ──►│                 │
  │                   │                   │ allocate tab_number│
  │                   │                   │ insert tab + seats │
  │                   │                   │─ emit tab.opened ─►│
  │                   │◄─ ack + numbers ──│                    │
  │                   │ reconcile local ids                    │
```

The tab exists on the tablet before the network is involved. `tab_number` is server-allocated and patched in on ack; until then the ticket rail shows the table label, never a placeholder number.

### 2.2 Add a line to a seat

```
Waiter          Floor PWA                              API
  │                 │                                    │
  │─ tap Seat 2 ───►│ selectedSeat = seat2               │
  │─ tap tile ─────►│ check availability map             │
  │                 │  finished? refuse, no network call │
  │                 │ resolvePrice() locally             │
  │                 │ write line + outbox in one tx      │
  │◄─ row appears ──│ (< 50ms, no spinner)               │
  │                 │─ outbox drain ───────────────────► │
  │                 │                        re-resolve price
  │                 │                        compare derivations
  │                 │◄─ ack (+ flag if differs) ─────────│
```

Price is resolved twice, once on the client for instant feedback and once on the server as the authority. Both run the identical pure function from the shared package. A divergence flags the line rather than silently overwriting, because the customer was quoted the client's number.

### 2.3 Fire an order

```
Floor              API                  events            Bar view / printer
  │                 │                     │                     │
  │─ order.fire ───►│                     │                     │
  │                 │ validate seats      │                     │
  │                 │ insert order+lines  │                     │
  │                 │ write stock movements (sale)              │
  │                 │ recompute availability for touched variants│
  │                 │ create routing_ticket                     │
  │                 │─ emit order.fired ─►│                     │
  │                 │─ emit availability.changed (if any) ─────►│
  │◄─ ack ──────────│                     │──── SSE ───────────►│
  │                 │                     │                render ticket
  │                 │                     │                grouped by seat
```

Firing is one database transaction: order, lines, movements, routing ticket. If any part fails, none of it happened and the client retries with the same idempotency key.

### 2.4 Stock depletion cascade

The chain that runs on every fired line, in order.

```
order_line (qty, variant)
   │
   ├─ variant.kind = 'serve'
   │    └─ depletion = qty × depletion_factor  (bottle fraction)
   │
   ├─ variant.kind = 'sealed'
   │    └─ depletion = qty  (whole units)
   │
   ├─ recipe exists?
   │    └─ for each component: depletion += qty × component.qty × (1 + wastage_pct)
   │
   ├─ modifiers with linked_variant_id?
   │    └─ for each: depletion += modifier.qty
   │
   ▼
stock_movements (one row per affected variant, type 'sale')
   │
   ▼
availability.recompute(affectedVariantIds)
   │
   ├─ state unchanged → nothing emitted
   └─ state changed   → emit availability.changed on outlet:{id}:stock
                         │
                         ▼
                  every Floor device updates the tile within 1s
```

A single Smirnoff and Coke can therefore write three movements: the spirit, the mixer, and nothing for the ice. Every one of them can move availability.

### 2.5 Move a line between seats

```
Waiter           Floor                    API                events
  │                │                       │                   │
  │─ long press ──►│ show seat picker      │                   │
  │─ pick Seat 3 ─►│ optimistic move       │                   │
  │                │ GSAP Flip animates    │                   │
  │                │ the row to its new group                  │
  │                │─ line.move ──────────►│                   │
  │                │                  verify not on a settled bill
  │                │                  update tab_seat_id       │
  │                │                  audit line.moved_seat    │
  │                │                       │─ emit line.moved ►│
  │                │◄─ ack ────────────────│                   │
```

No void, no re-add, no price change. The line keeps its identity, its fire time and its derivation. This is the whole reason seats are an entity rather than a label.

### 2.6 Settle one seat, tab stays open

```
Cashier          Counter                API
  │                │                     │
  │─ open tab ────►│                     │
  │                │ show seats + totals │
  │─ tap Seat 3 ──►│                     │
  │─ Settle seat ─►│─ settleSeat ───────►│
  │                │              lock tab as settling
  │                │              create bill (scope='seat')
  │                │              snapshot seat_no + label onto bill_lines
  │                │              attach every non-voided line on that seat
  │                │◄─ bill ─────────────│
  │─ cash 2,000 ──►│─ recordTender ─────►│
  │                │              bill → settled
  │                │              seat → settled
  │                │              tab → part_settled
  │                │              cash_movement (sale)
  │                │              emit seat.settled, bill.settled
  │                │◄─ change due ───────│
  │                │ print bill (optional)
```

The waiter's Floor device shows Seat 3 greyed out within a second. The remaining three seats carry on ordering.

### 2.7 Even split of the remainder

Used when a table says "just split what is left".

```
remaining = tab_total - already_settled
n         = count of active seats
base      = remaining / n           (integer division, cents)
rem       = remaining - base × n
allocate base to every seat, plus one cent to the first `rem` seats
assert Σ allocations == remaining
```

Creates `n` bills with `scope='even_split'` sharing one `split_group_id`. Lines are attributed proportionally for reporting, and the printed bills state plainly that this is an even split rather than an itemised one, so nobody argues about whose beer was whose.

### 2.8 Merge two tabs

```
Waiter/Counter        API
  │                    │
  │─ mergeTabs(A,B) ──►│
  │                    │ guard: both open, neither settling, neither part_settled
  │                    │ target = A (the one being kept)
  │                    │ for each seat in B:
  │                    │    new seat_no = max(A.seat_no) + 1
  │                    │    preserve label, reassign colour_index
  │                    │    repoint its lines to the new seat
  │                    │ B.status = merged_into, B.merged_into_tab_id = A.id
  │                    │ A.guest_count += B.guest_count
  │                    │ emit tab.merged
```

Seat numbers are never reused, so a merged tab reads 1 to 4 then 5 to 7, and no line is ever ambiguous about which guest it belongs to. A tab that is already `part_settled` cannot be merged, because reconciling settled money across a merge is a class of bug nobody needs.

### 2.9 Offline capture and reconciliation

```
T0   Wi-Fi drops. Client detects on first failed sync.
     Connection chip → "Offline. Orders are saved on this device."
T0+  Waiter continues. Every action writes local state + outbox in one tx.
     Availability map is frozen at its last known version.
T1   Network returns.
     Step 1  PULL: catalogue version, availability version, tab deltas
     Step 2  If availability version moved, recompute local tiles
     Step 3  DRAIN: push outbox in seq order per device
     Step 4  For each entry:
               ack            → mark acked, clear after 72h
               idempotent     → mark acked, no side effect
               stock_conflict → line accepted, flagged, surfaced to Counter
               rejected       → block that aggregate, show the user, dead letter
T1+  Connection chip → "Synced"
```

**The stock conflict case is the important one.** A waiter offline for twenty minutes may have promised a drink that ran out in minute three. The server accepts the line and sets `stock_conflict`. The bar sees a flagged ticket. The Counter can void it in one tap with the reason prefilled. Rejecting the line outright would make the software correct and the waiter a liar, which is the wrong trade.

### 2.10 Place a hold (86 an item)

```
Supervisor      Any surface             API                    events
  │                 │                    │                       │
  │─ 86 Gilbeys ───►│                    │                       │
  │─ reason ───────►│─ hold.place ──────►│                       │
  │                 │            insert stock_holds (active)     │
  │                 │            availability.recompute(variant) │
  │                 │            audit hold.placed               │
  │                 │                    │─ emit item.86ed ─────►│
  │                 │                    │                   SSE │
  │                 │                    │        every Floor    │
  │                 │                    │        tile → finished│
```

A hold outranks the stock figure in every case. Releasing it recomputes and emits `item.un86ed`.

### 2.11 Shift handover

```
Amina           Floor                 API
  │               │                    │
  │─ End shift ──►│ list my open tabs  │
  │               │ "4 tabs, KES 12,400"
  │─ pick Brian ─►│─ handover ────────►│
  │               │           for each tab: assigned_to = Brian
  │               │           close Amina's shift row
  │               │           open or update Brian's shift row
  │               │           audit tab.handover per tab
  │               │                    │─ emit tab.moved ×4 ─►
  │               │◄─ done ────────────│
  │               │ Amina's tab list empties
  │               │ Brian's tab list gains 4
```

Seats, labels and lines are untouched. Only responsibility moves.

### 2.12 Day close

```
Cashier         Counter                API
  │                │                    │
  │─ Close day ───►│─ preflight ───────►│
  │                │◄─ 2 tabs still open│
  │                │ block, list them   │
  │─ (settle) ────►│                    │
  │─ Close day ───►│─ preflight ───────►│ ok
  │                │ blind count screen │
  │                │ (expected withheld)│
  │─ counted ─────►│─ closeDrawer ─────►│
  │                │           compute expected from cash_movements
  │                │           variance = counted - expected
  │                │           over threshold? demand reason
  │                │◄─ variance ────────│
  │─ reason ──────►│─ commit ──────────►│
  │                │           session → closed
  │                │           emit drawer.closed
  │                │◄─ day summary ─────│
```

---

## 3. Channel and event catalogue

Transport, retention and reconnection are specified in `02-system-architecture.md` section 5. This is the payload contract.

### `outlet:{id}:tabs`

| Event | Payload | Consumers |
|---|---|---|
| `tab.opened` | `tabId, tabNumber, tableLabel, zoneId, guestCount, seats[], openedBy` | Floor, Counter |
| `tab.moved` | `tabId, fromTableId, toTableId, actorId` | Floor, Counter |
| `tab.merged` | `survivingTabId, mergedTabId, seatRemap[]` | Floor, Counter |
| `tab.handover` | `tabIds[], fromStaffId, toStaffId` | Floor |
| `tab.closed` | `tabId, status` | Floor, Counter |
| `seat.added` | `tabId, seatId, seatNo, colourIndex` | Floor, Counter |
| `seat.labelled` | `tabId, seatId, label` | Floor, Counter |
| `seat.settled` | `tabId, seatId, billId, totalCents` | Floor, Counter |

### `outlet:{id}:orders`

| Event | Payload | Consumers |
|---|---|---|
| `order.fired` | `orderId, tabId, tabNumber, tableLabel, lines[{lineId, variantId, name, qty, seatNo, seatLabel, note}], firedBy, firedAt` | Bar, Counter, Floor |
| `line.added` | `lineId, orderId, tabId, seatId, variantId, qty, totalCents` | Floor, Counter |
| `line.moved` | `lineId, tabId, fromSeatId, toSeatId` | Floor, Counter |
| `line.served` | `lineId, orderId, servedBy, servedAt` | Floor, Bar |
| `line.voided` | `lineId, orderId, reason, voidedBy` | Floor, Bar, Counter |
| `line.conflict` | `lineId, variantId, reason: 'stock'` | Bar, Counter |

`order.fired` deliberately carries denormalised names, seat numbers and seat labels. The bar view must render a ticket without a second query, and a bar screen that has to fetch to display is a bar screen that is blank when the network stutters.

### `outlet:{id}:stock`

| Event | Payload | Consumers |
|---|---|---|
| `availability.changed` | `version, changes[{variantId, state, qtyAvailable}]` | Floor, Counter, Console |
| `item.86ed` | `variantId, reason, placedBy, expectedBack` | Floor, Counter, Console |
| `item.un86ed` | `variantId, releasedBy, note` | Floor, Counter, Console |

`availability.changed` is batched. A goods receipt posting forty lines emits one event with forty changes, not forty events.

### `outlet:{id}:bills`

| Event | Payload | Consumers |
|---|---|---|
| `bill.settled` | `billId, billNumber, tabId, seatId, scope, totalCents, tenders[]` | Counter, Console |
| `bill.refunded` | `billId, amountCents, reason` | Counter, Console |
| `drawer.opened` | `sessionId, deviceId, openedBy, floatCents` | Console |
| `drawer.closed` | `sessionId, varianceCents, reason` | Console |

### `outlet:{id}:presence`

| Event | Payload | Consumers |
|---|---|---|
| `device.online` | `deviceId, label, appVersion, staffId` | Console |
| `device.offline` | `deviceId, lastSeenAt, unsyncedCount` | Console |
| `staff.signed_in` | `staffId, deviceId` | Console |

`device.offline` carries `unsyncedCount` so a manager can see that Floor 3 has been dark for twenty minutes holding six orders, which is the one presence fact that actually matters.

### `outlet:{id}:admin`

| Event | Payload | Consumers |
|---|---|---|
| `catalogue.changed` | `version, affected: 'products' \| 'variants' \| 'modifiers'` | All |
| `price.changed` | `version, variantIds[]` | All |
| `device.revoked` | `deviceId` | All |

A client receiving `catalogue.changed` or `price.changed` pulls a fresh snapshot before its next outbox drain. A client receiving `device.revoked` for its own device signs out immediately and preserves its outbox for admin recovery.

---

## 4. Execution: scheduled and background work

pg-boss, running in the same process as the application. Five jobs, and that is the whole list.

| Job | Schedule | Work | Failure handling |
|---|---|---|---|
| `snapshot.rebuild` | 05:30 daily, after business day cutover | Rebuild `stock_snapshots` from the movement ledger for every variant and location | Retry 3× with 10 minute backoff. On final failure, alert and leave the previous snapshot in place. Reads fall back to the ledger, slower but correct. |
| `reorder.compute` | 06:00 daily | 28 day velocity per variant, compare against reorder point and supplier lead time, write suggestions | Retry 3×. Non-critical. |
| `events.sweep` | 04:00 daily | Delete `events` rows older than 7 days | Retry 3×. The only scheduled delete in the system. |
| `sessions.cleanup` | Hourly | Expire refresh tokens past `expires_at`, release `settling` locks held over 5 minutes | Retry 3× |
| `deadletter.alert` | Every 15 minutes | Count unresolved `outbox_dead_letters`, surface on the Console overview, alert above a threshold | Retry 3× |

Nothing in this list is on the critical path of a sale. If every job failed for a week, the venue would still trade correctly; reports would be slower and reorder suggestions stale.

### Availability recompute

Not a scheduled job. It runs inline, inside the transaction that caused it, for the specific variants affected.

Triggered by: a fired order, a voided line, a posted goods receipt, a committed stock count, a write-off, a hold placed or released, a variant or category status change.

It reads `stock_snapshots` plus same-day deltas plus active holds, writes `availability_state`, bumps `version`, and emits a single batched `availability.changed` for the variants whose state actually changed. A recompute that changes nothing emits nothing.

### Graceful shutdown

On `SIGTERM`: stop accepting new SSE subscribers, send a `reconnect` comment to every open stream so clients back off with jitter rather than stampeding, let pg-boss finish in-flight jobs with a 30 second cap, drain the HTTP server, then close the Neon pool. Documented because a deploy during service is otherwise a small outage for every tablet at once.

---

## 5. Data flow summary

One diagram for the whole system, so the interconnections are in one place.

```
  CATALOGUE ──────────────┐
  (products, variants,    │
   modifiers, prices)     │
                          ▼
  INVENTORY ────────► AVAILABILITY ────► stock channel ────► FLOOR tiles
  (movements,             ▲                                       │
   snapshots)             │                                       │
        ▲            stock_holds                                  │ tap
        │            (manual 86)                                  ▼
        │                                                  TRADE (tab → seat → line)
        │                                                         │ fire
        │                                                         ▼
        └──────── sale movements ◄──────────────────────── ORDER + routing ticket
                                                                  │
                                                          orders channel
                                                                  │
                                            ┌─────────────────────┴──────────┐
                                            ▼                                ▼
                                       BAR (screen or print)          COUNTER tab list
                                                                             │ settle
                                                                             ▼
                                                              SETTLEMENT (bill → tenders)
                                                                             │
                                                                     bills channel
                                                                             │
                                                                             ▼
                                                              CONSOLE reporting + drawer
```

Read it as three loops:

1. **The availability loop.** Inventory feeds availability, availability feeds the Floor, the Floor's orders feed inventory. It closes within one second and it is what stops a waiter selling a bottle that is not there.
2. **The service loop.** A tab holds seats, seats hold lines, lines fire into orders, orders route to the bar, the bar serves them back onto the lines. Seat attribution is preserved at every step.
3. **The money loop.** Lines settle onto bills, bills carry tenders, tenders move the drawer, the drawer closes the day. Nothing in this loop talks to an external provider.

---

## 6. Invariants

Assertions that hold at every moment. Each one has a test.

1. The sum of a tab's non-voided line totals equals the sum of its bills' totals plus the total of lines not yet settled.
2. Every `order_line` with a `tab_seat_id` references a seat on the same `tab_id` as its order.
3. No seat is `removed` while a non-voided line references it.
4. `stock_snapshots` for any variant equals the ledger sum to the snapshot's `as_of`.
5. Every `availability_state` row is reproducible from snapshots, same-day movements, holds and statuses.
6. Every bill's `total_cents` equals the sum of its line totals, minus discount, plus tax, plus rounding.
7. Every settled bill has tenders summing to at least its total.
8. `events.seq` is strictly increasing and has no gap that any client observed as a gap.
9. No two active seats on one tab share a `seat_no`.
10. Every void, discount, write-off, hold and adjustment has a reason of at least ten characters and an actor.
11. No row is ever deleted outside the `events` sweep.
12. Every scoped query carries its outlet predicate.
