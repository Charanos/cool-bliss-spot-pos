# System architecture, Bliss

Version 1.0
7 September 2026

---

## 1. Constraints that shaped every decision

| # | Constraint | Consequence |
|---|---|---|
| K1 | Mains power and broadband both fail, independently, several times a month | Every trading device holds durable local state and an outbox. Cloud is a destination, not a dependency. |
| K2 | Peak concurrency is four tablets, one counter and one browser | Build for correctness and recoverability, not for scale that does not exist. |
| K3 | Six weeks, one small team | One deployable, one database, one language, no service anybody would dread debugging at 1am. |
| K4 | No fiscal or payment integrations | No ordered transmission queues, no at-least-once webhook handling, no PCI surface. A large amount of complexity simply does not exist here. |
| K5 | Seat attribution is the product | The seat is a first class entity in the schema, in the sync payloads and in the realtime events, never a client-side grouping. |
| K6 | Bars are dim and loud | Floor and Counter are dark, high contrast, touch first. Nothing depends on hearing a sound. |

---

## 2. Topology

One application. One database. Two client bundles served from the same project.

```
                    ┌────────────────────────────────┐
                    │        NEON POSTGRES           │
                    │  primary + branch per preview  │
                    └───────────────▲────────────────┘
                                    │ Drizzle, pooled
                    ┌───────────────┴────────────────┐
                    │      BLISS APP (Next.js)       │
                    │      long-running Node host    │
                    │                                │
                    │  /console      React Server    │
                    │  /floor        PWA bundle      │
                    │  /counter      PWA bundle      │
                    │  /api/*        route handlers  │
                    │  /api/stream   SSE fan-out     │
                    │  pg-boss       job workers     │
                    └──▲──────────▲─────────▲────────┘
                       │          │         │
                HTTPS  │          │         │  HTTPS + SSE
          ┌────────────┘    ┌─────┘         └────────────┐
    ┌─────┴─────┐     ┌─────┴─────┐              ┌───────┴──────┐
    │  FLOOR ×4 │     │  COUNTER  │              │   CONSOLE    │
    │  PWA      │     │  PWA      │              │   browser    │
    │  Dexie    │     │  Dexie    │              │   no offline │
    │  outbox   │     │  outbox   │              │              │
    └─────┬─────┘     └─────┬─────┘              └──────────────┘
          │                 │
          └────── optional ─┴── Print Bridge (127.0.0.1)
                                 receipt + bar ticket + drawer
```

### Why there is no Counter Hub

The Solera design put a local hub at the counter, because fiscal invoices had to transmit in strict order and a Safaricom outage could not be allowed to become a compliance failure. Neither of those pressures exists here.

Removing it takes out a second deployable, a Windows service, an mDNS discovery mechanism, a local journal, a certificate pinning scheme and an entire class of failure. The offline behaviour that actually matters, a waiter mid-order when the Wi-Fi drops, is handled by the client outbox, which existed anyway.

This is the single biggest simplification in the project and it is the right one. See ADR-002.

### The Print Bridge is optional

If the bar takes printed tickets, a small Node service runs on the counter machine and exposes a loopback API for ESC/POS printing and the drawer kick. If the bar takes a screen instead, the bridge is not built and the counter opens a `/counter/bar` route on a second monitor. Open question Q1 in the spec decides this, and the decision is cheap because routing tickets are a table, not a printer call. See ADR-011.

---

## 3. Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript, strict | One language, one set of types from schema to screen |
| Framework | Next.js App Router | Console needs server rendering for reports. Floor and Counter ship as PWA route groups from the same project. One build, one deploy. |
| Hosting | Long-running Node host, not serverless | SSE and pg-boss both need a process that stays alive. See ADR-003. |
| Database | Neon Postgres | Serverless Postgres with branching. A preview branch per pull request means schema changes are reviewed against real data shapes. |
| Driver | `@neondatabase/serverless` over WebSocket for the app, standard `pg` pool for workers | HTTP driver for one-shot queries, WebSocket for transactions |
| ORM | Drizzle | Explicit SQL, reviewable migrations, no hidden query generation |
| Jobs | pg-boss | Queues on Postgres. Removes Redis entirely. |
| Realtime | SSE over a durable `events` table | See section 5 |
| Offline store | Dexie over IndexedDB | Outbox and local read cache |
| Motion | GSAP, ScrollTrigger, Flip | See `07-motion-and-interaction.md` |
| Scroll | Lenis, Console only | Never on a touch surface. See ADR-014. |
| Auth | Custom JWT | PIN plus device binding on shared devices, TOTP on Console |
| IDs | UUIDv7, client generated | Sortable, offline safe, idempotent |
| Observability | Structured JSON logs, OpenTelemetry traces, Sentry | |

