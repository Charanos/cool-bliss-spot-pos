# Design system, Bliss

Version 1.0
7 September 2026

---

## 1. The concept: one pane

Most point of sale interfaces are card soup. A panel inside a card inside a section inside a shell, each with its own border, its own shadow and its own background, until a waiter has to parse four nested rectangles to find a price.

Bliss has **one level of depth, everywhere.**

There is the pane, and there is what sits on it. Nothing is nested inside anything. Grouping is done with space and a single hairline, never with a box. Depth is expressed by a change of surface tone, once, and never by a shadow on a shadow.

This is enforceable, and it is enforced:

- No element with a background may contain another element with a background.
- No element with a border may contain another element with a border.
- There is exactly one elevation token. There is no elevation-2.
- A lint rule fails the build on a nested `bg-surface` or a nested `border` in the same subtree.

The result is an interface that reads in one pass, which is the only kind that survives a dim room and a moving tray.

### The Console's two families

The Console holds two kinds of content. Tables, forms and settings are the **Pane** family: flat on the page, exactly as above. Dashboards, grid views of records and a record's detail page are the **Card** family: one surface a step off the page, with an edge and, in light, the `card` shadow. A card is still one level: its header and footer are **bands** (a tint on a strip of the same card, under one rule), never a box inside it, and nothing inside a card is another card. Hover deepens the shadow a step and lifts the card 2px; it never adds a second level. The lint rule knows the difference. See `19-console-system.md` section 1 and `11-design-drift.md` D-14.

---

## 2. The signature element: the seat chip

The defining feature of Bliss is that a drink belongs to a person. The signature element is the object that carries that.

A **seat chip** is a 22px rounded square, radius 6, filled with the seat's colour, carrying the seat number in JetBrains Mono 500 at 11px in `frost-950`.

```
 ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌┄┄┄┄┐
 │ 1  │  │ 2  │  │ 3  │  │ 4  │  ┆ ·· ┆
 └────┘  └────┘  └────┘  └────┘  └┄┄┄┄┘
 glacier  ember   leaf    iris    shared
```

### Where it appears

| Surface | Use |
|---|---|
| Floor, seat selector strip | The primary control. Tap to change the seat a line attaches to. |
| Floor, ticket rail | Leading each line, and heading each seat group |
| Floor, tab list | A row of chips showing how many seats and which have spend |
| Bar ticket, printed or on screen | Beside every line, so the bartender knows who gets what |
| Counter, tab detail | Grouping the bill, and as the tap target for settle-one-seat |
| Printed bill | Beside every line, with the seat label if one was set |
| Console, reports | In per-seat analysis |

### Rules

1. **Colour never carries meaning alone.** The chip always contains its number. A colour-blind user, a greyscale thermal print and a cracked screen all still work.
2. **Colour is assigned by `seat_no modulo 8`**, from the fixed palette in section 4. It is never chosen by a user and never random, so Seat 2 is the same colour on every device and on the printed bill.
3. **The chip is 22px in dense contexts and 40px as a tap target** in the Floor seat selector. The proportions and the radius ratio are constant.
4. **Shared** is a dashed outline chip in `frost-300` with a two-dot glyph, never a ninth colour. Shared is a different kind of thing, not another guest.
5. **Selected state** is a 2px ring in `frost-0` on dark, `frost-950` on light, offset 2px. Not a size change, not a glow.
6. **A seat label, if set, sits next to the chip in `label` type**, truncated at 14 characters with the full value in the title attribute. The chip itself never contains text other than the number.
7. **A tab with one seat renders no chips at all.** The feature disappears when it is not useful.

---

## 3. Typography

One sans and one mono. No display serif, no third family. A minimal system earns its elegance from restraint and spacing, not from a typeface with opinions.

| Role | Family | Weights |
|---|---|---|
| Everything | **Geist Sans** | 400, 500 |
| Every number | **JetBrains Mono**, tabular figures always on | 400, 500 |

**Weights never exceed 500.** There is no bold in this product. Hierarchy comes from size, colour and space. A lint rule fails the build on any font weight above 500.

### Scale

