# Architecture decision register, Bliss

All records dated 7 September 2026. Records marked **reversal** overturn a decision made in the Solera set, and say why the reasoning no longer holds.

| # | Title | Status |
|---|---|---|
| 001 | Seats as a first class entity | Accepted |
| 002 | No local hub, clients sync to one cloud API | Accepted, reversal of Solera ADR-001 |
| 003 | Long-running Node host rather than serverless | Accepted |
| 004 | One Next.js project serving all three surfaces | Accepted |
| 005 | Neon Postgres with a branch per preview | Accepted |
| 006 | pg-boss for jobs, no Redis | Accepted, reversal of Solera's BullMQ choice |
| 007 | Server-sent events over a durable event log | Accepted |
| 008 | Availability as its own module | Accepted |
| 009 | Money as signed integer minor units | Accepted, carried forward |
| 010 | Stock on hand derived from an append-only ledger | Accepted, carried forward |
| 011 | Routing tickets are data, printing is optional | Accepted |
| 012 | Tenders are recorded, never processed | Accepted, reversal of Solera ADR-011 |
| 013 | Client-generated UUIDv7 as the idempotency key | Accepted, carried forward |
| 014 | Lenis on Console only, never on a touch surface | Accepted |
| 015 | GSAP under a strict motion budget with a single global timeline | Accepted |
| 016 | No hard deletes anywhere | Accepted, carried forward |

---

## ADR-001, seats as a first class entity

**Context.** The client's defining requirement is that a waiter can attach an order to the specific guest who made it. The cheap implementation is a client-side label on a line. The correct implementation is an entity.

**Decision.** `tab_seats` is a real table. `order_lines.tab_seat_id` is a real nullable foreign key. Seats appear in sync payloads, in realtime events, on bar tickets and on bills.

**Options considered.**

| | A: a text field on the line | B: a seat entity (chosen) | C: a sub-tab per guest |
|---|---|---|---|
| Effort | Trivial | Moderate | High |
| Settle one guest and keep the tab open | Impossible without parsing strings | Natural | Natural |
| Move a line between guests, audited | No | Yes | Awkward, it is a transfer between tabs |
| Per seat reporting | No | Yes | Yes |
| Merging two tables | Breaks | Renumbers cleanly | Combinatorial mess |

C was rejected because a sub-tab per guest makes the common case (one bill for the table) the hard case.

**Consequences.** Easier: split by seat is a query, not an algorithm. Per seat bills, per seat voids, and "settle Seat 3 because she is leaving" all fall out. Harder: every trade operation has to decide what happens to seats, which is why the state machines in `05-flows-and-channels.md` enumerate seat behaviour explicitly rather than leaving it to implementation.

---

## ADR-002, no local hub, clients sync to one cloud API

**Reversal of Solera ADR-001.**

**Context.** Solera put a hub at the counter because fiscal invoices had to transmit to KRA in a strict, gapless order, and an internet outage could not be allowed to become a compliance failure. That requirement is gone. Payment callbacks, the other reason for a local authority, are also gone.

**Decision.** Floor and Counter clients sync directly to the Bliss API. Offline resilience lives entirely in the client outbox.

**What this removes.** A second deployable. A Windows service and its installer. An mDNS discovery mechanism with a static IP fallback. A local SQLite journal. A per-venue certificate pinning scheme. A hub update policy. An entire failure mode where the hub itself dies.

**What this costs.** Floor to bar latency over the internet rather than the LAN, roughly 200 to 900ms instead of 20 to 60ms. The performance budget accommodates this at 800ms p95 to bar visible. A bar order is not a trading system.

**Consequences.** Easier: everything. Harder: a total internet outage means Floor and Counter are isolated from each other, so a fired order does not reach the bar until the line returns. Mitigation is that the Counter and the bar are physically adjacent to the floor, and the fallback during a long outage is the thing every bar already does, which is to walk over and say it. This is an acceptable trade at this venue's scale and it would not be at four outlets.

---

## ADR-003, long-running Node host rather than serverless

**Context.** Two requirements need a process that stays alive: SSE connections held open for a whole shift, and pg-boss workers polling for scheduled jobs.

**Decision.** Deploy the Next.js application to a long-running Node host. Not Vercel functions, not Lambda.

**Options considered.** Serverless plus a third party realtime service (adds a vendor, a second set of credentials and a second billing surface for something Postgres already does). Serverless plus polling (wasteful and slower than SSE). Serverless plus a separate long-running worker (two deployables, which is the thing ADR-002 just removed).