---

## 4. Module boundaries

The application is a modular monolith. Cross-module access goes through a module's service, never directly into another module's tables. Enforced by a CI rule that fails on any import crossing a schema boundary.

| Module | Owns | Public surface |
|---|---|---|
| `identity` | Outlets, staff, roles, permissions, devices, sessions | `authenticate`, `authorise`, `bindDevice`, `revokeDevice` |
| `catalogue` | Categories, products, variants, modifiers | `snapshot(outletId)`, `resolveVariant` |
| `pricing` | Price lists, items, time rules, discounts | `resolvePrice(variantId, context)` |
| `availability` | The derived sellable map, manual 86 state | `map(outletId)`, `set86`, `clear86`, `recompute(variantIds)` |
| `trade` | Zones, tables, tabs, **seats**, orders, lines, modifiers, routing tickets | `openTab`, `addSeat`, `labelSeat`, `addLine`, `moveLine`, `fire`, `voidLine`, `moveTab`, `mergeTabs`, `handover` |
| `settlement` | Bills, bill lines, tenders, refunds, drawer sessions, cash movements | `settleTab`, `settleSeat`, `splitEven`, `recordTender`, `openDrawer`, `closeDrawer` |
| `inventory` | Locations, movements, snapshots, pour specs, recipes, counts | `recordMovement`, `onHand(at)`, `openCount`, `commitCount`, `writeOff` |
| `procurement` | Suppliers, supplier products, purchase orders, goods receipts | `raisePo`, `receive`, `postReceipt` |
| `reporting` | Report queries, materialised rollups, exports | `run(key, params)` |
| `realtime` | Event log, channel fan-out, cursors | `emit(channel, type, payload)`, `stream(channels, sinceSeq)` |
| `sync` | Push, pull, conflict resolution, dead letters | `push(batch)`, `pull(cursor)` |
| `audit` | Append-only audit log | `record(actor, action, before, after, reason)` |

**The availability module is new and deserves a note.** It exists so that "can I sell this right now" is one question with one answer, rather than three surfaces each computing it from stock plus 86 flags plus category status. It reads from `inventory` and its own `manual_86` table, caches the derived map per outlet, and invalidates on any movement touching a tracked variant.

---

## 5. Realtime channels

### Design

A durable event log with an SSE fan-out on top. Not a message broker, not websockets, not a third party realtime service.

```sql
create table events (
  seq         bigserial primary key,
  outlet_id   uuid not null,
  channel     text not null,
  type        text not null,
  payload     jsonb not null,
  actor_id    uuid,
  device_id   uuid,
  created_at  timestamptz not null default now()
);
create index on events (outlet_id, seq);
create index on events (outlet_id, channel, seq);
```

`seq` is a single global bigserial, which gives total ordering for free and makes a cursor a single integer.

### Channels

| Channel | Events | Subscribers |
|---|---|---|
| `outlet:{id}:tabs` | `tab.opened`, `tab.moved`, `tab.merged`, `tab.closed`, `seat.added`, `seat.labelled`, `seat.settled` | Floor, Counter |
| `outlet:{id}:orders` | `order.fired`, `line.added`, `line.moved`, `line.served`, `line.voided` | Floor, Counter, Bar view |
| `outlet:{id}:stock` | `availability.changed`, `item.86ed`, `item.un86ed` | Floor, Counter, Console |
| `outlet:{id}:bills` | `bill.settled`, `bill.refunded`, `drawer.opened`, `drawer.closed` | Counter, Console |
| `outlet:{id}:presence` | `device.online`, `device.offline`, `staff.signed_in` | Console |
| `outlet:{id}:admin` | `price.changed`, `catalogue.changed`, `device.revoked` | All |

### Transport

`GET /api/stream?channels=a,b,c&since=1284`

