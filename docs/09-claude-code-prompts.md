# Claude Code build prompts, Bliss

Version 1.0
7 September 2026

---

## How to use this

Each prompt is a self-contained session, run in order. Do not paste two at a time, and do not let a session drift into the next phase. The boundaries exist because each one ends at a testable state.

Put the specification documents in the repository under `/docs` and reference them by path rather than pasting them. Claude Code reads files better than it reads walls of pasted context.

---

## Standing preamble

Prepend this to every prompt below.

```
You are building Bliss, a point of sale and stock control system for Cool Bliss Spot,
a bar and bottle counter in Nairobi. Three surfaces: Floor (waiter tablets), Counter
(cashier desktop), Console (manager browser).

Read before writing any code:
  /docs/01-product-spec.md
  /docs/02-system-architecture.md
  /docs/03-adr-register.md
  /docs/04-data-model.md
  /docs/05-flows-and-channels.md
  /docs/06-design-system.md
  /docs/07-motion-and-interaction.md
  /docs/08-ux-copy.md

NON-NEGOTIABLE CONVENTIONS
- TypeScript, strict. No `any` without a comment explaining why.
- Money is a branded `Cents` type over bigint, KES cents. No float arithmetic on money
  at any layer. JSON carries money as a string.
- IDs are UUIDv7 generated client-side wherever a client can create the record.
- Drizzle ORM against Neon Postgres. Migrations are reviewable SQL.
- Custom JWT auth. Do not install any third-party auth library.
- No hard deletes. Removal is a status transition. The only scheduled delete is the
  `events` sweep.
- Every void, discount, write-off, hold and adjustment requires a reason of at least
  10 characters plus an actor.
- No module imports another module's Drizzle schema file.
- Tabler icons only. JetBrains Mono for every number. Geist Sans for everything else.
- Font weight never exceeds 500. No raw hex outside the token file.
- One level of elevation. No container inside a container.
- Sentence case in every user-facing string. No em dashes, no exclamation marks,
  no emoji, no apologies. Buttons are verbs naming their outcome.
- Every async action shows a determinate or skeleton state within 100ms.

EXPLICITLY OUT OF SCOPE, do not build, do not stub, do not leave a TODO for:
  KRA eTIMS or any fiscalisation. Excise stamps. M-Pesa Daraja or any payment
  provider integration. Card terminal integration. Loyalty. Online ordering.
  Reservations. Payroll. A general ledger. Multi-outlet consolidation.
  A tender is a row: kind, amount, optional typed reference. Bliss makes no outbound
  call to any payment provider and never claims a payment succeeded.

When unsure about a product decision, stop and ask rather than inventing one. When
unsure about a technical decision an ADR covers, follow the ADR. When you disagree
with an ADR, say so explicitly and propose an amendment rather than quietly doing
something else.
```

---

## Phase 0, foundations

```
Set up the Bliss repository.

Structure:
  app/                    Next.js App Router
    (console)/            server components, Lenis, ScrollTrigger
    (floor)/              client-only PWA route group
    (counter)/            client-only PWA route group
    api/                  route handlers
  packages/db/            Drizzle schema, migrations, seed
  packages/shared/        Cents, UUIDv7, price pipeline, zod payload schemas
  packages/ui/            design system components and tokens
  packages/config/        eslint, tsconfig, tailwind preset
  workers/                pg-boss job definitions

Deliver:
1. pnpm workspaces, strict tsconfig shared through packages/config.
2. Neon connection: `@neondatabase/serverless` over WebSocket for transactional work,
   the HTTP driver for one-shot reads, a standard `pg` pool for workers. Document in
   a README which to reach for and why.
3. The `Cents` branded type in packages/shared: add, subtract, multiplyByRate,
   allocate (largest remainder), format, parse, toJSON emitting a string. Unit tests
   including: a three-way split of 1000 cents sums back to exactly 1000, and a
   seven-way split of 1333 cents sums back to exactly 1333.
4. UUIDv7 generation with a device-scoped random suffix.
5. Design tokens from /docs/06-design-system.md as a TypeScript object and a Tailwind
   preset. Include the measured contrast ratio as a comment on every text-on-surface
   pair, and a test that walks the pairs and fails below 4.5:1 for body and 3:1 for
   large text.
6. GSAP registration and defaults per /docs/07-motion-and-interaction.md section 4.
   One global timeline, matchMedia for reduced motion, context scoping helper hook.
7. Lenis set up in the (console) group ONLY, driven from the GSAP ticker, smoothTouch
   false, autoRaf false.
8. ESLint rules that fail the build on:
     - raw hex in app/** or packages/ui/**
     - any font-weight above 500
     - arithmetic between Cents and number
     - a cross-module schema import
     - a GSAP tween targeting width, height, top, left, margin, padding or box-shadow
     - a duration literal above the surface budget (140 Floor, 240 Counter, 400 Console)
     - an em dash or an emoji in any string literal
     - a nested background or nested border in the same subtree (the one-pane rule)
9. Bundle budget test: the Floor entry bundle fails CI above 220KB gzipped, and fails
   outright if `lenis` or `ScrollTrigger` appear in it.
10. CI: typecheck, lint, unit test, build, bundle budget, token contrast.

No feature code in this phase. Stop when `pnpm ci` passes on an empty feature surface.
```