**Consequences.** Easier: SSE, jobs, in-process fan-out and connection pooling all become straightforward. Harder: we own uptime of a process rather than renting it, so health checks, restart policy and graceful shutdown (drain SSE subscribers, let pg-boss finish in-flight jobs) are explicit work in the hardening phase.

---

## ADR-004, one Next.js project serving all three surfaces

**Context.** Three very different interfaces. The obvious instinct is three applications.

**Decision.** One Next.js App Router project. `/console` uses server components. `/floor` and `/counter` are route groups that ship as installable PWAs with their own manifests, service workers and client-only bundles.

**Trade-off.** The Floor bundle must not carry Console code. Enforced by route group boundaries, dynamic imports and a bundle size budget in CI: the Floor entry bundle fails the build above 220KB gzipped.

**Consequences.** Easier: one repository, one deploy, one set of shared types, one design system package consumed by all three. A change to the pricing pipeline cannot drift between surfaces because there is one copy. Harder: bundle discipline is a standing obligation rather than a structural guarantee, so the CI budget is load-bearing.

---

## ADR-005, Neon Postgres with a branch per preview

**Context.** Schema changes in a system whose core table is an append-only ledger are the highest-risk changes in the project.

**Decision.** Neon Postgres. Every pull request gets a database branch seeded from a production snapshot. Migrations run there before review.

**Trade-off.** Neon's serverless model means cold starts on an idle branch and a connection model that needs care. Mitigated by using the WebSocket driver for transactional work, the HTTP driver for one-shot reads, and keeping the production branch warm because the host is long-running anyway.

**Consequences.** Easier: nobody reviews a migration by reading it. A reviewer opens the preview and looks at the data. Harder: connection handling is less forgiving than a classic managed Postgres, and the team has to understand which driver to reach for. Documented in the code prompts.

---

## ADR-006, pg-boss for jobs, no Redis

**Reversal of Solera's BullMQ choice.**

**Context.** Solera needed BullMQ because fiscal transmission demanded strict per-outlet ordering, exponential backoff across hours, and a visible parked queue. Job requirements here are modest: a nightly snapshot rebuild, a nightly reorder calculation, an events table sweep, session cleanup, and a dead letter alert.

**Decision.** pg-boss. Queues live in Postgres.

**Consequences.** Easier: one less service, one less connection string, one less thing to back up, and jobs participate in the same database transactions as the work that enqueues them. Harder: pg-boss is slower than Redis at high throughput, which is irrelevant at five jobs a day, and it adds tables to the schema, which is a documented and accepted cost.

---

## ADR-007, server-sent events over a durable event log

**Context.** Three surfaces need to agree within a second: an order fired on a tablet appears at the bar, a variant hitting zero greys out on every tablet, a seat settled at the counter disappears from the waiter's tab.

**Decision.** Append to an `events` table with a `bigserial` sequence, `NOTIFY` after commit, fan out in-process over SSE. Clients reconnect with `Last-Event-ID` and receive the backlog from their cursor.

**Options considered.** Websockets (bidirectional transport we do not need, since every write already goes through the idempotent sync outbox, and a second write path would be maintained forever). A hosted realtime service (a vendor, credentials and a bill for what Postgres already does). Polling (slower and noisier).

**Consequences.** Easier: reconnection and catch-up are free, ordering is a single integer, and the event log doubles as a debugging trail for "what did the bar see at 22:41". Harder: the log needs a retention policy and a resync path for clients that fall outside it, both specified in the architecture document.

---

## ADR-008, availability as its own module

**Context.** "Can I sell this right now" is a function of stock on hand, the low threshold, a manual 86, the variant's status and the category's status. If three surfaces each compute it, they will disagree, and the one that disagrees will be the tablet in a waiter's hand.

**Decision.** One module owns the derived availability map per outlet, caches it, invalidates on any movement touching a tracked variant or any 86 change, and publishes to the stock channel.

**Consequences.** Easier: one answer, one place to test, one event to subscribe to. Harder: cache invalidation, which is handled by keeping the cache derived and cheap to rebuild rather than clever. A manual 86 always outranks the computed figure, because the bar knowing a bottle broke beats the ledger thinking it is full.

---

## ADR-009, money as signed integer minor units

**Carried forward from Solera.**

