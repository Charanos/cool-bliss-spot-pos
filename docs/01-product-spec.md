# Product specification, Bliss

Client: Cool Bliss Spot
Version 1.0
7 September 2026

---

## 1. Problem statement

Cool Bliss Spot runs a bar and a sealed bottle counter out of one stock room. Three things are unreliable today: what is actually available to sell right now, who at a table ordered what, and what the stock room should be holding at the end of the night.

The first costs sales, because a waiter takes an order for something the bar cannot pour. The second costs time and goodwill, because splitting a bill at 1am is done from memory. The third costs money, quietly, every week.

Bliss is one system across three screens that fixes all three by holding a single set of records.

---

## 2. Goals

| # | Goal | Measure | Target at 60 days |
|---|---|---|---|
| G1 | A waiter can only sell what exists | Orders fired for out of stock items | Zero |
| G2 | Every line belongs to a person | Lines with a seat attached, on tables of two or more | Above 90% |
| G3 | Splitting a bill stops being a negotiation | Median seconds to produce a per person bill on a table of four | Under 20s |
| G4 | The floor is faster than paper | Median seconds from tab open to first line fired | Under 10s |
| G5 | Stock on hand is trustworthy | Absolute variance at cost, monthly count | Under 3% of cost of goods |
| G6 | The day closes without a spreadsheet | Minutes from last settlement to signed close | Under 12 |
| G7 | An outage is invisible to the customer | Orders lost during a network incident | Zero |

---

## 3. Non-goals

| Non-goal | Why |
|---|---|
| KRA eTIMS and fiscalisation | Out of scope by client instruction. No fiscal queue, no certification dependency, no sequence guarantees tied to KRA. |
| Excise stamp capture | Same. No stamp table, no 2D scanner requirement, no duplicate detection. |
| Payment processor integration | Same. Tenders are recorded, not processed. Bliss never claims a payment succeeded. |
| Card terminal integration | Recorded as a tender type only. |
| Loyalty, online ordering, delivery, reservations | Not the problem being solved. Each is a separate product. |
| Payroll and general ledger | Bliss exports. It does not replace an accountant. |
| Multi-outlet consolidation | The schema is outlet-scoped from day one. The roll-up views are not built until a second outlet exists. |

---

## 4. The seat model

This is the feature that makes Bliss different from every other till, so it gets its own section.

### The idea

A tab belongs to a table. A **seat** belongs to a tab. A **line** belongs to a seat, or to the table if it is shared.

```
Tab 14  ·  Table 7  ·  4 guests
├── Seat 1        2 × Tusker           700
├── Seat 2        1 × Gilbeys double   500
├── Seat 3        1 × Smirnoff + Coke  650
├── Seat 4        1 × Tusker Lite      380
└── Shared        1 × Nyama plate      900
```

### Why it matters operationally

| Without seats | With seats |
|---|---|
| Waiter memorises who ordered what | The tablet holds it |
| "Whose was the double?" at the bar | The bar ticket says Seat 2 |
| Splitting a bill is a negotiation | Four bills, one tap each |
| A guest leaving early is a problem | Settle Seat 3, the rest of the tab stays open |
| A wrong drink is a guess | The void names the seat it came from |

### The rules

1. A tab opens with a guest count. Seats are created automatically, numbered 1 to n, and can be added or removed at any time.
2. A seat may be given a label. Free text, optional, up to 24 characters. "Cap", "Birthday", "Boss". Waiters use it constantly. It is never required.
3. Every line defaults to the currently selected seat. There is always a selected seat, and "Shared" is one of the options.
4. Seats carry a colour from a fixed eight-colour palette, assigned by index. The colour is always accompanied by the number. Colour is never the only signal.
5. A seat can be settled independently. Its lines close onto their own bill, the seat closes, and the tab stays open with the remaining seats.
6. A line can be moved between seats after it is fired. It is a move, not a void and re-add, and the move is audited.
7. Merging two tabs renumbers seats and keeps every line attached to the right guest.
8. A tab on a table of one has exactly one seat and the seat controls are hidden. The feature disappears when it is not useful.

---

## 5. Stock-aware ordering

The second thing that separates Bliss from a generic till.

The Floor item grid is driven by live availability, not by a static catalogue.

| State | Condition | Behaviour |
|---|---|---|
| **Available** | On hand above the low threshold | Normal tile, tappable |
| **Running low** | On hand at or below the configured threshold | Tile shows remaining count in the corner, still tappable |
| **Last few** | On hand at or below 3 serves | Count shown in attention colour, still tappable |
| **Finished** | On hand at or below zero, or manually 86'd | Tile at 40% opacity, not tappable, still focusable, announces "finished" |