| Token | Size / line height | Tracking | Use |
|---|---|---|---|
| `display` | 40 / 44 | -0.025em | Counter amount due, day close total |
| `title-lg` | 28 / 34 | -0.02em | Console page title |
| `title` | 20 / 26 | -0.015em | Section heading, sheet title |
| `subtitle` | 16 / 22 | -0.01em | Card group heading, seat group heading |
| `body-lg` | 17 / 24 | -0.005em | Floor tile label, Counter line item |
| `body` | 15 / 22 | 0 | Default |
| `body-sm` | 13 / 19 | 0 | Secondary, helper |
| `label` | 12 / 15 | 0.02em, weight 500 | Field labels, table headers |
| `micro` | 10 / 13 | 0.08em, weight 500, uppercase | Status chips only, never a sentence |
| `num-xl` | 40 / 44 | -0.04em | Amount due |
| `num-lg` | 24 / 30 | -0.02em | Tab total, seat total, report headline |
| `num` | 15 / 22 | -0.01em | Line prices, table cells |
| `num-sm` | 12 / 17 | 0 | Dense tables, tile stock counts |

Floor never renders text below 15px. The Console has its own ramp at 14px, a dense desktop tool with three heading levels (`title-page`, `title-section`, `title-card`) and body text in `ui`; only `label-caps` (11px capitals over a value), `num-sm` and status chips go below 13px. See `19-console-system.md` section 2 and D-15.

### Currency

`KES` in `label` type at `frost-500`, the figure in JetBrains Mono. Thousands separated by a comma. Negative values take a leading minus and the `stop` colour, never parentheses and never colour alone.

```
KES 12,450.00
```

---

## 4. Colour

Cool, clean, low chroma in the neutrals, with exactly two accents. The name of the venue is Cool Bliss Spot and the palette takes that literally: a cold neutral, an iced blue, and one warm counterpoint reserved for money and attention.

### Frost, the neutral ramp

A cool grey with a faint blue-green cast, so it never reads as either warm beige or corporate slate.

| Token | Hex | Use |
|---|---|---|
| `frost-0` | `#FBFCFD` | Console page |
| `frost-50` | `#F4F7F9` | Light raised surface, dark primary text |
| `frost-100` | `#E7ECF0` | Light hairline |
| `frost-200` | `#D4DCE3` | Light border, divider |
| `frost-300` | `#B3BFC9` | Dark secondary text, shared chip |
| `frost-400` | `#8C9AA6` | Dark label text, placeholder |
| `frost-500` | `#6B7884` | Non-text use only. Measures 4.4:1 on `frost-0`, so it never carries body copy. |
| `frost-600` | `#4E5A65` | Light muted text and labels, dark border |
| `frost-700` | `#38424B` | Dark raised surface |
| `frost-800` | `#232B32` | Dark surface |
| `frost-900` | `#151B20` | Light body text, dark sunken |
| `frost-950` | `#0B1015` | Dark page, and text on any accent fill |

### Glacier, the primary accent

| Token | Hex | Use |
|---|---|---|
| `glacier-200` | `#A8DCE6` | Dark subtle |
| `glacier-300` | `#6FC6D6` | Dark primary fill and accent text. 9.9:1 on `frost-950`. |
| `glacier-400` | `#3FAAC0` | Dark hover, seat colour 1 |
| `glacier-500` | `#2A8CA3` | Light hover |
| `glacier-600` | `#1F6E82` | Light primary fill and accent text. 5.66:1 on `frost-0`. |
| `glacier-700` | `#17545F` | Light pressed |

### Ember, the counterpoint

Reserved for money that needs looking at, and for attention states. Used sparingly enough that its appearance means something.

| Token | Hex | Use |
|---|---|---|
| `ember-300` | `#E9BE86` | Dark subtle |
| `ember-400` | `#E0A35A` | Dark attention, seat colour 2 |
| `ember-600` | `#97591A` | Light attention. 5.4:1 on `frost-0`. |

### Signals

| Signal | Meaning | Light | Dark |
|---|---|---|---|
| **Poured** | Served, confirmed, in tolerance | `#2E7D52` | `#63B98A` |
| **Low** | Running low, out of tolerance, needs attention | `#97591A` | `#E0A35A` |
| **Stop** | Voided, failed, finished, destructive | `#A33232` | `#E08585` |
| **Info** | Pending, queued, offline | `glacier-600` | `glacier-300` |

### Seat palette

Fixed, eight entries, assigned by `seat_no modulo 8`. Every one carries `frost-950` text and clears 4.5:1 against it. Identical on both themes, so a seat colour is the same object on a tablet, a bar screen and a printed bill.