All monetary values are `bigint` in KES cents, across database, API, client state and wire format (as a string in JSON, to survive JavaScript's 53 bit integer limit). A branded `Cents` type and an ESLint rule ban arithmetic between `Cents` and `number`. Rounding happens once, at tender, half up to the nearest shilling.

Seat splitting makes this sharper than it was before: an even split of an odd amount across three seats must still sum back exactly, so allocation uses largest remainder and is property tested.

---

## ADR-010, stock on hand derived from an append-only ledger

**Carried forward from Solera.**

`stock_movements` is append-only, with no UPDATE or DELETE grant for the application role. On hand is the sum of movements to a timestamp. `stock_snapshots` exists purely as a nightly-rebuilt cache and is always subordinate to the ledger.

This matters more here than it did in Solera, because availability, the thing the waiter sees, is computed from it. A stock figure nobody can explain becomes a tile that greys out for no reason.

---

## ADR-011, routing tickets are data, printing is optional

**Context.** Open question Q1 in the spec: does the bar take printed tickets or a screen?

**Decision.** `routing_tickets` is a table with a status lifecycle. Printing is one consumer. A bar screen at `/counter/bar` subscribed to the orders channel is another. Building one does not preclude the other and neither changes the trade module.

**Consequences.** Easier: the client can change their mind in week three for the cost of a consumer, not a redesign. Harder: nothing meaningful. This is what separating a decision from its implementation is for.

---

## ADR-012, tenders are recorded, never processed

**Reversal of Solera ADR-011.**

**Context.** Payment integrations are out of scope by client instruction.

**Decision.** A tender is a row: kind, amount, optional reference typed by the cashier, actor, time. Bliss makes no outbound call to any payment provider, receives no callback, and never asserts that a payment succeeded.

**Consequences.** Easier: no webhook idempotency, no reconciliation queue, no timeout handling, no provider credentials, no PCI surface, no sensitive customer data anywhere in the system. Harder: the cashier confirms payment on their own phone or terminal and types the reference. The UX copy is explicit that Bliss is recording what the cashier observed. A test asserts no payment provider domain appears in any outbound request in the codebase. If this reverses again, revisit the whole security section.

---

## ADR-013, client-generated UUIDv7 as the idempotency key

**Carried forward from Solera.**

Offline clients create records before the server sees them, and retries are guaranteed. UUIDv7 gives time-ordered keys that keep index locality on tables that will hold millions of lines, and doubles as the idempotency key for the corresponding outbox entry. Generation includes a device-scoped random suffix to survive a bad clock.

---

## ADR-014, Lenis on Console only, never on a touch surface

**Context.** The client asked for smooth scrolling. Applied without judgement, it would be applied everywhere.

**Decision.** Lenis runs on the Console only. It is not loaded in the Floor or Counter bundles at all, and `smoothTouch` is false even on Console.

**Reasoning.** Smooth scroll intercepts native scrolling and re-drives it from a requestAnimationFrame loop. On a desktop wheel that reads as polish. On a touch device it adds one to two frames of latency to the most frequent interaction in the product, breaks the fast flick a waiter uses to scan a long item grid, fights virtualised lists, and makes the interface feel like it is lagging behind the finger. A POS that feels slow gets bypassed, and a bypassed POS produces no data.

**Consequences.** Easier: the Floor stays as responsive as the hardware allows. Harder: the two experiences differ, which is correct, because they are different devices used by different people for different lengths of time. This is written down so that nobody "fixes the inconsistency" in month four.

---

## ADR-015, GSAP under a strict motion budget with a single global timeline

**Context.** GSAP can do anything, which is the risk.

**Decision.** GSAP is the only animation library. Every animation is registered against a named global timeline scale so the entire product can be slowed for debugging or demos. Every component scopes its animations with `gsap.context()` and reverts on unmount. `gsap.matchMedia` handles reduced motion. Only `transform` and `opacity` are animated, with Flip as the sanctioned exception for layout changes.

Hard budget: nothing exceeds 400ms anywhere, and nothing on the Floor exceeds 140ms.

**Consequences.** Easier: motion is consistent, debuggable and cheap. Harder: a contributor who wants a flourish has to justify it against a written budget, which is the point. Full specification in `07-motion-and-interaction.md`.

---

## ADR-016, no hard deletes anywhere

**Carried forward from Solera.**

No table has a delete path in the application. Removal is a status transition: `archived`, `voided`, `cancelled`, `superseded`. The application role has no DELETE grant on any transactional or audit table.

Tables grow forever. At this volume, forever is single-digit gigabytes over a decade, which is not a problem worth solving. Every list query carries a status predicate, handled once in the repository base class.

The one exception is the `events` table, which is a transport buffer rather than a record and is swept on a seven day retention. Nothing in `events` is authoritative for anything.
