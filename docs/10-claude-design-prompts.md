# Claude Design prompts, Bliss

Version 1.0
7 September 2026

---

## How to use this

One prompt per screen, in order within each surface. Give the standing brief once per session, then one screen at a time. A prompt asking for four screens produces four mediocre screens.

---

## Standing brief

```
You are designing Bliss, a point of sale and stock control system for Cool Bliss Spot,
a bar and bottle counter in Nairobi.

Three surfaces: Floor (10 inch Android tablet, landscape, dark), Counter (15.6 inch
touch monitor, dark), Console (browser, light). Plus a Bar view on a second screen,
dark and high contrast.

THE CONCEPT: ONE PANE
One level of depth, everywhere. There is the pane and there is what sits on it.
Nothing is nested inside anything. Grouping is done with space and a single hairline,
never with a box. No element with a background contains another element with a
background. No element with a border contains another with a border. There is exactly
one elevation. There is no elevation two.

THE SIGNATURE ELEMENT: THE SEAT CHIP
The defining feature is that every drink belongs to a specific guest, not just a table.
A seat chip is a 22px rounded square, radius 6, filled with the seat's colour, carrying
the seat number in JetBrains Mono 500 at 11px in #0B1015. It is 40px as a tap target in
the Floor seat selector. It appears beside every line on the floor, at the bar, on the
counter and on the printed bill. Colour never carries meaning alone: the chip always
contains its number. "Shared" is a dashed outline chip in #B3BFC9 with a two-dot glyph,
never a ninth colour.

COLOUR
Neutrals, "frost", cool grey with a faint blue-green cast, never warm, never corporate
slate:
  0 #FBFCFD · 50 #F4F7F9 · 100 #E7ECF0 · 200 #D4DCE3 · 300 #B3BFC9
  400 #8C9AA6 · 500 #6B7884 · 600 #4E5A65 · 700 #38424B · 800 #232B32
  900 #151B20 · 950 #0B1015
Primary, "glacier", iced blue:
  200 #A8DCE6 · 300 #6FC6D6 · 400 #3FAAC0 · 500 #2A8CA3 · 600 #1F6E82 · 700 #17545F
Counterpoint, "ember", reserved for money that needs looking at and attention states:
  300 #E9BE86 · 400 #E0A35A · 600 #97591A
Signals (light / dark):
  Poured #2E7D52 / #63B98A · Low #97591A / #E0A35A
  Stop #A33232 / #E08585 · Info #1F6E82 / #6FC6D6
Seat palette, fixed, by seat_no modulo 8, identical on both themes, all with #0B1015
text:
  #6FC6D6 #E0A35A #9DC271 #B79BE0 #E58BA4 #7FA8E0 #D9C46B #6FD2B4

No gold, no gradients, no glassmorphism, no neumorphism, no coloured shadows.

TYPE
Geist Sans for everything. JetBrains Mono, tabular figures, for every number.
No third family, no display serif.
FONT WEIGHT NEVER EXCEEDS 500. There is no bold in this product. Hierarchy comes from
size, colour and space.
Currency renders as KES 12,450.00 with the KES prefix in small label type at frost-500
and the figure in JetBrains Mono.

SHAPE AND ELEVATION
Radii: 6 controls and chips, 10 tiles and panes, 16 sheets. Three values, no pills.
Space scale: 2 4 6 8 12 16 20 24 32 40 56 72 96.
Dark elevation: frost-800 surface with a 1px frost-700 hairline. No shadow, because
shadows do not exist in the dark.
Light elevation: frost-50 surface, 1px frost-200 hairline, 0 1px 2px rgba(11,16,21,.05).

MOTION
Floor 140ms ceiling, Counter 240ms, Bar 160ms, Console 400ms. Nothing anywhere exceeds
400ms. Easing: out cubic-bezier(.22,1,.36,1), in (.64,0,.78,0), inOut (.65,0,.35,1),
snap (.34,1.3,.64,1) for press release only. No bounce, no elastic.

ACCESSIBILITY
4.5:1 body, 3:1 large text and UI boundaries. Focus ring always visible, 2px glacier-400
at 2px offset. Touch targets 48x48 on Floor, 44x44 on Counter, 8px minimum gap.
No state signalled by colour alone.

COPY
Sentence case. No exclamation marks, no emoji, no apologies, no "Are you sure?",
no OK and Cancel. Buttons are verbs naming their outcome, carrying the amount or count:
"Fire order", "Settle Seat 3 · KES 650", "Void the line", "Keep it". 24-hour clock.
Dates as 6 Sep 2026. No em dashes.
Say "finished" not "out of stock". Say "on hold" not "86'd". Say "poured" not "served".
```