| Index | Seat | Hex | Name |
|---|---|---|---|
| 0 | 1, 9, 17 | `#6FC6D6` | Glacier |
| 1 | 2, 10, 18 | `#E0A35A` | Ember |
| 2 | 3, 11, 19 | `#9DC271` | Leaf |
| 3 | 4, 12, 20 | `#B79BE0` | Iris |
| 4 | 5, 13, 21 | `#E58BA4` | Rose |
| 5 | 6, 14, 22 | `#7FA8E0` | Steel |
| 6 | 7, 15, 23 | `#D9C46B` | Brass |
| 7 | 8, 16, 24 | `#6FD2B4` | Jade |

Shared uses `frost-300` with a dashed outline and no fill.

### Theme by surface

| Surface | Theme | Why |
|---|---|---|
| Floor | Dark only | The room is dim. A white tablet at arm's length is a light source pointed at a customer's face. |
| Counter | Dark by default, light available | Same room, better lit, stationary operator |
| Bar view | Dark only, higher contrast, larger type | Read at two metres, in a hurry, sometimes with wet hands |
| Console | Light by default, dark available | Offices and daylight |

Both themes are first class. Every component is specified in both. Neither is a filter applied to the other.

### Contrast floor

4.5:1 for body text, 3:1 for large text and UI boundaries. Every pairing above was measured, not assumed, and the token file carries the measured ratio as a comment beside each pair. A new pairing is measured before it ships, and a CI test walks the token pairs.

---

## 5. Space, shape, elevation

### Space
4px base. Scale: `2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96`. Nothing in between.

### Radius
| Token | Value | Use |
|---|---|---|
| `r-sm` | 6px | Inputs, seat chips, status chips |
| `r-md` | 10px | Tiles, panes, rows, small buttons, menus |
| `r-control` | 12px | Buttons |
| `r-lg` / `r-card` | 16px | Sheets, Console cards |
| `r-overlay` | 20px | Console dialogs |
| `r-pill` | full | Count badges and segmented controls only |

No other pills, and no circles except dots and avatars. D-16.

### Elevation

**One level.** That is the entire elevation system.

| Theme | Surface | Raised |
|---|---|---|
| Dark | `frost-950` page | `frost-800` with a 1px `frost-700` hairline. No shadow, because shadows do not exist in the dark. |
| Light | `frost-0` page | `frost-50` with a 1px `frost-200` hairline, plus `0 1px 2px rgba(11,16,21,0.05)` |

Sheets and dialogs use the same raised treatment with a scrim at `rgba(11,16,21,0.55)`. They do not get a second, heavier shadow.

The Console's Card family has its own shadow, `card`, in light only (dark relies on the `edge`), and a hover step, `card-hover`. Menus and Console dialogs use `popover`. Each is a token; no shadow is written by hand.

---

## 6. Components

### 6.1 Button

Variants: `primary`, `secondary`, `ghost`, `destructive`, `tender` (Counter, oversized).

| Prop | Values | Default |
|---|---|---|
| `variant` | as above | `secondary` |
| `size` | `sm` 32, `md` 40, `lg` 48, `xl` 56 | `md` |
| `loading` | boolean, width locked before the swap | false |
| `icon` | Tabler component | |
| `iconOnly` | requires `aria-label` | false |

| State | Treatment |
|---|---|
| Hover | One step of the ramp, 160ms, pointer devices only |
| Focus | 2px ring in `glacier-400`, 2px offset. Never removed without a replacement in the same rule. |
| Active | One further step, `scale(0.985)`, 100ms |
| Loading | Label stays, spinner replaces the icon slot |
| Disabled | `frost-300` on light, `frost-600` on dark. `aria-disabled`, still focusable so a screen reader can find and explain it. |

Touch targets: 48×48 minimum on Floor, 44×44 on Counter, 8px minimum gap between adjacent targets. Destructive never sits within 16px of a primary.

### 6.2 Seat selector (Floor)

The most important control in the product.

- Horizontal strip pinned above the ticket rail, 56px tall, `frost-800`.
- 40px seat chips with 8px gaps, horizontally scrollable above six seats with native momentum.
- Order: seats ascending, then Shared, then a 40px `+` to add a seat.
- Selected: 2px `frost-0` ring at 2px offset, and the strip scrolls it into view.
- Long press on a chip opens: label this seat, settle this seat, remove this seat.
- Beneath each chip, the seat total in `num-sm`, updating with a 180ms count animation.
- On a one-seat tab the entire strip is absent, not disabled.

### 6.3 Product tile (Floor)

The most-tapped object in the system.