---

## Phase 1, schema, identity, audit

```
Implement the database schema and the identity and audit modules.

SCHEMA. Implement all 52 tables from /docs/04-data-model.md in packages/db, grouped
by the seven domains. Include:
- Every index named in the document.
- Unique on (tab_id, seat_no) where status <> 'removed'.
- Monthly partitioning on audit_events.
- A migration revoking DELETE from the application role on every transactional and
  audit table, and UPDATE on stock_movements and audit_events.
- events as bigserial with the two indexes, plus the pg-boss schema.
- A `business_date` helper in packages/shared taking a timestamp, an IANA timezone and
  a cutover time. Test it against Africa/Nairobi at 05:00, including a sale at 01:47
  belonging to the previous calendar date, and including that a later cutover change
  does not move historic values.

IDENTITY.
- Argon2id for PIN and password, parameters documented and tuned to ~250ms on target
  hardware.
- JWT: 15 minute access, 30 day refresh bound to a device fingerprint, rotated on
  every use, reuse detection revoking the whole family_id.
- PIN plus device binding for floor and counter. Email, password and mandatory TOTP
  for owner and manager.
- Permission guard at the module service boundary, not the route handler.
- Field-level stripping of cost_cents, margin and supplier terms for roles lacking
  `cost.read`, implemented as a serialisation interceptor so it cannot be forgotten
  per endpoint.
- Device enrolment, suspension, revocation. Revocation effective within one sync
  interval and on SSE connect.
- Rate limit PIN attempts: 5 failures locks for 15 minutes and writes an audit event.

AUDIT. One `record()` interface writing actor, device, ip, dotted action key, entity
type and id, before and after JSONB, reason and severity.

OUTLET SCOPING. A repository base class that applies the outlet predicate, plus a test
that instruments the Drizzle logger and fails if any query against a scoped table is
generated without it. This test is a release gate.

SEED. One outlet configured for Africa/Nairobi with a 05:00 cutover, six roles with the
permission matrix, eight staff, four devices, three zones, twelve tables.

Done when: a test proves a waiter token cannot retrieve a cost price from any endpoint,
a revoked device fails authentication, refresh token reuse revokes the family, and the
outlet scoping test passes.
```

---

## Phase 2, catalogue, pricing, availability