Propagation: when a fired order takes a variant to zero, the stock module emits on the outlet's stock channel and every Floor device greys the tile within one second. No refresh, no polling loop.

Manual override: a supervisor can 86 an item from either the Floor or the Console, with a reason, and un-86 it the same way. A manual 86 outranks the stock figure, because the bar knowing the bottle is broken beats the ledger thinking it is full.

---

## 6. Personas

### Amina, waiter
Five nights a week, four months in. Carries a tray in one hand and a tablet in the other. Needs speed, legibility in a dim room, and never to be blamed for something she did not do. Success is three taps to a fired order and her section closing clean at 1am.

### Kevin, cashier and supervisor
Behind the counter, handles every shilling, runs the bottle counter during the day. Needs to settle fast, split without arithmetic, and close the drawer with a number he can defend.

### Wanjiru, owner
On site four days a week. Was an accountant. Does not want a dashboard, wants an answer. Needs to know last night's margin, which line is dying on the shelf, and who voids more than they should.

### Joseph, stock controller
Three mornings a week. Receives deliveries, counts stock, chases suppliers. Needs to receive without a clipboard, count without arithmetic, and have variance explained rather than assumed to be his fault.

---

## 7. User stories

### Floor

| ID | Story | P |
|---|---|---|
| F-01 | Open a tab against a table in one tap, setting the guest count as I go | P0 |
| F-02 | See only what the bar can actually pour right now | P0 |
| F-03 | Add a serve to the selected seat in two taps | P0 |
| F-04 | Switch the selected seat in one tap without losing my place in the grid | P0 |
| F-05 | Label a seat so I remember who is who | P0 |
| F-06 | Mark a line as shared when it is for the table | P0 |
| F-07 | Fire an order and see it reach the bar | P0 |
| F-08 | Keep working when the Wi-Fi drops | P0 |
| F-09 | See which of my lines are poured and which are still waiting | P0 |
| F-10 | Move a line from one seat to another after I got it wrong | P0 |
| F-11 | Move a whole tab to a different table | P0 |
| F-12 | Add a seat mid service when someone joins | P0 |
| F-13 | See a per seat total and a tab total at all times | P0 |
| F-14 | Request a void on a line with a written reason | P0 |
| F-15 | Hand my open tabs to another waiter at shift change | P0 |
| F-16 | Add a note to a line, for example no ice | P1 |
| F-17 | Search the grid by name when the category is faster to type than to find | P1 |
| F-18 | See happy hour pricing applied without remembering the time | P1 |

### Counter

| ID | Story | P |
|---|---|---|
| C-01 | Pull up any open tab by table, waiter or tab number | P0 |
| C-02 | Settle a whole tab | P0 |
| C-03 | Settle one seat and leave the rest of the tab open | P0 |
| C-04 | Split the remainder evenly across seats when the table asks for that instead | P0 |
| C-05 | Record cash tendered and calculate change | P0 |
| C-06 | Record an M-Pesa or card payment as a tender with a reference I type | P0 |
| C-07 | Take more than one tender against one bill | P0 |
| C-08 | Sell a sealed bottle without opening a tab | P0 |
| C-09 | Print a receipt, and reprint it later | P0 |
| C-10 | Open a drawer session with a counted float | P0 |
| C-11 | Record a cash drop to the safe | P0 |
| C-12 | Close the day on a blind count with the variance reason recorded | P0 |
| C-13 | Approve a void or discount with my own PIN | P0 |
| C-14 | Keep trading with the internet down | P0 |
| C-15 | Refund a settled bill with approval | P1 |

### Console

| ID | Story | P |
|---|---|---|
| N-01 | See last night in one screen: takings, margin, covers, variance, exceptions | P0 |
| N-02 | Define a product with several serve sizes off one bottle | P0 |
| N-03 | Set price lists and happy hour windows | P0 |
| N-04 | Set the low stock threshold per product so the floor warns at the right point | P0 |
| N-05 | Raise a purchase order and receive against it | P0 |
| N-06 | Run a blind stock count on a tablet and see computed variance | P0 |
| N-07 | See pour variance by product | P0 |
| N-08 | See void and discount rates by staff member | P0 |
| N-09 | Set roles and permissions per person | P0 |
| N-10 | See an audit trail of every price change, void, write-off and 86 | P0 |
| N-11 | Record a write-off with a category and a reason | P0 |
| N-12 | Export sales, purchases and movements to CSV | P0 |
| N-13 | 86 or un-86 an item and have the floor update immediately | P0 |
| N-14 | See sales by seat position, to understand table composition | P1 |
| N-15 | See reorder suggestions from real velocity | P1 |
| N-16 | See dead stock with no movement in 60 days | P1 |

