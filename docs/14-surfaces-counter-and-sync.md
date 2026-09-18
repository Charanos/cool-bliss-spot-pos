# Surfaces, the Counter, and real sync

Status: in execution. Supersedes the surface assumptions in docs/06 section 7 and the Bar view as a separate product. Visual revamp of everything here follows with Frank, on the foundations in docs/12 and docs/13.

---

## 1. Who uses what

| Surface | Who | Device | Route | Theme | Sign in |
|---|---|---|---|---|---|
| **Floor** | Waiters taking orders at tables, and a supervisor covering a section | 10 inch tablet | `/floor` | Dark | Staff PIN on a registered Floor device |
| **Counter** | Staff working the counter: waiters on counter duty who pour and fulfil, cashiers who settle, supervisors and managers who close the drawer | Tablet **or** desktop, one layout that serves both | `/counter` | Dark | Staff PIN on a registered Counter device |
| **Console** | Management | Desktop browser | `/console` | Light | Email, password and TOTP (Phase 1); separate from staff sign-in |

The **Bar view** stops being its own product. The counter is where orders are fulfilled, so fulfilment is the Counter's first view. A read-only second-screen route can come back later on the same data, with no new sync work.

### Which roles sign in where

One table in `packages/shared/src/identity/surfaces.ts`, enforced by the server at sign-in and read by both sign-in screens.

| Role | Floor | Counter |
|---|---|---|
| Waiter | Yes | Yes |
| Supervisor | Yes | Yes |
| Cashier | | Yes |
| Manager | | Yes |
| Owner | | Yes |
| Stock controller | | |

Managers and owners run the business from the Console and close the drawer at the Counter; they do not take orders on a Floor tablet. Changing this is a one-line edit to the table.

## 2. The counter as a place and the Counter as a station

Two different things were both called "counter".

| Thing | Before | Now | Why |
|---|---|---|---|
| The staff station where orders are poured and bills settled | Counter | **Counter** | It is the surface and the device kind |
| Places where guests sit at the bar | Zone "Counter", places C1 and C2 labelled "Counter 1" | Zone **Bar stools**, places S1 and S2 labelled **Stool 1**, **Stool 2** | A waiter saying "Counter 1" must never be ambiguous between a device and a guest |
| A tab with no place | Walk up | **Walk up** | Unchanged |
| A sale with no tab | Quick sale | **Quick sale** | Unchanged, Counter only |
| The stock location for sealed retail bottles | Counter | **Counter** | A stock location, only seen in the Console |

Place labels come from one function, `placeLabel()` in `packages/shared/src/trade/places.ts`: `T4` is "Table 4", `S1` is "Stool 1". The Floor, the Counter and the Console all use it. docs/08 terminology lock gains **Stool** and **Counter (station)**.

## 3. Entry and sign-in

- **Landing.** Two staff cards, Floor and Counter, each leading to that device's sign-in. Below them, a quiet line for managers: "Managing Cool Bliss Spot? Open the Console", desktop oriented.
- **One sign-in screen, two surfaces.** `StaffSignIn` lives in `app/_pos/` and takes `surface: 'floor' | 'counter'`. The Floor keeps the frost artwork. The Counter gets the same composition with its own photograph and heading ("Sign in to Counter 1"). The team list is filtered by the role table, and the server refuses a role that does not belong on the device, with a sentence that says where to go instead.
- **Device binding.** Each surface keeps its own local database (`bliss-floor`, `bliss-counter`), so one browser can be Floor 1 and Counter 1 at once in development, and a device's outbox never mixes surfaces.

## 4. Sync becomes real

Until now the development push only acknowledged entries and the pull only sent open tabs once. Every device was an island: an order fired on a Floor tablet never reached anyone. The Counter cannot exist on that.

### Server apply

`POST /api/dev/sync/push` applies each entry through the owning module, in order, idempotently, and returns ack or a rejection code.