- Minimum 96×96, target 116×116, in a responsive grid at 12px gutters.
- Label in `body-lg`, wrapping to two lines then truncating with a title attribute.
- Price in `num` at `frost-300`, bottom left.
- Category colour as a 3px left edge, never a background wash.
- Availability states, from `availability_state`:

| State | Treatment |
|---|---|
| `available` | Normal |
| `low` | Remaining count top right in `num-sm`, `ember-400` |
| `last_few` | Remaining count in `ember-400` with a 1px `ember-400` top-right corner tick |
| `finished` | 40% opacity, one 1px diagonal hairline in `frost-600`, `FINISHED` micro chip on the label, not tappable, still focusable, announces "finished" |

- Press feedback within 100ms, always. The tap adds the line locally and optimistically. The network is never in the interaction path.
- Long press opens the modifier sheet rather than adding immediately.

### 6.4 Ticket rail (Floor and Counter)

- Lines grouped by seat, each group headed by its chip, the seat label if set, and the seat subtotal right aligned.
- Shared lines form the last group.
- Within a group: qty, name, price right aligned on a shared decimal column.
- A served line reads as settled: reduced contrast, a small Poured dot, no longer editable.
- An unsynced line carries an Info dot, and the base layer shows a persistent count, `3 not yet sent`. Persistent indicator, never a toast.
- A `stock_conflict` line carries a Stop dot and the micro chip `RAN OUT`, with the void action prefilled.
- Swipe left reveals void, move seat, and note, with a visible chevron affordance. Every gesture has a keyboard and overflow-menu equivalent. Gesture is never the only route.
- Base layer pinned at the bottom: selected seat total, tab total, and the primary action. It never scrolls away.

### 6.5 Tender panel (Counter)

- Fixed 420px right panel. Never a modal. The bill stays visible while money is taken.
- Amount due in `num-xl`, the largest number anywhere in the product.
- Scope selector above it: `Whole tab` / `This seat` / `Even split`, as a segmented control. Selecting a seat in the bill selects `This seat`.
- Tender buttons at 56px: Cash, M-Pesa, Card, Split.
- M-Pesa and Card open a reference field, not a payment flow. The label reads `Reference (optional)` and the helper reads `Bliss records this. It does not check it.` Honest, and it stops a cashier believing the system verified anything.
- Numeric keypad with 72px keys, three columns, hard-wired clear.
- Change due in `num-xl` in Poured, staying until dismissed by an explicit action, never on a timer.

### 6.6 Data table (Console)

- Header row in `label` at `frost-600`, sticky.
- Numeric columns right aligned, JetBrains Mono, tabular figures, decimals aligned.
- No zebra striping. Row separation is a 1px `frost-100` rule.
- Row height 44px comfortable, 36px compact, persisted per table.
- Sort, filter and column visibility all in the URL query string. Any table state is a shareable link.
- Virtualised above 50 rows.
- Four distinct states: loading skeleton matching the final layout, empty because nothing has happened, empty because filters exclude everything, and error. Never one generic blank.

### 6.7 Reason dialog

One component for every void, discount, write-off, hold, override and adjustment.

```
TITLE        Void 2 × Tusker from Seat 2?
BODY         This removes KES 700.00 from tab 14. It cannot be undone.
QUICK        [Wrong item] [Customer changed mind] [Ran out]
FIELD        Reason (at least 10 characters)
ACTIONS      [ Keep it ]            [ Void the line ]
```

- The title names the object and the seat. A void is always attributable to a guest.
- Quick chips populate the field rather than replacing it. Chips alone are never accepted as a reason.
- Where approval is needed, the approver enters their own PIN inside the dialog. There is no shared supervisor password in this product.
- Escape and the back gesture both cancel. The destructive action is never the default focus.

### 6.8 Status chip

`micro` type, `r-sm`, 22px tall, 8px horizontal padding, a 6px dot plus a word, on a wash of its own tone. Colour, dot and word together, so it survives greyscale. D-17.

`Open` `Fired` `Poured` `Settled` `Voided` `Low` `Last few` `Finished` `On hold` `Ran out` `Offline` `Synced`

### 6.9 Connection state

Persistent chip in the base layer of Floor and Counter. Three states. Never a toast, never a modal, never a red banner.

| State | Appearance | Copy |
|---|---|---|
| Synced | Poured dot, no text on Floor | `Synced` |
| Offline, queued | Info dot plus count | `Offline. 4 orders held.` |
| Cannot reach anything | Low dot | `No connection. Orders are saved on this device.` |

Offline is a normal operating mode at this venue and the interface treats it as one.