---

## Floor, dark, 1280 × 800 landscape

### F1, the main ordering screen

```
Design the primary Floor screen for Bliss.

Three columns on a frost-950 page:
  Left rail 180px: zones, then this waiter's open tabs
  Centre fluid: category chips, then a product tile grid
  Right rail 340px: the seat selector and the ticket rail

LEFT RAIL
Zones as a plain vertical list: Terrace, Main bar, Counter. The selected zone carries a
3px glacier-400 left edge, never a filled background.
Below, "My tabs": each row shows the table label, a compact row of 16px seat chips for
that tab, and the running total in JetBrains Mono right aligned. Show three tabs, one
with four seats, one with two, one with one (which shows no chips at all).

CENTRE
Horizontally scrolling category chips at the top, 36px, radius 6. The selected chip is
filled glacier-400 with frost-950 text.
Below, a grid of product tiles at 116x116 with 12px gutters.
Each tile: a 3px category colour on the left edge, product name in Geist 400 at 17px
wrapping to two lines, price beneath in JetBrains Mono 15px at frost-300.
Show all four availability states in the grid:
  - most tiles normal
  - one "low", with a remaining count top right in JetBrains Mono at ember-400
  - one "last few", same but with a 1px ember-400 corner tick
  - one "finished": 40% opacity, one 1px diagonal hairline in frost-600, a FINISHED
    micro chip on the label, visibly not tappable
  - one "on hold": same treatment but the chip reads ON HOLD

RIGHT RAIL
Top: the seat selector strip, 56px tall, frost-800 surface.
40px seat chips with 8px gaps: seats 1 to 4, then a dashed Shared chip, then a 40px
plus. Seat 2 is selected, carrying a 2px frost-0 ring at 2px offset. Beneath each chip,
that seat's running total in JetBrains Mono 12px. Seat 2 also shows the label "Kofi" in
label type beneath.
Below: the ticket rail, grouped by seat. Each group is headed by its chip, the label if
set, and the seat subtotal right aligned. Groups are separated by 16px of space and a
1px frost-700 hairline, never by a card.
Show:
  - Seat 1: two lines, one already poured (reduced contrast, small Poured dot)
  - Seat 2: one line with a note "NO ICE"
  - Seat 3: one line carrying an Info dot, meaning not yet sent
  - Shared: one line
Base layer spanning the ticket column, 88px, frost-900, 1px frost-700 top hairline:
selected seat total, tab total in JetBrains Mono 24px, and a 56px "Fire order" button.
Across the left and centre, the same base layer carries: waiter name, elapsed shift,
and a connection chip reading "● Synced".

The base layer never scrolls and nothing ever covers it.

Deliver the default state, then the same screen offline: the connection chip reads
"Offline. 4 orders held." in Info, and four lines carry Info dots.
```

### F2, seat selector states

```
Design a states sheet for the Floor seat selector, the most important control in Bliss.

On one artboard, frost-950 background, show the strip in each of these states at full
width:

1. Four seats, none labelled, Seat 1 selected
2. Four seats, two labelled ("Kofi", "Birthday"), Seat 2 selected
3. Seven seats, horizontally scrolled, showing the scroll affordance at both edges
4. Four seats where Seat 3 is settled: chip at 40% opacity with "settled" in micro type
   beneath, not selectable
5. Shared selected: the dashed chip carries the ring, and the word "Shared" sits beneath
6. The add-seat plus in its pressed state
7. A one-seat tab: the entire strip is ABSENT. Show the ticket rail starting directly at
   the top of the column. Label this frame clearly, because the feature disappearing is
   the design decision.

Then show the long-press menu on a seat chip: label this seat, settle this seat, remove
this seat. A frost-800 sheet, radius 16, one level of depth, no nested containers.

Then show the labelling sheet: title "Label Seat 3", a text field with placeholder
"Cap, birthday, boss", helper "Only you and the bar see this.", and actions "Keep it"
and "Save label".

Annotate the chip geometry at 4x: 40px tap target, 22px dense, radius 6, number in
JetBrains Mono 500, the 2px ring at 2px offset, and the dashed treatment for Shared.
```