| Kind | Applied by | What happens |
|---|---|---|
| `tab.open` | trade | Tab and seats inserted, gapless tab number for the business day allocated |
| `seat.add`, `seat.label`, `seat.remove` | trade | As on the device; remove refused `SEAT_HAS_LINES` |
| `order.fire` | trade, inventory | Order and lines inserted; order number allocated; sale movements written per docs/05 2.4 (serve factor, recipe components, linked modifiers); availability recomputed; lines for finished variants accepted and flagged |
| `line.move`, `line.note` | trade | Refused on a settled seat or a billed line |
| `line.void` | trade | Poured lines need the approval token; a sale reversal movement is written |
| `line.serve` **new** | trade | Lines marked poured with who and when; the order rolls up to partially served or served |
| `tab.move`, `tab.handover` | trade | As specified |
| `bill.settle` **new** | settlement | See section 6 |
| `drawer.open`, `drawer.drop` **new** | settlement | See section 7 |

The server is authoritative on money: it recomputes every bill from its own lines and prices and rejects `BILL_TOTAL_MISMATCH` rather than trusting a device's arithmetic.

### Change feed

Every write records `(seq, table, id)` in a change log. `GET /api/dev/sync/pull?since=n` returns every row changed after `n` (tabs, seats, orders, lines, modifiers, bills, bill lines, tenders, drawer sessions) and the new cursor. Drawer sessions go out as the blind projection, never with the expected figure. Devices pull every five seconds, before pushing.

**Merging on the device.**

- Rows for a tab with entries still pending in this device's outbox are skipped until those entries are acknowledged, so the server never overwrites a change the device has not sent yet.
- Drafts never leave the device and are never overwritten.

### Epoch

The development dataset regenerates when the seed changes. Every pull carries the dataset's epoch. A device that sees a new epoch clears its trade tables, cursors and outbox, then bootstraps again. In production the epoch is fixed; the mechanism stays as the full-resync path docs/02 section 7 already requires.

## 5. The Counter

### Layout

One shell for tablet and desktop:

- A 72px rail of the Counter's views.
- The view itself.
- A 72px base layer: the person, the drawer state, the connection chip, and the view's primary action.

On a 1280 × 800 tablet the settle screen is the bill (fluid) with the tender panel (420px). From 1440 wide the open tab list stays visible beside them.

| View | Route | Stories |
|---|---|---|
| **Orders** | `/counter/orders` | Fired orders waiting, oldest first, grouped as tickets; tap a line to mark it poured, or pour the whole ticket; ran-out lines flagged with a one-tap void carrying the reason; recently poured below |
| **Tabs** | `/counter/tabs`, `/counter/tabs/[tabId]` | C-01 find by place, waiter or tab number; C-02 to C-07 settle whole tab, one seat, or an even split of what is left, with cash and change, M-Pesa or card with a typed reference, several tenders on one bill; C-13 void with approval |
| **Quick sale** | `/counter/sale` | C-08 sealed bottles without a tab, straight to tender |
| **Drawer** | `/counter/drawer` | C-10 open with a counted float, C-11 cash drop with a reason, C-12 blind close: preflight, count by denomination, commit, then variance with a reason when over the outlet threshold |
| **Bills** | `/counter/bills` | Today's bills on this device, with their tenders; printing arrives with the print bridge decision (docs/01 Q1) |

**Out of scope, per the brief.** No payment provider call, no card terminal. A tender records what the cashier saw. The M-Pesa helper reads exactly: "Bliss records this. It does not check it."

### Views in detail

**Orders.**

- A ticket per fired order: place, tab number, waiter, fired time and age.
- Lines lead with the seat chip, then quantity and name; modifiers and notes in caps.
- No prices on a ticket.
- Tapping a line pours it; it dims to 40% in place.
- "Pour all" on the ticket.
- A ticket older than five minutes takes the Low edge.
- A line flagged ran out shows in Stop, with "Void" opening the reason dialog prefilled with "Ran out while the tablet was offline".
- Empty state: "Nothing waiting. Everything fired has been poured."
- Poured ticket lines are written through `line.serve`. Floor tablets see them poured on their next pull.

**Tabs and settle.**

- **List.** Every open tab from every waiter, searchable by place, waiter or tab number.
- **Bill.** Grouped by seat with subtotals, Shared last.
- **Scope.**
  - "Whole tab" settles every unbilled line.
  - "This seat" settles a seat's lines; tapping a seat chip in the bill selects it.
  - "Even split" divides what is left across active seats with `allocate()` and states the remainder plainly; each share is settled as its own bill in one split group.