---

## 7. Surface layouts

### 7.1 Floor, 10 inch tablet, landscape, dark

```
┌──────────────┬─────────────────────────────┬───────────────────┐
│ TABLES 180px │        ITEM GRID            │  TICKET RAIL 340  │
│              │                             │                   │
│ Terrace      │ [Beer][Spirits][Wine][Soft] │ ┌───────────────┐ │
│ Main bar     │                             │ │[1][2][3][4][··]│ │  ← seat
│ Counter      │ ┌────┐┌────┐┌────┐┌────┐    │ │ 700 500 650 0 │ │    selector
│              │ │Tile││Tile││Tile││Tile│    │ └───────────────┘ │
│ MY TABS      │ └────┘└────┘└────┘└────┘    │                   │
│ T7 [1][2][3] │ ┌────┐┌────┐┌────┐┌────┐    │ [2] Kofi    500   │
│    4,200     │ │Tile││ 3  ││Tile││ ⨯  │    │  1 Gilbeys  500   │
│ T2 [1][2]    │ └────┘└────┘└────┘└────┘    │                   │
│    1,150     │       last few    finished  │ [1]         700   │
│              │                             │  2 Tusker   700   │
│              │                             │                   │
│              │                             │ [··] Shared 900   │
│              │                             │  1 Nyama    900   │
├──────────────┴─────────────────────────────┼───────────────────┤
│ Amina · 4h12 · ● Synced                    │ Seat 2    KES 500 │
│                                            │ Tab     KES 2,750 │
│                                            │ [   FIRE ORDER  ] │
└────────────────────────────────────────────┴───────────────────┘
```

Three taps to a fired order: table, tile, fire. Four if the seat changes. Every proposed change is measured against that.

### 7.2 Counter, 15.6 inch touch, dark

```
┌────────────────────────────────────────┬─────────────────────┐
│ [ Tabs ] [ Quick sale ]                │    TENDER 420px     │
│                                        │                     │
│ ┌──────┐ ┌──────┐ ┌──────┐             │ Whole tab | Seat |  │
│ │ T7   │ │ T2   │ │ T9   │             │       Even split    │
│ │[1][2]│ │[1][2]│ │[1]   │             │                     │
│ │[3][4]│ │      │ │      │             │ AMOUNT DUE          │
│ │ 4,200│ │ 1,150│ │   850│             │ KES 4,200.00        │
│ └──────┘ └──────┘ └──────┘             │                     │
│                                        │ [Cash]    [M-Pesa]  │
│ TAB 7                                  │ [Card]    [Split]   │
│ [1] 2 Tusker            700            │                     │
│ [2] Kofi  1 Gilbeys     500            │  7   8   9          │
│ [3] 1 Smirnoff+Coke     650            │  4   5   6          │
│ [4] 1 Tusker Lite       380            │  1   2   3          │
│ [··] 1 Nyama plate      900            │  0  00   ⌫          │
├────────────────────────────────────────┼─────────────────────┤
│ Kevin · Drawer KES 18,400 · ● Synced   │ [ Settle KES 4,200 ]│
└────────────────────────────────────────┴─────────────────────┘
```

Tapping a seat chip in the bill switches the tender scope to that seat. One tap from "she's leaving" to her bill.

### 7.3 Bar view, second screen, dark, high contrast

```
┌─────────────────────────────────────────────────────────────┐
│ TAB 14 · T7 · Amina · 22:41                        2 min ago│
│                                                             │
│  [1]  2 × Tusker 500ml                                      │
│  [2]  1 × Gilbeys double          NO ICE                    │
│  [3]  1 × Smirnoff + Coke                                   │
│  [4]  1 × Tusker Lite                            ⚠ RAN OUT  │
│                                                             │
│                                          [ Mark all poured ]│
└─────────────────────────────────────────────────────────────┘
```

Type one step larger than anywhere else, no prices, seat chips leading every line. Tapping a line marks it poured and it fades to 40% in place.

### 7.4 Console, browser, light

```
┌────────────┬─────────────────────────────────────────────────┐
│ RAIL 220   │  Inventory                                      │
│            │  Stock · Counts · Movements · Recipes · Holds    │
│ Overview   │  ───────────────────────────────────────────────│
│ Trade      │  Filters                            [Export CSV]│
│ Inventory ●│                                                 │
│ Purchasing │  Product        On hand  Value   State  Variance│
│ Catalogue  │  Tusker 500      142     28,400  ●      -1.2%   │
│ Pricing    │  Gilbeys 750      18     21,600  ▲ low  -6.4%   │
│ People     │  Smirnoff 750      0          0  ⨯ fin   ··     │
│ Reports    │                                                 │
│ Settings   │                                                 │
├────────────┴─────────────────────────────────────────────────┤
│ Cool Bliss Spot · Business date 6 Sep 2026 · 4 devices online│
└──────────────────────────────────────────────────────────────┘
```