```
Implement the catalogue, pricing and availability modules.

CATALOGUE. Categories, products, variants, modifier groups, modifiers, and the join.
`snapshot(outletId)` returns a compressed versioned payload for offline caching.
Target under 400ms and under 300KB compressed for 1,200 SKUs, versioned with a
monotonic integer so a client detects staleness in one comparison.

PRICING. The deterministic pipeline from /docs/01-product-spec.md R4, as a PURE
FUNCTION in packages/shared so client and server run identical code:

  resolvePrice(input) -> { finalCents, derivation }
    base(priceList, variant)
      -> serveMultiplier(serveSize)
      -> timeRule(firedAt, activeRules)
      -> lineDiscount
      -> billDiscountShare

- Derivation is an ordered array of { label, input, op, output }, stored on the line
  as JSONB.
- Time rules support day-of-week arrays and windows crossing midnight. 22:00 to 02:00
  on Friday is ONE window.
- Price is fixed at fire time, never recomputed at settlement.
- Bill-level discount allocation uses largest remainder so allocations sum exactly.

Property tests:
- resolvePrice is deterministic and total for any rule set and timestamp.
- Sum of line totals + tax + rounding equals bill total, across 10,000 random bills.
- A rule boundary at 18:59:59.999 applies and 19:00:00.000 does not.
- The same function produces byte-identical derivations in the browser and on the
  server.

AVAILABILITY. Its own module per ADR-008.
- `map(outletId)` returns the derived state for every tracked variant, with a version.
- `recompute(variantIds)` runs INLINE inside the transaction that caused it, reading
  snapshots plus same-day deltas plus active holds plus variant and category status.
- Evaluation order is exactly: active hold -> variant/category status -> qty <= 0 ->
  qty <= 3 serves -> qty <= threshold -> available. The hold check is FIRST.
- Emits ONE batched `availability.changed` for variants whose state actually changed.
  A recompute that changes nothing emits nothing.
- `set86` and `clear86` write stock_holds with a reason and an actor.

Done when: a goods receipt of 40 lines produces exactly one availability event, a hold
outranks a positive stock figure, and the availability map is reproducible from the
ledger.
```

---

## Phase 3, realtime channels

```
Implement the realtime module.

EVENT LOG. `emit(outletId, channel, type, payload, actor, device)` appends to `events`
inside the caller's transaction, then issues `NOTIFY bliss_events` AFTER COMMIT. Never
notify inside the transaction, or subscribers see an event for work that rolls back.

FAN-OUT. One process-wide subscriber registry. One dedicated `pg` connection holding
`LISTEN bliss_events`. On notify, read the new rows and push to matching subscribers.

TRANSPORT. `GET /api/stream?channels=a,b,c&since=1284`
- Send backlog from `since` in seq order, then stream live.
- Heartbeat comment every 15 seconds.
- Honour `Last-Event-ID` so browser auto-reconnect resumes for free.
- If `since` is older than the oldest retained seq, send `{type:"resync_required"}` and
  close. Never send a partial stream.
- Authenticate and authorise the subscription. A device may only subscribe to its own
  outlet's channels. Check the revocation list on connect.

CLIENT. A `useChannel(channels)` hook that:
- Opens one EventSource for the whole app, not one per channel.
- Persists the last seq to Dexie so a cold start resumes.
- Exposes connection state to the design system's connection chip.
- Applies events to a local store, idempotently by event id.
- On `resync_required`, triggers a full pull and clears local derived state.

Implement every channel and payload in /docs/05-flows-and-channels.md section 3
exactly. `order.fired` carries denormalised product names, seat numbers and seat
labels, because the bar view must render without a second query.

GRACEFUL SHUTDOWN. On SIGTERM: stop accepting subscribers, send a reconnect comment to
every open stream so clients back off with jitter, let pg-boss finish in-flight jobs
with a 30s cap, drain HTTP, close the Neon pool.

Tests:
- A client disconnected 4 minutes receives every missed event in order, exactly once.
- A client with a cursor outside retention gets resync_required, never a partial.
- An event emitted in a transaction that rolls back is never delivered.
- 5 concurrent subscribers all receive a fired order within 1s.

Done when all four pass and a manual deploy during a simulated service loses nothing.
```

---

## Phase 4, trade with seats