- Server sends any backlog from `since` first, in `seq` order, then streams live.
- Heartbeat comment every 15 seconds so intermediaries do not close the connection.
- `Last-Event-ID` honoured on automatic browser reconnect, so recovery is free.
- Fan-out is in-process. One node holds the subscriber map and a single `LISTEN bliss_events` connection to Postgres. Writers `NOTIFY` after commit. At this scale there is exactly one node, and the design survives two.
- Retention on `events` is 7 days. A client reconnecting with a cursor older than the oldest retained `seq` receives `{ type: "resync_required" }` and does a full pull. It is never given a partial stream.

### Why not websockets

Bidirectional transport buys nothing here. Every client-to-server action is already an idempotent HTTP mutation through the sync outbox, which is what makes offline work. SSE reconnects itself, survives proxies, needs no library, and has a built in cursor. Adding a websocket layer would mean maintaining two write paths.

---

## 6. Sync

### Principles

1. The client is authoritative on intent. The server is authoritative on money and on availability.
2. Every mutation is an idempotent, client-identified event.
3. Pull before push, always. Never push against a stale catalogue or a stale availability map.
4. Ordering matters within a tab. Global ordering is neither required nor attempted.

### Outbox

```ts
type OutboxEntry = {
  id: string;            // UUIDv7, the idempotency key
  seq: number;           // monotonic per device
  deviceId: string;
  staffId: string;
  kind: OutboxKind;      // 'tab.open' | 'seat.add' | 'line.add' | 'line.move' | 'order.fire' | ...
  aggregateId: string;   // tab id
  payload: unknown;      // versioned, zod-validated both sides
  clientAt: string;
  attempts: number;
  status: 'pending' | 'inflight' | 'acked' | 'rejected';
  rejectionCode?: string;
};
```

Drains in `seq` order per device. A rejection blocks that aggregate and surfaces to the user. A transient failure backs off without blocking other aggregates.

### Conflict resolution

| Conflict | Resolution |
|---|---|
| Two devices add lines to one tab | Union. Both sets exist, each on its own seat. |
| Two devices void the same line | First wins, second acked as a no-op. Idempotent on line id. |
| Two devices move the same line to different seats | Last write wins on server receipt, both values in the audit trail |
| Two devices move the same tab to different tables | Last write wins, both audited |
| A device settles a tab already settled | Server rejects `TAB_ALREADY_SETTLED`, client shows the existing bill |
| A device fires a line for a variant that went finished while it was offline | Server accepts the line and flags it `stock_conflict`. The bar sees the flag and the Counter can void it with one tap. **The order is never silently dropped**, because a drink may already have been poured. |
| A device pushes against a stale catalogue or availability version | Batch rejected `STALE_SNAPSHOT`, client pulls and replays |

The stock conflict rule is worth stating twice: a waiter who took an order while offline told a customer they could have it. Silently rejecting that line makes the software right and the waiter a liar. Flagging it makes the problem visible to the person who can solve it.

---

## 7. Failure behaviour

| Failure | Floor | Counter | Console | Data risk |
|---|---|---|---|---|
| Internet down | Trades from local cache, queues everything, shows the offline chip | Same, plus cash-only guidance | Unavailable | None |
| Internet flapping | Outbox drains opportunistically, no user-visible churn | Same | Degraded | None |
| App host down | As above | As above | Unavailable | None |
| Neon unavailable | As above | As above | Unavailable | None, clients buffer |
| Tablet lost mid service | Unsynced lines lost only if it never reconnects | Normal | Normal | Bounded to seconds: sync interval is 5s when connected, and the unsynced count is on screen |
| Printer offline | Unaffected | Sale completes, ticket queues, reprint when back | Normal | None |
| SSE connection drops | Reconnects with `Last-Event-ID`, replays backlog | Same | Same | None |
| Event retention exceeded while offline | Full resync on reconnect | Same | Same | None |

The only genuinely unrecoverable case is a tablet destroyed while holding unsynced orders during a total network failure. Mitigation is a five second sync interval and a persistent on-screen count of unsynced lines, so a waiter can see when they are carrying risk.

---

## 8. Security