Every tab is a route. Every filter is in the query string.

The current shell (a venue-first rail with four groups, breadcrumbs, a command menu and underline tabs) is drawn and specified in `19-console-system.md` section 4.

---

## 8. Accessibility

WCAG 2.1 AA is the floor.

| Area | Requirement |
|---|---|
| Contrast | 4.5:1 body, 3:1 large text and UI boundaries. Measured, documented in the token file, tested in CI. |
| Focus | Always visible, 2px `glacier-400` at 2px offset. `outline: none` without a replacement in the same rule fails lint. |
| Keyboard | Full operation of Counter and Console without a mouse. Tab order follows visual order. Every Floor gesture has a keyboard and menu equivalent. |
| Touch | 48×48 minimum on Floor, 44×44 on Counter, 8px separation |
| Colour independence | No state by colour alone. Seat chips carry numbers. Availability carries a chip and an opacity change. Every signal carries a dot or a word. |
| Motion | `prefers-reduced-motion` honoured throughout. See `07-motion-and-interaction.md`. |
| Text scaling | Layout survives 200% browser zoom and Android font scaling to Large without truncation or horizontal scroll |
| Screen reader | Every icon-only control labelled. Live regions for connection state and availability changes, `polite` rather than `assertive`, because a cashier does not need interrupting mid-count. |
| Escape routes | Every dialog, sheet and multi-step flow has a visible cancel plus Escape plus back gesture |

---

## 9. Token file shape

Tokens are the only source of colour, size, radius and duration. A raw hex in a component is a build failure.

```ts
export const tokens = {
  colour: {
    frost: { 0:'#FBFCFD', 50:'#F4F7F9', 100:'#E7ECF0', 200:'#D4DCE3',
             300:'#B3BFC9', 400:'#8C9AA6', 500:'#6B7884', 600:'#4E5A65',
             700:'#38424B', 800:'#232B32', 900:'#151B20', 950:'#0B1015' },
    glacier: { 200:'#A8DCE6', 300:'#6FC6D6', 400:'#3FAAC0',
               500:'#2A8CA3', 600:'#1F6E82', 700:'#17545F' },
    ember:   { 300:'#E9BE86', 400:'#E0A35A', 600:'#97591A' },
    signal: {
      poured: { light:'#2E7D52', dark:'#63B98A' },   // 4.91 / 8.1
      low:    { light:'#97591A', dark:'#E0A35A' },   // 5.40 / 7.6
      stop:   { light:'#A33232', dark:'#E08585' },   // 6.60 / 6.9
      info:   { light:'#1F6E82', dark:'#6FC6D6' },   // 5.66 / 9.9
    },
    seat: ['#6FC6D6','#E0A35A','#9DC271','#B79BE0',
           '#E58BA4','#7FA8E0','#D9C46B','#6FD2B4'],
    seatText: '#0B1015',
    shared: '#B3BFC9',
  },
  radius: { sm:6, md:10, control:12, lg:16, card:16, overlay:20, pill:9999 },
  space: [2,4,6,8,12,16,20,24,32,40,56,72,96],
  weight: { regular:400, medium:500 },  // there is no third entry, deliberately
  elevation: { one: true },             // there is no level two, deliberately
} as const;
```

---

## 10. What this design system refuses

Written down so it does not drift in month four.

- No nested containers. One level of depth, everywhere.
- No second elevation level.
- No font weight above 500.
- No emoji in any interface string.
- No glassmorphism, no neumorphism, no gradients, no coloured shadows. (The atmosphere layer's glass, docs/12, is the one exception, and it never reaches a Console page.)
- No arbitrary values: a size, colour, radius or shadow typed in brackets is refused in Console code.
- No decorative animation. Motion carries meaning or it does not exist.
- No modal that hides the number the user is acting on.
- No `OK` and `Cancel`. Buttons say what they do.
- No red banner for being offline.
- No state signalled by colour alone.
- No ninth seat colour. Shared is not a guest.
- No raw hex outside the token file.
- No smooth scrolling on a touch surface. See ADR-014.