### F3, moving a line between seats

```
Design the move-line interaction on the Floor, as a four-frame sequence on one artboard.

Frame 1: the ticket rail with Seat 2 expanded, one line long-pressed. The row lifts by
2px with a 1px glacier-400 outline. No menu yet.

Frame 2: the action sheet, frost-800, radius 16, rising from the bottom to the base
layer and stopping there. The base layer stays fully visible. Three actions at 48px:
"Move to another seat", "Add a note", "Void the line". The destructive action last and
in the Stop colour, with 16px separating it from the others.

Frame 3: the seat picker. Title "Move 1 × Gilbeys to another seat". A row of 56px seat
chips, the current seat marked "current" in micro type and not selectable. Shared
included. No confirmation step after this.

Frame 4: the result. The row now sits in the Seat 3 group. Annotate that this is a GSAP
Flip transition at 140ms with ease.inOut, the row physically travelling from one group
to the other, and note that the line keeps its identity, its fire time and its price
derivation. It is a move, not a void and re-add.
```

### F4, the tab list and opening a tab

```
Design the Floor tab list and the open-tab flow.

SCREEN 1, the tab list occupying the full width (the view a waiter starts a shift on).
frost-950. A grid of tab cards at 240x132, radius 10, frost-800 with a 1px frost-700
hairline. One level of depth.
Each card: table label in Geist 500 at 20px, a row of 16px seat chips, elapsed time in
JetBrains Mono at frost-400, and the running total in JetBrains Mono 20px.
Show six cards: one with four seats, one with two, one with one and no chips, one where
a seat chip is dimmed because it has been settled, one with an Info dot meaning unsent
lines, and one empty table in an available state.
Base layer: waiter, shift elapsed, connection chip, and "Open tab".

SCREEN 2, opening a tab. A sheet rising to the base layer.
Title "Open tab on Table 7". A guest count stepper with large 56px controls and the
number in JetBrains Mono 40px. Beneath, a live preview of the seat chips that will be
created, updating as the stepper changes. An optional tab name field with placeholder
"Birthday, Kevin's table". Actions "Keep it" and "Open tab".

Show the stepper at 1, where the preview shows a single chip and a line of helper text
reading "One guest. Seats will not be shown."
```

---

## Counter, dark, 1920 × 1080

### C1, tab list and tender panel

```
Design the main Counter screen for Bliss.

Left region fluid, right tender panel fixed at 420px, frost-950 page.

LEFT
Mode segmented control at the top: Tabs, Quick sale.
A grid of open tab cards at 230x140, radius 10, frost-800, 1px frost-700 hairline.
Each card: table label, a row of 18px seat chips, waiter name, elapsed time, total in
JetBrains Mono 22px. One card shows a settled seat chip at 40% opacity.
The selected tab expands beneath the grid into its bill, grouped by seat: each group
headed by its chip and label, lines listed with qty, description and price right
aligned on a shared decimal column, and a seat subtotal. The Shared group last.
Tapping a seat chip in the bill selects that seat and switches the tender scope.

RIGHT, TENDER PANEL
Never a modal. The bill stays visible while money is taken.
Top: a segmented control, "Whole tab" / "This seat" / "Even split".
Beneath: "Amount due" label, then KES 4,200.00 in JetBrains Mono 40px, the largest
number anywhere in the product.
Four tender buttons in a 2x2 grid at 56px: Cash, M-Pesa, Card, Split.
A numeric keypad with 72px keys, three columns, digits, double zero, backspace, all
JetBrains Mono.
Foot: a 56px primary action reading "Settle KES 4,200".

BASE LAYER, full width, 72px:
Left: cashier name, "Drawer KES 18,400", connection chip.
Right: the primary action.

Deliver two frames:
1. Scope "Whole tab", the full bill shown, amount due 4,200.00
2. Scope "This seat" with Seat 3 selected: the bill dims every other seat group to 40%,
   Seat 3 stays full contrast, amount due reads 650.00, and the action reads
   "Settle Seat 3 · KES 650". Annotate that the transition between these two frames is
   a GSAP Flip at 220ms, and that it is the single most important animation in the
   product because the bill visibly reorganises.
```