### Cross-cutting

| ID | Story | P |
|---|---|---|
| X-01 | Sign in with a PIN on a registered device | P0 |
| X-02 | Revoke a lost device remotely | P0 |
| X-03 | Be told plainly when the system is offline and what happens next | P0 |
| X-04 | Never have anything hard deleted | P0 |

---

## 8. Requirements

### R1, seat attribution

Every order line carries a nullable `tab_seat_id`. Null means shared. The Floor always has a selected seat, and the selection persists across category changes and across app restarts within the same tab.

*Acceptance*
- [ ] Given a tab with four seats, when a line is added with Seat 2 selected, then the line is attached to Seat 2 on the server and on every other device within one second.
- [ ] Given a line attached to Seat 2, when it is moved to Seat 3, then an audit event records the move with actor, time and both seat identifiers, and no void is created.
- [ ] Given a tab of one guest, then no seat control is rendered anywhere on the Floor or the Counter.
- [ ] Given a seat with a label, then the label appears on the ticket rail, the bar ticket and the printed bill.
- [ ] Given a seat is settled, then its lines close onto their own bill, the seat status becomes settled, and the tab remains open.

### R2, stock-aware availability

The Floor receives an availability map with the catalogue snapshot and keeps it current over the stock channel.

*Acceptance*
- [ ] Given a variant reaches zero on hand, then every connected Floor device renders it as finished within one second without a refresh.
- [ ] Given a finished tile, then it cannot be tapped, it remains reachable by keyboard, and a screen reader announces it as finished.
- [ ] Given a device is offline and a variant hits zero, then on reconnect the client pulls availability before draining its outbox, and any queued line for that variant is flagged rather than silently accepted.
- [ ] Given a manual 86 and a positive stock figure, then the manual 86 wins.
- [ ] Given a low threshold of 6 and 4 on hand, then the tile shows the count in the attention colour.

### R3, order capture offline

Every mutating Floor action writes local state and an outbox entry in one IndexedDB transaction. The outbox drains in sequence per device.

*Acceptance*
- [ ] Given no network, when a waiter adds five lines across three seats and fires, then the order persists locally and reaches the bar within three seconds of the network returning, with seat attribution intact.
- [ ] Given two devices modified the same tab while offline, when both reconnect, then all lines from both exist, none duplicated, each on its own seat.
- [ ] Given the app is force closed mid order, when reopened, then the in progress tab and the selected seat are restored exactly.
- [ ] Given a fired line, then it cannot be edited, only voided with a reason or moved between seats.

### R4, pricing resolution

One deterministic pipeline resolves price: base price list, serve size, active time rule, line discount, bill discount share. The derivation is stored on the line.

*Acceptance*
- [ ] Given a happy hour window of 17:00 to 19:00 and a line fired at 18:59:59, then the happy hour price applies and still applies when settled at 21:30.
- [ ] Given any historic line, when opened in the Console, then the full derivation is shown as an ordered chain.
- [ ] Given a bill level discount across five lines, then the sum of allocated discounts equals the bill discount exactly.

### R5, money handling

All monetary values are 64 bit integers in KES cents. No floating point arithmetic touches money at any layer. Rounding is applied once, at tender, half up to the nearest shilling.

*Acceptance*
- [ ] Given a four way even split of a 1,333 shilling bill, then the four bills sum to exactly 1,333.
- [ ] Given a code review, then no money value is typed as a float or an unbranded number.

### R6, settlement

A bill closes atomically. Multiple tenders per bill. Tenders are recorded, never processed.

*Acceptance*
- [ ] Given a 4,500 bill settled with 2,000 cash and 2,500 recorded as M-Pesa with a typed reference, then the bill closes once, with two tender rows and the reference stored verbatim.
- [ ] Given a tender kind of M-Pesa, then no outbound network call to any payment provider exists in the codebase.
- [ ] Given a device attempts to settle a bill already settled, then the server rejects with `BILL_ALREADY_SETTLED` and the client shows the existing bill rather than an error.

### R7, cash drawer

Opens with a counted float, closes on a blind count. Expected cash is not returned by the API until the counted figure is committed.

