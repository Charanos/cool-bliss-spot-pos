# Bliss, documentation set

Client: **Cool Bliss Spot**, Nairobi
Platform: **Bliss**
Project reference: ANDISHI/BLISS/2026/001
Prepared: 7 September 2026
Supersedes: the Solera document set in full

---

## What changed from the Solera set

This is not a rename. Roughly a third of the previous system is gone and one significant capability is new.

| Change | Detail |
|---|---|
| **Renamed** | Solera becomes Bliss. All references, slugs, schemas and prompts updated. |
| **Removed: KRA eTIMS** | No fiscalisation, no VSCU integration, no fiscal queue, no certification dependency. The whole compliance document is gone. |
| **Removed: excise stamps** | No EGMS capture, no stamp table, no 2D scanner requirement. |
| **Removed: payment integrations** | No M-Pesa Daraja, no STK push, no callbacks, no reconciliation queue, no card acquiring. Tenders are recorded, not processed. |
| **Removed: the Counter Hub** | The three-tier sync topology is gone. Clients sync to one cloud API. See ADR-002. |
| **Removed: Redis and BullMQ** | Jobs run on Postgres through pg-boss. One less service to operate. |
| **Added: seat-level ordering** | The defining feature of Bliss. Every line can be attached to a specific guest at the table, which makes per-person bills a tap instead of an argument. |
| **Added: realtime channels** | Server-sent events over a durable event log, so the bar, the floor and the counter see the same thing within a second. |
| **Added: motion system** | GSAP and Lenis, with a strict budget and a hard rule about where smooth scrolling is allowed. |
| **Changed: database** | Neon Postgres, with branch-per-preview. |
| **Changed: design language** | New concept, new palette, new type. Nothing carried over from Solera. |

---

## The three surfaces

| Surface | Device | Actor | Core job |
|---|---|---|---|
| **Floor** | 10 inch Android tablet | Waiter | Pick from what is actually in stock, attach it to the guest who ordered it, send it to the bar |
| **Counter** | Desktop with touch monitor | Cashier | Settle a tab whole or by seat, sell sealed bottles, close the drawer and the day |
| **Console** | Browser | Owner, manager | Catalogue, pricing, stock, purchasing, people, reporting |

---

## Reading order

**Understand the product**

1. `01-product-spec.md`: goals, non-goals, personas, seat model, user stories, requirements with acceptance criteria.
2. `05-flows-and-channels.md`: every state machine, every sequence, the realtime channel map and the job schedule. Read this before writing any code that touches an order.

**Understand the build**

3. `02-system-architecture.md`: topology, Neon, sync, realtime, failure behaviour, security, performance budgets.
4. `03-adr-register.md`: 16 decisions, including the three deliberate reversals of Solera.
5. `04-data-model.md`: 52 tables across seven domains.

**Understand the look**

6. `06-design-system.md`: the one-pane concept, the seat chip, tokens, type, components, three surface layouts.
7. `07-motion-and-interaction.md`: GSAP and Lenis, where each is allowed, the motion budget, every named animation.
8. `08-ux-copy.md`: voice, terminology lock, microcopy catalogue.

**Execute**

9. `09-claude-code-prompts.md`: eight phased build prompts.
10. `10-claude-design-prompts.md`: screen-by-screen design prompts.
11. `12-surface-language.md`: the atmosphere layer (entry, sign-in).
12. `13-floor-tabs-revamp.md`: floor tabs, tab cards, table selector, and dialogs.
13. `14-surfaces-counter-and-sync.md`: counter surfaces and sync topology.
14. `15-floor-orders-revamp.md`: floor orders, live ticket queue, distinct tokens (`served`/`poured`), action modal, and shift handoff.
15. `16-responsive-and-offline.md`: the device ladder, the dead class checker, the service worker, what offline honestly covers, notices and undo, the table lifecycle and history.

---

## The one-line idea

Every drink belongs to a person, not just a table, and the system never forgets which.

---

## Stack

| Layer | Choice |
|---|---|
| Language | TypeScript, strict, everywhere |
| Application | One Next.js App Router project on a long-running Node host |
| Database | Neon Postgres, branch per preview environment |
| ORM | Drizzle, SQL-first migrations |
| Jobs | pg-boss, queues on Postgres, no Redis |
| Realtime | Server-sent events over a durable `events` table with cursor catch-up |
| Floor and Counter | Installable PWA route groups, Dexie for the offline outbox |
| Motion | GSAP with ScrollTrigger and Flip |
| Scroll | Lenis, Console only, never on a touch surface |
| Auth | Custom JWT, PIN plus device binding on the floor |

---

## House conventions

- Sentence case headings. No em dashes.
- Font weights never exceed 500. There is no bold in this product.
- Money is integer minor units, KES cents, never a float.
- One level of elevation anywhere in the interface. No container inside a container.
- Every void, discount, write-off and adjustment carries a name and a written reason.
- No hard deletes. Removal is a status transition.
- Route-based tabs, so every Console view is a shareable URL.
- Tabler icons only. JetBrains Mono for every number.

---

## Explicitly out of scope

Stated here so it is never quietly built.

KRA eTIMS and any fiscalisation. Excise stamp capture. M-Pesa Daraja or any payment processor integration. Card terminal integration. Loyalty and points. Online ordering and delivery. Table reservations. Payroll. A general ledger. Multi-outlet consolidation reporting.

Tender types are recorded against a bill as a type, an amount and an optional reference typed by the cashier. Bliss does not talk to a payment provider and does not claim a payment succeeded.