### C2, tender and reference capture

```
Design the tender states inside the Counter panel. The bill on the left never changes
and is never covered.

Frame 1, cash. A tendered field in JetBrains Mono 32px, quick amounts (exact, 500,
1000, 5000) as 44px chips, and change due appearing beneath in num-xl in the Poured
colour. Annotate that change due stays until an explicit action and NEVER times out.

Frame 2, M-Pesa. This is NOT a payment flow. Show:
  - Amount field
  - A field labelled "Reference (optional)"
  - Helper text in frost-400 reading exactly: "Bliss records this. It does not check
    it."
  - Action "Add tender · KES 2,500"
Annotate clearly: Bliss makes no call to any payment provider and never claims a
payment succeeded. The copy must not be softened.

Frame 3, split tender. Two tenders already recorded as rows (cash 2,000, M-Pesa 2,500
with its reference), a running "still due" figure counting down, and the settle action
enabling only when the remainder reaches zero.

Frame 4, even split. Title "Split what is left evenly?" Body "KES 2,101.00 across
3 seats. Two seats pay KES 700.34, one pays KES 700.33." Show the three resulting
amounts against their seat chips. Annotate that the remainder is always stated, never
hidden.
```

### C3, blind day close

```
Design the Counter day-close flow, three frames, each occupying the left region while
the base layer stays visible.

FRAME 1, preflight blocked. Title "Close the business day?" Body "2 tabs are still open.
They must be settled or voided first." Beneath, the two tabs as compact cards with their
seat chips and totals, each linking to the tab. Primary action disabled with the reason
stated beside it rather than in a tooltip.

FRAME 2, counting. Title "Count the drawer" in Geist 500 at 28px.
Denomination rows: 1000, 500, 200, 100, 50, then coins. Each row has a stepper and a
computed subtotal in JetBrains Mono right aligned.
Running counted total in JetBrains Mono 40px at the foot.
CRITICAL: the expected figure appears NOWHERE. Not greyed out, not behind a toggle. It
is not in the payload. Annotate this.
Action "Commit the count".

FRAME 3, variance revealed. Three figures stacked: Counted, Expected, Variance.
Variance in JetBrains Mono 40px. Annotate that the number counts up from zero over
240ms and the colour resolves to Poured or Low at the END of the tween, so the operator
reads the number before the judgement.
If over threshold, a mandatory reason field with quick chips: "Change given in error",
"Payout not recorded", "Unknown". Copy above: "The count is KES 1,240 under the expected
figure. Write what you think happened before closing."
Action "Close the drawer".
```

---

## Bar view, dark, high contrast, 1920 × 1080

### B1, the bar screen

```
Design the Bar view for Bliss, shown on a second monitor above the bar, read at two
metres by someone in a hurry.

frost-950 page, type one full step larger than anywhere else in the product.

A column of ticket cards, newest at the top, 560px wide, radius 10, frost-800 with a
1px frost-700 hairline. One level of depth.

Each ticket:
  Header: TAB 14 · T7 · Amina · 22:41, with "2 min ago" right aligned in JetBrains Mono
  Lines: a 28px seat chip, then quantity in JetBrains Mono, then the product name in
  Geist 400 at 22px. Modifiers in micro caps beside the line, for example NO ICE.
  NO PRICES ANYWHERE.
  Foot: "Mark all poured" as a 48px action.

Show four tickets:
1. Fresh, all lines pending
2. Partially poured: two lines at 40% opacity with a strike-through drawn across them
3. A ticket carrying a line flagged "** RAN OUT **" in the Stop colour, with the seat
   chip still present
4. A ticket older than five minutes: its 1px hairline has transitioned to the Low
   colour. Annotate that this happens once over 400ms with no pulse and no flash,
   because a bar at 23:00 does not need a strobe.

Then design the empty state: title "Nothing waiting", body "Everything fired has been
poured.", no action offered.
```

---

## Console, light, 1440 wide

### N1, overview