```
Implement the trade module. This is the heart of the product. Read
/docs/05-flows-and-channels.md sections 1 and 2 completely before starting.

SERVER.
- Zones, service_tables, tabs, tab_seats, orders, order_lines, order_line_modifiers,
  routing_tickets, shifts.
- Operations: openTab, addSeat, labelSeat, removeSeat, addLine, moveLine, fireOrder,
  markServed, voidLine, moveTab, mergeTabs, handoverTabs.
- Every operation idempotent on the client-supplied UUIDv7. Replay returns the same
  result with 200 and `idempotent: true`, never 409.
- Tab numbers gapless per outlet per business day via advisory lock, not a sequence.
- Seat rules, enforced server-side:
    * Seats created from guest_count on tab open.
    * addSeat takes the next unused seat_no. Numbers are NEVER reused on a tab.
    * removeSeat refuses if any non-voided line references it, with the exact copy
      from /docs/08-ux-copy.md.
    * colour_index = seat_no % 8.
    * A one-seat tab still has a seat row. Only the UI hides the controls.
- moveLine is a MOVE, not a void-and-re-add: same line id, same fired_at, same
  derivation, audited as `line.moved_seat` with both seat ids.
- mergeTabs guards both tabs `open` and not `part_settled`, renumbers B's seats above
  A's maximum, preserves labels, repoints lines.
- fireOrder is ONE transaction: order, lines, stock movements (including the full
  depletion cascade in section 2.4), routing ticket, availability recompute, events.
  If any part fails, none of it happened.

SYNC.
- POST /api/sync/push takes an ordered outbox batch, returns per-entry ack, rejection
  with code, or transient failure.
- GET /api/sync/pull?cursor=n returns deltas plus catalogue and availability versions.
- Conflict resolution exactly per /docs/02-system-architecture.md section 6.
- A push carrying a stale catalogue OR availability version is rejected wholesale with
  STALE_SNAPSHOT so the client pulls and replays.
- STOCK CONFLICT: a line for a variant that went finished while the device was offline
  is ACCEPTED and flagged `stock_conflict`, never dropped. Read the reasoning in
  section 6 before implementing, and do not "improve" it into a rejection.
- Non-retryable rejections write to outbox_dead_letters.

CLIENT (floor route group).
- Dexie schema: catalogue snapshot, availability map, open tabs, seats, orders, lines,
  outbox, cursors.
- Every mutation writes local state AND an outbox entry in ONE IndexedDB transaction.
- Outbox drains in seq order per device, blocking per aggregate on rejection, backing
  off without blocking on transient failure.
- Selected seat persists across category changes and across app restarts within a tab.
- Availability is checked LOCALLY before a tile is tappable. A finished tile makes no
  network call.

NETWORK CHAOS HARNESS, required not optional. Deterministic drop, delay, duplicate,
reorder and partition. Scenario tests:
  1. Two devices add lines to one tab offline, both reconnect: union, no loss, no
     duplication, every line on its correct seat.
  2. Fire, ack lost, retry: exactly one order exists.
  3. Settle a tab another device already settled: client shows the existing bill.
  4. Offline 45 minutes across a price rule boundary: lines price at fire time, any
     divergence flagged.
  5. Force-kill mid order: on reopen the tab and the SELECTED SEAT are restored.
  6. Variant goes finished while a device is offline: the queued line arrives flagged,
     not rejected.
  7. Move a line between seats on two devices simultaneously: last write wins, both
     values in the audit trail.

Done when all seven pass repeatedly in CI.
```

---

## Phase 5, settlement and the counter

```
Implement settlement and build the Counter surface.

SETTLEMENT MODULE.
- bills, bill_lines, tenders, refunds, drawer_sessions, cash_movements.
- settleTab, settleSeat, splitEven, recordTender, refund, openDrawer, closeDrawer.
- settleSeat: creates a bill with scope='seat', snapshots seat_no and seat_label onto
  bill_lines, attaches every non-voided line on that seat, sets seat to settled, moves
  the tab to part_settled if active seats remain.
- splitEven: largest remainder over the REMAINING amount and ACTIVE seats. Creates n
  bills sharing a split_group_id. Property test: 10,000 random amounts and seat counts,
  allocations always sum exactly to the remainder.
- Settlement is atomic: a bill closes fully or not at all.
- Bill numbers gapless per outlet via advisory lock.
- Line descriptions AND seat labels snapshotted at settlement, because both change.
- Soft `settling` lock on a tab carrying device_id and locked_at, expiring after 5
  minutes.
- TENDERS ARE RECORDS. kind, amount, optional reference typed by the cashier. NO
  outbound call to any payment provider. Write a test asserting no request to any
  known payment provider domain exists anywhere in the codebase.
- Blind drawer close: expected_cash_cents omitted from the response until counted is
  committed. A test fails if the field appears in a pre-commit body.
- Variance beyond the outlet threshold blocks close until a reason of 10+ characters.

COUNTER SURFACE, per /docs/06-design-system.md section 7.2.
- Fixed 420px tender panel, never a modal. The bill stays visible while money is taken.
- Scope selector: Whole tab / This seat / Even split. Tapping a seat chip in the bill
  switches scope to that seat.
- `scope.switch` uses GSAP Flip at 220ms. This is the single most important animation
  in the product: the bill visibly reorganises. Get it right.
- Amount due in num-xl, the largest number anywhere.
- M-Pesa and Card open a reference field with the helper `Bliss records this. It does
  not check it.` Do not soften that copy.
- Change due stays until an explicit action. Never a timer.
- Quick sale mode: scan or search, add, settle, no tab.
- Day close: preflight for open tabs, blind count, variance reveal with the colour
  resolving at the END of the count tween, day summary.

Done when: ten real transactions across all tender kinds and all three scopes, a seat
settled leaves the tab open and updates the waiter's tablet within a second, a forced
20 minute network partition loses nothing, and the split property test passes.
```