| Area | Control |
|---|---|
| Floor and Counter auth | Six digit PIN, Argon2id, plus device binding. A PIN alone is worthless without a registered device. |
| Console auth | Email and password (Argon2id) plus mandatory TOTP for owner and manager |
| Tokens | 15 minute access token, 30 day refresh bound to a device fingerprint, rotated on every use, reuse detection revokes the family |
| Authorisation | Permission guards at the module service boundary, not in the route handler and not in the UI |
| Field-level access | Cost price, margin and supplier terms stripped from responses by a serialisation interceptor, so it cannot be forgotten per endpoint |
| Outlet scoping | Every scoped query carries the outlet predicate, enforced by a repository base class and a CI test that fails on any query omitting it |
| Device revocation | Checked on every sync and on SSE connect. Effective within one interval. |
| Transport | TLS 1.3 throughout. Neon connections use TLS with channel binding. |
| Secrets | None in source. Neon connection string and JWT signing keys from the host's secret store. |
| Audit | Append-only. The application role has no UPDATE or DELETE grant on `audit_events`. |
| PII | Almost none. No customer records, no phone numbers, no payment data. Staff names and PIN hashes only. |
| Rate limiting | Per device and per staff on PIN attempts. Five failures locks the PIN for 15 minutes and writes an audit event. |

Removing payments and fiscalisation removed the entire sensitive-data surface of the previous design. There is no PCI scope, no payment credentials, no customer phone numbers and no tax identifiers anywhere in this system. That is worth protecting: do not reintroduce any of it without revisiting this section.

---

## 9. Performance budgets

Product requirements, not aspirations. A slow till gets bypassed.

| Interaction | Budget | Measured |
|---|---|---|
| Tap to visual feedback, any control | 100ms | Client p95 |
| Add a line to the ticket rail, local commit | 50ms | Client p99 |
| Switch selected seat | 80ms | Client p95 |
| Fire an order, network up, to bar visible | 800ms | End to end p95 |
| Availability change to every Floor tile updated | 1s | End to end p95 |
| Open a tab from the tab list | 200ms | Client p95 |
| Settle by seat, bill rendered | 500ms | End to end p95 |
| Catalogue plus availability snapshot, 1,200 SKUs | 400ms compressed | p95 |
| Console report, 90 days sales by product | 2s | Server p95 |
| Floor cold start to usable | 3s | Target hardware |

Lists virtualise above 50 rows. Every async action shows a determinate or skeleton state within 100ms. Motion budgets are separate and stricter, in `07-motion-and-interaction.md`.

---

## 10. Environments

| Environment | Database | Purpose |
|---|---|---|
| `local` | Neon branch `dev-{name}` | Development, seeded |
| `preview` | Neon branch created per pull request, discarded on merge | Review against real schema shape |
| `staging` | Neon branch `staging` | Client acceptance, anonymised catalogue |
| `production` | Neon primary | Live |

Neon branching is the main reason for choosing it. A pull request that changes the schema gets its own database, seeded from a production snapshot, and the migration runs there first. Nobody reviews a migration by reading it.

Deploys run migrations in a pre-deploy step under expand, migrate, contract, so the previous application version can always still run. Migrations taking an exclusive lock on `stock_movements`, `order_lines` or `events` are refused inside the configured trading window.

---

## 11. Backup and retention

| Data | Retention | Backup |
|---|---|---|
| Transactional: tabs, orders, lines, bills, movements | Indefinite | Neon point-in-time recovery, plus nightly logical dump to object storage kept 90 days |
| Audit events | Indefinite, never deleted | Same |
| `events` realtime log | 7 days rolling | Not backed up. It is a transport buffer, not a record. |
| Device local storage | Cleared on ack, plus a 72 hour safety window | Not backed up |

A restore drill runs once before go live and quarterly after. The runbook records the measured restore time, not an assumed one.

---

## 12. What would make us revisit this

- **A second outlet.** Channel naming already anticipates it, but the SSE fan-out assumes one node holding one subscriber map.
- **More than about 12 concurrent trading devices.** The in-process fan-out becomes the thing to shard.
- **A payment integration returning to scope.** Reintroduces webhooks, idempotency on external keys and a sensitive data surface. It is a new architecture conversation, not a feature.
- **Fiscalisation returning to scope.** Reintroduces ordered, gapless transmission, which is the constraint that produced the hub in the first place.
- **A kitchen with real food service.** Routing becomes multi-destination with prep times and course timing, which is a genuinely different model.