- **Amount due.** Rounded once, at tender, half up to the shilling.
- **Tenders.**
  - Cash: tendered amount with quick notes (exact, 500, 1,000, 2,000), change due stays until the next action.
  - M-Pesa or card: amount and an optional reference.
  - Tenders stack; "Still due" counts down; Settle enables at zero.
- **Settle.** One outbox entry. The bill, its lines snapshotted with seat number and label, the tenders, and the seat and tab state change together on the device. The tab leaves the list when nothing is left to bill.
- **Refusals.** `TAB_ALREADY_SETTLED` opens the existing bill instead of an error.

**Quick sale.**

- A grid of sealed variants that are sellable, then a cart with quantities.
- Prices resolve with the shared pipeline at the moment of sale.
- Tender exactly as on a tab. Stock leaves the Counter location when it holds the bottle, else the bar shelf.

**Drawer.**

- **No session for this device today.** "Open the drawer": count the float by denomination.
- **Open.**
  - Float, cash drops and the number of cash bills.
  - Never an expected figure.
  - "Record a cash drop" asks for an amount and a reason.
- **Close.**
  1. Preflight: open tabs block with the list.
  2. Count by denomination, a running total in large mono, "Commit the count". The counted figure is sent and locked.
  3. The server returns expected and variance. Over the outlet threshold, a reason of at least ten characters is required before "Close the drawer".
- Drawer close needs the connection and says so; everything else works offline.

### Base layer

Person, "Drawer open since 16:02" or "Drawer not open", connection chip. The primary action is on the right: "Pour all" on a selected ticket, "Settle KES 4,200", "Charge KES 1,450", "Open the drawer".

## 6. Settlement rules the server enforces

1. Only lines that are poured or waiting, not voided and not already billed, can be billed.
2. A seat bill takes that seat's lines; a whole-tab bill takes every remaining line; an even-split bill takes a share of what remains and records the split group.
3. Tenders sum exactly to the rounded amount due. Cash change is tendered minus amount, never negative.
4. After a bill:
   - A seat that has nothing left becomes settled.
   - A tab with nothing left becomes settled with its close time.
   - Otherwise the tab is part settled.
5. Bill numbers are gapless per outlet.
6. Every settle is audited and linked to the open drawer session on that device when cash is taken; a cash tender with no open drawer is refused `DRAWER_NOT_OPEN`.

## 7. Drawer rules the server enforces

1. One open session per device per business day. `drawer.open` with a counted float.
2. Expected cash = opening float + cash tendered amounts on bills settled on this device during the session − cash drops. Withheld from every response until the count is committed.
3. Committing the count stores it and reveals expected and variance. A variance over the outlet threshold needs a reason before closing. A closed session never reopens.

## 8. Build order

| Step | Slice | Verified by |
|---|---|---|
| 1 | Shared: surface roles, `placeLabel`, new outbox payloads and rejection codes, settlement arithmetic | Unit tests |
| 2 | Seed: Bar stools zone, change log, applied set, cash movements, epoch | Seed invariants test |
| 3 | Modules: trade writes, sale depletion, settlement writes, drawer, change feed, apply | Module tests: fire depletes stock, settle closes seat and tab, blind drawer |
| 4 | API: pull with cursor and epoch, push that applies, identity with surface roles, drawer count and close | Typecheck; request tests through the modules |
| 5 | Client: shared POS library in `lib/pos` with a surface-scoped database, delta merge, epoch reset | Floor still signs in, opens a tab, fires |
| 6 | Floor: imports, shared sign-in, dev pour shortcut removed | Floor flows unchanged |
| 7 | Counter: layout, shell, sign-in, Orders, Tabs and settle, Quick sale, Drawer, Bills | End to end in the browser: fire on Floor, pour on Counter, poured on Floor; settle a seat, seat dims on Floor; open, drop, count, close the drawer |
| 8 | Landing, Console place labels and device kinds, docs/08 terminology | Visual check |

Only `tsc`, tests, token and style checks, and scoped ESLint run while the dev server is up. No build.