---

## Phase 6, floor and bar

```
Build the Floor surface and the bar view.

FLOOR, per /docs/06-design-system.md section 7.1.
- Three columns: tables rail 180, item grid fluid, ticket rail 340.
- Seat selector strip above the ticket rail: 40px chips, 8px gaps, horizontally
  scrollable with NATIVE momentum, seats then Shared then a plus. Absent entirely on a
  one-seat tab.
- Product tiles driven by the local availability map, with all four states from the
  design system. A finished tile is not tappable, still focusable, announces
  "finished".
- Ticket rail grouped by seat, each group headed by its chip, label and subtotal.
  Shared last.
- Long press a line: void, move to another seat, add a note. Every gesture also
  reachable from an overflow menu and from the keyboard.
- Base layer: waiter, shift elapsed, connection chip, selected seat total, tab total,
  Fire order.

MOTION, exactly per /docs/07-motion-and-interaction.md section 6. Floor ceiling is
140ms and the lint rule enforces it. Implement every registry entry:
tile.press, line.enter, line.exit, seat.select, seat.total, line.moveSeat (Flip),
order.fire, tile.finished, conn.change, sheet.enter.

`line.moveSeat` uses GSAP Flip to travel the row from its old seat group to its new
one. This is what makes the seat model legible. Do not replace it with a fade.

Do NOT import Lenis or ScrollTrigger here. The bundle budget test enforces it.

BAR VIEW at /counter/bar, per design system 7.3.
- Subscribes to outlet orders channel. Renders tickets from the event payload with no
  second query.
- Type one step larger than anywhere else. No prices. Seat chips leading every line.
- Tap a line to mark poured, it fades to 40% in place.
- A ticket older than five minutes transitions its border to the low colour once. No
  pulse, no flash.
- `stock_conflict` lines carry a RAN OUT flag.

Done when: the seven chaos scenarios from Phase 4 pass through the real UI, a waiter
can complete table to fired order in three taps, and the usability targets in
/docs/01-product-spec.md section 9 are met on the target tablet.
```

---

## Phase 7, inventory, procurement, console

```
Implement inventory and procurement, and build the Console.

INVENTORY.
- stock_movements append-only. Write a test instrumenting the Drizzle logger that
  fails if any UPDATE or DELETE is generated against it.
- onHand as the ledger sum, then stock_snapshots as a nightly-rebuilt cache plus
  same-day deltas. A test asserts cache and ledger agree at 1,000 random timestamps.
- Moving average cost maintained on receipt, stored per movement so historic cost of
  goods never changes retroactively.
- Pour specs, recipes, recipe_components, with depletion cascading to components.
- Stock counts: open, counting, review, commit. Blind by default, expected_qty
  physically omitted from the counting client's payload until review. Committing
  writes adjustments with reasons, triggers availability recompute, locks permanently.
- Pour variance per the formula in /docs/04-data-model.md.
- Write-offs with category, reason and an availability recompute.

PROCUREMENT.
- Suppliers, supplier_products with price history, purchase orders with gapless
  numbering, goods receipts with and without a PO.
- Receipt lines capture expected, received and rejected, with a mandatory rejection
  reason above zero.
- Posting writes movements, updates moving average cost and supplier last cost,
  advances the PO, and triggers ONE batched availability recompute.

CONSOLE, per design system 7.4.
- Route-based tabs. Every filter, sort and column state in the query string.
- Workspaces: /overview /trade /inventory /purchasing /catalogue /pricing /people
  /reports /settings
- Server components for report queries. Client components only where interaction
  demands it.
- Data tables virtualised above 50 rows, numeric columns right-aligned in JetBrains
  Mono with tabular figures.
- Four distinct states on every data surface, with the copy from /docs/08-ux-copy.md.
- The overview answers the owner's three questions above the fold with no scrolling
  and no interaction.
- Holds workspace: place and release holds with reasons, and see what is currently on
  hold.
- Sync workspace: outbox dead letters with rejection codes and a resolution note.
- CSV export on every table, honouring current filters, with the filter state in the
  filename.
- Lenis and ScrollTrigger ARE used here, per /docs/07-motion-and-interaction.md
  section 5 and 6. Lenis is driven from the GSAP ticker, smoothTouch false,
  data-lenis-prevent on every scrollable table and dialog.

JOBS. The five pg-boss jobs from /docs/05-flows-and-channels.md section 4, and no
others. Availability recompute is NOT a job; it runs inline.

Done when: a manager can complete the Console tasks in the product spec unassisted, a
blind count produces a correct variance report, and posting a 40-line receipt produces
exactly one availability event.
```