```
Design the Console overview, the screen the owner opens at 09:00.

It must answer three questions above the fold with no scrolling and no interaction: how
did last night go, where is the money leaking, and what needs me today.

Layout: 220px left rail, page title, a route-driven tab strip, content region, and a
base layer carrying outlet name, business date and device count.
frost-0 page. Raised surfaces are frost-50 with a 1px frost-200 hairline. ONE level of
depth: the metric cards sit directly on the page, and nothing inside them has its own
background or border.

ROW 1, four headline figures, each a quarter width:
  Net sales · KES 184,200 · with a delta chip "+8% vs Fri avg"
  Gross margin · 62.4%
  Covers · 148 · with "37 tabs, 4.0 avg seats"
  Variance at cost · KES 4,820 · in the Low colour
Figures in JetBrains Mono 28px, labels in label type at frost-600.
Annotate that these count up from zero over 400ms staggered 60ms, on first paint only.

ROW 2, two panels side by side:
  Left, "Sales by hour": a bar chart, glacier-600 bars, frost-200 gridlines, hours in
  JetBrains Mono. No legend for a single series.
  Right, "Needs attention": at most five exception rows, each a signal dot, a sentence
  and a link. For example "7 lines below reorder point", "Gilbeys has been on hold since
  Thursday", "Drawer closed KES 1,240 under at 01:12", "4 orders from Floor 3 could not
  be sent". If there are none, show "Nothing needs you today." with NO action offered.

ROW 3, two panels:
  Left, "Top movers": product, units, value, margin.
  Right, "Variance by product": product, expected, counted, variance, sorted by
  variance value.

Deliver a second frame: the loading skeleton, matching the final layout exactly rather
than a centred spinner.
```

### N2, inventory with availability

```
Design the Console inventory workspace, "Stock" tab.

Tab strip: Stock · Counts · Movements · Recipes · Holds. The current tab carries a 2px
glacier-600 underline.

Filter bar: location select, category select, a "needs attention" toggle, a search
field, and "Export CSV" as a ghost action on the right. Every filter state lives in the
URL.

Data table, 44px rows, 1px frost-100 row rules, NO zebra striping, sticky header in
label type at frost-600:
  Product · Variant · Location · On hand · Unit cost · Value · 28d velocity ·
  Days cover · State · Variance %
Numeric columns right aligned, JetBrains Mono, tabular figures, decimals aligned.

The State column carries the same status chip the Floor uses, so the two surfaces agree
visually: Available (no chip), Low, Last few, Finished, On hold. Each chip is a 6px dot
plus a word.

Show twelve rows including: two Low, one Last few, one Finished by stock, one On hold
(with the reason in a tooltip and in the row detail).

Row hover reveals a right-aligned overflow: view movements, adjust with reason, put on
hold, add to order.

Deliver four frames:
1. Loaded, twelve rows
2. Loading skeleton matching the table shape
3. Empty because no products exist: "Your catalogue is empty" with "Import catalogue"
4. Empty because filters exclude everything: "No results for these filters" with
   "Clear filters"
```

### N3, holds

```
Design the Console "Holds" tab, the manager's control over what the floor can sell.

Header: a single line of context, "3 items on hold. The floor cannot sell them."

Table: Product · Put on hold by · When · Reason · Expected back · (action).
Reason shown in full, not truncated, because it is the whole value of the record.
The action column carries "Take off hold" as a ghost button per row.

Beneath, a "Put an item on hold" affordance: a search field, then a sheet.

Sheet design: title "Put Gilbeys 750ml on hold?" Body "The floor stops being able to
sell it straight away." Quick reason chips: "Bottle broke", "Not delivered", "Quality
issue". A reason field with helper "at least 10 characters". An optional "expected back"
date. Actions "Keep it" and "Put on hold".

Then the empty state: title "Nothing on hold", body "Everything the ledger says you
have, the floor can sell.", NO action offered, because nothing is wrong.

Annotate that placing a hold propagates to every Floor tablet within one second over
the stock channel, and that a hold outranks the computed stock figure in every case.
```

### N4, blind stock count