*Acceptance*
- [ ] Given a drawer close in progress, then the expected figure is absent from every response body before commit. A test fails if the field appears.
- [ ] Given a variance above the outlet threshold, then close is blocked until a reason of at least ten characters is supplied.
- [ ] Given a closed session, then it cannot be reopened. A correction is a new linked adjustment.

### R8, inventory as a ledger

On hand is derived from an append-only movement ledger. A snapshot table exists only as a cache.

*Acceptance*
- [ ] Given any variant at any timestamp, then on hand is reproducible by summing movements.
- [ ] Given the API surface, then no path writes on hand directly. The application role has no UPDATE grant on `stock_movements`.
- [ ] Given a committed count with variance, then adjustment movements are written with the supplied reasons and the count locks permanently.

### R9, pour yield and variance

Each product defines a container volume and serve sizes. Theoretical depletion is computed from sold serves and compared against counted depletion, in millilitres and at cost.

*Acceptance*
- [ ] Given a 750ml bottle with a 30ml tot and 25 tots sold, then theoretical depletion is exactly one bottle.
- [ ] Given a counted depletion of 1.4 bottles, then variance shows 0.4 bottles, 300ml and the cost value, against the configured tolerance.

### R10, identity and audit

PIN plus device binding on Floor and Counter. Email, password and TOTP on Console. Every state change writes an audit event.

*Acceptance*
- [ ] Given a waiter credential, when requesting a cost price, then the field is absent from the response, not merely hidden in the UI.
- [ ] Given a device marked lost, then within one sync interval it cannot authenticate, and its queued orders remain recoverable by an admin.
- [ ] Given any price change, void, discount, write-off, 86 or permission change, then an audit row exists with actor, timestamp, before, after and reason.
- [ ] Given any record, then no hard delete path exists.

### R11, business day

A trading day is defined by an outlet cutover time, not by midnight. All reporting and day close key on `business_date`.

*Acceptance*
- [ ] Given a cutover of 05:00, then a sale at 01:47 belongs to the previous calendar date's business day.
- [ ] Given a later change to the cutover configuration, then historic `business_date` values do not move.

### R12, realtime

Every connected client holds a subscription to its outlet's channels and catches up from a cursor after a disconnection.

*Acceptance*
- [ ] Given an order fired on Floor 2, then the bar view and the Counter reflect it within one second.
- [ ] Given a client disconnected for four minutes, when it reconnects with its last cursor, then it receives every missed event in order, exactly once.
- [ ] Given a client whose cursor is older than the retention window, then it is told to resynchronise fully rather than receiving a partial stream.

---

## 9. Success metrics

### First 30 days

| Metric | Success | Stretch |
|---|---|---|
| Orders originating on a tablet | 85% | 95% |
| Lines with a seat attached, tables of 2+ | 85% | 95% |
| Median tab open to first line fired | Under 12s | Under 8s |
| Median time to produce a per person bill, table of four | Under 25s | Under 15s |
| Orders fired for finished stock | 0 | 0 |
| Data loss incidents during outages | 0 | 0 |
| Support tickets, weeks 3 and 4 | Under 8 | Under 4 |

### 60 to 120 days

| Metric | Success | Stretch |
|---|---|---|
| Spirit pour variance | Under 4% | Under 2.5% |
| Cash drawer variance as share of cash takings | Under 0.5% | Under 0.2% |
| SKUs with a current cost and computed margin | Above 95% | 100% |
| Dead stock value, no movement in 60 days | Down 40% from baseline | Down 60% |
| Day close duration | Under 12 min | Under 8 min |

Baselines are captured in week 1. Without them the second table means nothing, so the baseline pull is a hard gate on the design milestone.

---

## 10. Open questions

| # | Question | Owner | Blocking |
|---|---|---|---|
| Q1 | Does the bar want a printed routing ticket, or a screen at the bar? Changes the bridge requirement. | Client | Yes, affects Counter milestone |
| Q2 | Is the bottle counter physically at the same till, or a second station? | Client | Yes, affects device count |
| Q3 | Do cocktails with multiple spirits exist on the menu, or single spirit serves only? | Client | Yes, affects recipe scope |
| Q4 | Current count cadence: nightly, weekly or monthly? Sets the default count template. | Client | No |
| Q5 | Are staff drinks and comps recorded at all today? If not, the first month will read as a shrinkage spike when it is actually a recording change. | Client | No, but must be communicated before go live |
| Q6 | Typical table size. If most tables are one or two guests, the seat model matters less and the Floor layout should reflect that. | Client | Yes, affects Floor design |
| Q7 | Is there an existing product list in any digital form, or does the catalogue start from a shelf walk? | Client | Yes, affects discovery effort |