---

## Phase 8, hardening and go live

```
Harden Bliss for production.

SECURITY
- Full review of the auth module, 100% branch coverage on token issuance, rotation and
  reuse detection.
- Fuzz role and endpoint combinations to verify field-level stripping cannot be
  bypassed.
- The outlet scoping test is a release gate.
- Dependency audit, secret scan, and a check that no credential exists in source.
- Verify the no-payment-provider assertion still holds.

PERFORMANCE against /docs/02-system-architecture.md section 9
- Instrument every budget. Fail CI on a regression beyond 10%.
- Load test sync and SSE with 4 devices pushing continuously through a simulated
  6 hour service.
- Profile Floor cold start on the ACTUAL target tablet, not a laptop.
- Verify the Floor bundle budget and that no frame exceeds 16ms during the ten most
  common interactions.

RESILIENCE
- Chaos suite: kill the app mid-settlement, kill Neon mid-sync, exhaust device storage,
  corrupt a local IndexedDB record, clock-skew a device by 4 hours, exceed the events
  retention while a device is offline.
- Restore drill from a real Neon backup. Write the MEASURED restore time into the
  runbook, not an assumed one.

MOTION
- Verify every registry entry against its budget.
- Verify the product is fully usable with the global timeScale at zero. If anything is
  unusable without motion, that motion was carrying meaning it should not have been.
- Verify reduced motion, and the battery-below-15% path.

OPERATIONS
- Runbook: app will not start, Neon unreachable, SSE storm on reconnect, printer
  offline, device lost, dead letter backlog, restore from backup.
- Structured logs with no PII in message bodies, correlation ids across API, jobs and
  SSE.
- Graceful shutdown verified by deploying during a simulated service.

HANDOVER
- Admin documentation written for someone who is not technical.
- One laminated A5 card per role.
- Thirty days of hypercare with a named contact.

Done when every item above has evidence attached, and the success metrics in
/docs/01-product-spec.md section 9 are instrumented and reporting.
```

---

## Session hygiene

| Failure | Prevention |
|---|---|
| Conventions drift after two hours | Re-paste the standing preamble in any session past roughly 40 tool calls |
| Scope bleeds into the next phase | End at the stated done condition. Start a new session even if it feels wasteful. |
| Out-of-scope features get stubbed "for later" | The preamble says do not stub and do not leave a TODO. Reinforce it when it happens. |
| The stock conflict rule gets "improved" into a rejection | It looks like a bug to a model optimising for correctness. Call it out explicitly at the start of Phase 4. |
| Silent ADR violations | Ask for an explicit ADR compliance check at the end of each phase: which ADRs did this touch, and how does the code satisfy each |
| Motion budget creep | The lint rule on duration literals is load-bearing. Do not disable it to unblock a commit. |
| Lenis or ScrollTrigger reaching the Floor bundle | The bundle test fails the build. Do not add an exception. |
| Tests written to pass rather than to test | Write the Phase 4 chaos scenarios before the implementation and review them yourself before anything is built on top |