```
Design the Console stock count flow, three screens.

SCREEN 1, setup. Title "Start a blind count". Fields: location, scope (full, cycle,
spot), a category filter for cycle counts, and an assignee. Copy beneath: "A blind count
compares what you have against what the ledger says you should have. The expected
figures stay hidden until you commit." Action "Start blind count".

SCREEN 2, counting. Design this at 1024 wide, because it is used on a tablet.
A list of count lines. Each row: product, variant, unit, and a large numeric input at
56px with JetBrains Mono 24px.
For part bottles, a secondary input in tenths with a small vertical bottle indicator.
Progress in the base layer: "38 of 112 counted" with a thin progress rule.
CRITICAL: no expected quantity appears anywhere. The column does not exist. Annotate it.
Action "Submit for review".

SCREEN 3, review. Expected now appears. Columns: Product · Expected · Counted ·
Variance · Variance value · Reason.
Variance coloured Poured within tolerance, Low over, Stop for a large negative.
Rows over tolerance carry a mandatory inline reason field with quick chips: "Breakage
not recorded", "Delivery short", "Miscount, recounted", "Unknown".
A "Recount this line" action per row returning it to counting.
Footer: total variance at cost in JetBrains Mono 32px.
Action "Commit count", opening the reason dialog with the consequence copy "24 lines,
KES 8,400 total variance. Committing writes adjustments and locks the count."
```

---

## Component sheets

### S1, the seat chip

```
Design the specification sheet for the seat chip, the signature element of Bliss.

One artboard, dark theme on the left half, light on the right.

Show:
- All eight seat colours at 22px dense and 40px tap size, each carrying its number
- The Shared chip: dashed outline frost-300, two-dot glyph, both sizes
- Selected state: 2px ring at 2px offset, frost-0 on dark, frost-950 on light
- Settled state: 40% opacity with "settled" in micro type beneath
- With a label beside it, truncated at 14 characters
- In context: leading a ticket line, heading a seat group, in a tab card row, on a bar
  ticket, on a printed bill
- At 4x magnification: geometry, radius 6, the number in JetBrains Mono 500, the ring
  offset, and the dash pattern for Shared

Annotate: colour is assigned by seat_no modulo 8 and never chosen by a user; colour
never carries meaning alone; a one-seat tab renders no chips at all; Shared is a
different kind of thing rather than a ninth guest.

Include a greyscale strip of all nine variants proving they remain distinguishable when
printed on a thermal receipt.
```

### S2, controls and states

```
Design the core control sheet for Bliss, both themes side by side.

Buttons: primary, secondary, ghost, destructive, tender. Sizes 32, 40, 48, 56. States
default, hover, focus, active, loading, disabled. Show the focus ring at 2px
glacier-400 with 2px offset on both themes, and a loading button with its width locked
so nothing reflows.

Status chips: Open, Fired, Poured, Settled, Voided, Low, Last few, Finished, On hold,
Ran out, Offline, Synced. 22px tall, 6px dot plus a word, micro type.

Inputs: text, numeric (JetBrains Mono), multiline reason with a character count, PIN
entry (6 individual boxes at 56px), search with a leading icon, select, stepper.
States default, focus, filled, error, disabled.

Connection chip in its three states with the exact copy from the content guide.

Annotate every colour with its token name, never a hex value, and note the measured
contrast ratio beside each text-on-surface pair.

Include one frame that deliberately violates the one-pane rule (a card inside a card
inside a panel) alongside the correct version, labelled, so the rule is visible rather
than described.
```

### S3, printed output

```
Design the three printed documents for Bliss at 80mm, rendered as they will actually
print in monochrome thermal.

1. Seat bill. Header "Cool Bliss Spot", tab number, table, seat number and label,
   waiter, date and time. Lines. Total. Tender and change. Footer "Asante".
2. Whole tab bill. Same header, but every line carries its seat number in a leading
   column, and the Shared group is last. Seat subtotals shown.
3. Even split bill. States plainly "Even split, 1 of 3" beneath the header, so nobody
   argues about whose beer was whose.
4. Bar ticket. Large, sparse, no prices. Seat numbers leading every line, modifiers in
   caps beside them, a RAN OUT flag on one line, fired timestamp at the foot.

Constraints: monospace throughout for alignment, 42 characters per line, no greyscale
fills because thermal printers render them as mud, no logo below 200x200.

Show each at actual print size and again at 2x for review. Annotate how a seat number
survives a monochrome print where the seat colour cannot: the number is always there,
which is why the chip carries it.
```
