# Floor tabs revamp: foundation, specification and execution plan

Status: ready to build. Baseline: Frank's "Floor Tabs Revamp" plan, reviewed line by line, kept where right, corrected where it would not render, would fail accessibility or would break a doc rule. The visual benchmark is the entry and sign-in revamp; the system behind it is [12-surface-language.md](12-surface-language.md).

Scope: the Floor shell, the tab list, the tab and free-table cards, the tab screen header, the tables rail, and every sheet and dialog reached from them. The item grid and ticket rail follow in the next pass; they already consume the same foundation.

---

## 1. The idea in one paragraph

The sign-in screen is the Floor *at rest*: glass, light, a photograph. The tab list is the Floor *at work*: a waiter reads it in a dim room with a tray in one hand. So the tabs pages take the revamp's **language**: its type, its mono capitals, its spacing rhythm, its quiet affordances, its press feel. They do not take its **atmosphere**: no blur, no photography, no shadow in the dark. The result should feel like the same product and the same designer, working rather than posing. Frank's instinct here ("no glassmorphism on working surfaces, spatial rhythm is the atmosphere") is right and is kept.

## 2. Review of the baseline plan

### Kept

- The seven-layer scope and the order of it.
- The tab card as the hero object, with a defined reading order: table, time, seats, state, total.
- The eyebrow style for section labels ("Free tables", "My tabs").
- Mine-tab emphasis by edge colour, a 16px card gap, destructive actions separated by 16px.
- Staying flat: no gradients, no glass, no coloured shadows on working surfaces.
- The open questions, each answered in section 9.

### Corrected

| Baseline said | Problem | Now |
|---|---|---|
| `pt-28`, `py-14`, `tracking-tight`, `tracking-widest` | The theme resets Tailwind's defaults; these compile to nothing (see 12, section 6) | Scale values only; tracking comes from type tokens |
| `text-label eyebrow` | Two utilities setting the same font size; whichever sorts later wins | `<Eyebrow>` or `eyebrow` alone |
| `h-[148px]` | A fixed height clips at 200% text size and with long walk-up names | `min-h-card-tab` (148px token) |
| Elapsed in `text-ink-disabled` | 2.71:1 on the page, fails AA for meaningful text | `text-ink-subtle` (6.63:1); `text-low` past four hours, with the reason in words |
| "Current" label in `text-ink-disabled` | Same failure | `text-ink-subtle` |
| `hover:bg-raised/60` on a raised card | Raised at 60% over the page is *darker*: it reads as pressed, not hovered | Border step on hover, via `surface-pane-interactive` |
| Mine shown by a 6px dot | A state by colour alone, and on a card that already has an edge | Edge `border-accent-subtle` plus hidden text "your tab" |
| `rule-fade-y` between zones and tabs in the rail | Wrong axis for a vertical list | A plain `border-rule` between groups, as the rail has now |
| Nav brand `ring-1` hover | Tablets do not hover; the ring would never show | No ring; the mark stays quiet |
| Initials with `tracking-widest` in the nav | Dead class, and inconsistent with sign-in | `<Avatar size="sm">` with the same photo as sign-in |
| Selected modifier as `bg-accent-subtle/15` | Weaker than today's filled accent, in a dim room | Keep the filled accent **and** add a check icon, so selection is not colour alone |
| Void quick chips get "selected" fill | Quick chips populate the field; they are not a selection | Unchanged behaviour, restyled only |
| NoteSheet as "multiline TextField" | TextField is single line | `TextArea` with a counter |
| `tabcard.enter` staggered 24ms over 8 cards, ~312ms | Floor ceiling is 140ms for the whole animation, and the budget lint fails it | `list.enter`: whole group inside 140ms, once per mount |
| `zone.switch` 80ms fade | docs/07: category switching is instant, "and instant is the feature"; a zone filter is the same action | No animation |
| Verification by `pnpm run build` | Breaks the running dev server | Section 8 |

## 3. The foundation, already built

All in `packages/ui`. Typecheck clean, token and style checks pass, UI tests pass.

### Tokens (`tokens.ts`, generated into `tokens.css`)

| Token | Value | For |
|---|---|---|
| `size-card-tab` | 148 | Tab card and free-table card **minimum** height |
| `size-count` | 18 | Count badge height and minimum width |
| `size-nav-item` | 64 | Nav rail item and rail tab row |
| `accent-wash` | accent at 10% dark, 8% light | Selected row or choice tint, on the row itself |
| `stop-wash` | stop at 10% dark, 8% light | A row that could not be sent |
| `list.enter` | 140ms, ease out | Motion registry and docs/07 |

The type, depth and motion tokens from docs/12 apply here too: `eyebrow`, `caps`, `heading`, `--bliss-scale-press`.

### Utilities (`styles/base.css`)

| Utility | What it is |
|---|---|
| `surface-pane-interactive` | Raised pane, `rule` edge, radius md, border step on hover (pointer devices only), 0.985 press at 100ms |
| `surface-invite` | Dashed hairline, no fill, faint fill on hover, same press |

### Components

| Import | Component | Contract |
|---|---|---|
| `@bliss/ui/components/working` | `PaneButton`, `PaneLink` | `emphasis` default, mine or attention; `selected` adds `accent-wash` and an accent edge and sets `aria-pressed` |
| | `InviteButton` | The dashed invitation |
| | `CountBadge` | Filled count, capped at 99+, tone accent, stop or neutral. Decorative unless given `label` |
| | `MetaLine` | Facts separated by decorative middle dots, figures in mono |
| | `SeatChipStack` | Chips with a "+N" overflow and one accessible name: "4 seats, 1 settled" |
| | `SectionHeader` | Eyebrow `h2`, count, optional action |
| `@bliss/ui/components/elapsed` | `Elapsed` | Mono duration on its own 30s tick; `warnAfterMs` turns it Low and says why; hydration safe |
| `@bliss/ui/components/atmosphere` | `Avatar size="sm"` | 48px, the Floor touch target |
| `@bliss/ui/motion/floor-hooks` | `useListEnter(ref, ready)` | `list.enter` once, before paint, on `[data-list-item]` children. Floor only, so the Console never loads Flip |
| `@bliss/ui/components/overlay` | `Overlay` / `Sheet` / `FloorDialog` | New `eyebrow`, `leading` and `footer` props. A hairline shows under the header or above the footer only when content scrolls beneath it |
| | `OverlayActions` | Now sticky to the bottom of the scroll area, so an outcome button is never pushed off an 800px tablet. Existing sheets get this without changes |

## 4. Specification by layer

Target device: 10 inch landscape tablet, **1280 × 800**, dark. The main column is 1208px wide after the 72px rail. Every spec below is checked at that size, at 1024 × 768, and at 200% text.

### Layer 1: Shell (`floor/_components/shell.tsx`)

**Nav rail, 72px, flat on the page.**

- Items are `h-nav-item`, icon 24px, label in `text-label`.
- Active: the 3px accent edge stays, plus `bg-accent-wash` on the row itself, text `text-accent-text`. The wash is the row's only background; the badge inside is a mark, exempt like a seat chip.
- Counts use `<CountBadge>`, tone accent for Tabs and stop for Orders, anchored top right of the icon. Replaces the floating numeral.
- Waiter at the bottom: `<Avatar size="sm" src={staffPhoto(name)} name={name}>` inside the existing link. Tapping it opens Shift.
- Pressed states only (`active:`), no hover rings.

**Base layer, 72px.**

- `border-t border-rule-raised bg-sunken`.
- Left group, `gap-16`: name in `text-body font-medium`, `Elapsed` since sign-in with no warning, `ConnectionChip compact`.
- The unsent and rejected messages go in one `Signal` slot that truncates with the full sentence in `title`, so a long message cannot push the action off screen.
- Right slot `gap-12 px-16`.

**Robustness**

- The session guard renders `aria-busy` until the session resolves. Keep it.
- Nothing in the shell re-renders on a clock tick: only `Elapsed` does.
- Rejected sync is the stop tone, with words, never colour alone.

### Layer 2: Tab list (`(shell)/tabs/page.tsx`)

**Header**, `border-b border-rule-raised`, `px-24 pt-24 pb-16`:

```
TABS                                                   [ Mine 4 | Everyone 9 ]
3 open · KES 12,450 on the floor
[All zones 9] [Terrace 4] [Main bar 3] [Counter 2]
```

- Title: `text-title-lg`.
- The summary is a `MetaLine`, with the money item as `<Money decimals="whole">` in mono. With nothing open it reads "No tabs open", never "0 open · KES 0".
- Mine and Everyone: `Segmented size="lg"` with counts.
- Zones: `FilterChips size="lg"` with counts, scrolling horizontally. The selected chip scrolls into view when it changes. Filters are instant.
- When offline for more than five minutes, a third line: `Signal tone="info"` "Last updated 18:42. Showing what this tablet knows."

**Content**, `px-24 pt-24 pb-32`, one scroll container:

- **Open tabs.** `<section aria-labelledby>` with `SectionHeader title="Open tabs" count`.
  - Grid `grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-16`: four columns at 1280.
  - Wrapped with `useListEnter(ref, !loading)`, one `data-list-item` per card.
- **Order** is stable: zone order, then table label with numbers compared numerically, then walk-ups by open time. A card never jumps because its state changed; attention is shown on the card, not by position. (Today the list sorts by open time; the query changes.)
- **Free tables.** `mt-40`, `SectionHeader title="Free tables" count`, same grid.
- **Empty.**
  - No open tabs but free tables exist: no empty-state block. The header reads "No tabs open", and "Open tabs" shows one line: "Tap a free table to start one." The walk-up action stays in the base layer. This removes today's duplicated "Open tab" button.
  - No tables at all in the zone: `EmptyState` "Nothing in Terrace right now", with an action to show all zones.
- **Loading.** Eight `Skeleton` blocks at `min-h-card-tab rounded-md`, same grid, shown only while `useOpenTabs` is undefined.
- **Scroll position** is restored when returning from a tab (sessionStorage keyed by scope and zone), per docs/07.

**Robustness**

- The query reads lines for open tabs only (`where('tabId').anyOf(openIds)`), grouped once, instead of filtering every line in the database for every tab. The local lines table grows all night.
- Add `rejectedCount` per tab to `TabListItem`, from the dead letters the device holds.
- One `tableLabel()` in `floor/_lib`. Today the query builds "Counter 1" differently from the sheet's `tableLabel`.
- The page no longer holds a 30s clock; each card's `Elapsed` does.

### Layer 3: Cards (`packages/ui/components/floor/tab-card.tsx`)

**TabCard** composes `PaneButton`, `p-16 min-h-card-tab flex flex-col gap-12`.

```
Table 4                                            1h12
[1][2][3][4]                       (or the tab name for one guest)
──────────────────────────────────────────────── rule
● 2 not yet sent                                12,450
```

| Part | Spec |
|---|---|
| Label | `text-title font-medium text-ink truncate`, full label in `title` |
| Time | `<Elapsed since={openedAt} warnAfterMs={4h}>` |
| Seats | `<SeatChipStack max={6} size="tile">` when `showSeats`; otherwise the tab name in `text-body text-ink-muted`, or nothing. Never "One seat" |
| Rule | `h-px bg-rule` inside the card: a single-side hairline, allowed |
| State | One `Signal`, by priority: could not send (stop), ran out (stop), not yet sent (info), seats settled (poured). Otherwise the waiter's name when viewing Everyone, and nothing when Mine |
| Total | `<Money size="num-lg" decimals="whole" currency={false} tone={mine ? 'money' : 'default'}>`, right aligned, `shrink-0` |
| Emphasis | `emphasis="mine"` for the waiter's own tabs, `attention` when anything could not be sent |

**Accessibility.** The button's name is built, not scraped: "Table 4, your tab, 4 seats, open 1 hour 12, KES 12,450, 2 lines not yet sent". Children are `aria-hidden` where the name already covers them. Long press (450ms) opens a tab menu (move, hand over) with an equivalent route in the tab screen's overflow menu.

**Performance.** `memo` with a props comparison on id, total, counts and seats length. Totals are Cents, so compare with `===`.

**FreeTableCard** composes `InviteButton`, same size:

```
Table 7                                          4 SEATS
+ Open tab
```

- Label `text-title text-ink-muted`.
- Capacity as `Eyebrow size="caps"` top right.
- `IconPlus` 16px, `aria-hidden`, then "Open tab" in `text-body-sm text-accent-text` at the bottom.
- Name: "Open a tab on Table 7, 4 seats". A table out of service is not shown.

**Stress cases**, all to pass visually:

- "Birthday for Wanjiku's team", 40 characters.
- A total of KES 1,245,000.
- Eight seats with three settled.
- Every state at once.
- 200% text.

### Layer 4: Tab screen header (`tabs/[tabId]/page.tsx`)

- `px-24 py-12`, `border-b border-rule`.
- Title in `text-title font-medium`.
- `MetaLine` items: tab number, zone, `Elapsed` since open (mono), waiter when not the viewer, tab name.
- `OverflowMenu size="lg"`, unchanged items.
- Notices keep `InlineNotice`. The blocked-tab notice uses `stop-wash` on the notice row, not a box.

### Layer 5: Tables rail (`_parts/tables-rail.tsx`)

- Zones: `h-row-floor`, active edge plus `bg-accent-wash`, count in mono, filter instant.
- "My tabs": `SectionHeader` in the rail's padding.
- Tab rows sit directly on the rail as plain links, not cards: `min-h-nav-item px-16`, label `text-body font-medium`, total `Money num-sm decimals whole`, `SeatChipStack max={8} size="tile"`. The current tab is marked by `aria-current`, accent edge and `bg-accent-wash`.
- The rail footer's "Open tab" stays a link, `h-row-floor`.

### Layer 6: Sheets and dialogs (`_parts/sheets.tsx`)

**Shared for every sheet:**

- Context goes in `eyebrow` ("Table 4 · Seat 2"), the object in `title`, the seat chip in `leading`.
- Outcome buttons stay in `OverlayActions`, now sticky.
- The cancel label says what staying means ("Keep it", "Keep it here").
- Destructive actions sit 16px apart and are never default focus.

| Sheet | Spec |
|---|---|
| **ModifierSheet** | `eyebrow` the seat phrase. Each group a `fieldset` whose legend is `Eyebrow`, with "choose one" or "choose up to 2" in `caps`. Options stay 48px, filled accent when chosen **plus** a leading `IconCheck`. Price deltas in mono. A required group left empty disables Add, with the reason inline. The Add button carries the live line total. |
| **FinishedSheet** | `StatusChip` then the sentence. One action, "Back to the menu". |
| **SeatMenuSheet** | `leading` seat chip, `eyebrow` the tab, title "Seat 2", seat total in `description` as mono money. `ActionList` unchanged; its destructive group already separates by 16px. |
| **LabelSeatSheet** | `leading` chip. `TextField` with counter and helper "Only you and the bar see this". Enter submits. |
| **LineSheet** | `eyebrow` the seat, title "2 × Tusker", description the line total. For drafts, the quantity stepper row. Void shows the hint "Needs a supervisor" when poured. |
| **MoveLineSheet** | Picker chips at `picker` size in a 64px column, the current one at 40% with "Current" in `text-ink-subtle`. Flip on move is unchanged. |
| **NoteSheet** | `TextArea`, 140 character counter, helper "The bar sees this on the ticket". |
| **VoidDialog** | Title names object and seat; description names amount and tab. `ReasonForm focus="chip"`. When poured, the approver's `PinPad` follows the field, and the sticky actions keep "Void the line" reachable at 800px. Failure copy comes from the service. |
| **MoveTabSheet** | Free tables grouped by zone under `Eyebrow`. `InviteButton` tiles `min-h-[72px]` with label and capacity. When the table has fewer seats than the tab has guests, the tile says so in `caps` tone low ("2 seats, 4 guests"), and moving still works. |

### Layer 7: Open tab sheet (`_components/open-tab-sheet.tsx`)

- `eyebrow` zone, title "Open a tab on Table 4" or "Open a walk up tab".
- `Stepper size="xl"`; the figure is already `text-num-xl` mono.
- The preview is `SeatChipStack max={10} size="row"` inside the existing `aria-live`.
- Helper `text-body text-ink-muted`.
- Name: `TextField`, 40 characters, placeholder "Birthday, Kevin's table".
- Errors: `role="alert"`, `text-stop`, from the mutation.
- Actions: "Not now" (ghost) and "Open tab · 4 seats" (primary xl).
- Guests default to the table's seats, clamped 1 to 20.
- Opening while offline works and says nothing extra: the tab is local first.

## 5. Motion

| Name | Where | Spec |
|---|---|---|
| `list.enter` | Tab list, and later the orders list | Whole group inside 140ms, stagger up to 16ms, `y 8 → 0` and fade, capped at 8. Once per mount. |
| `sheet.enter` / `sheet.exit` | All sheets | Unchanged, 140ms and 100ms |
| Press | Cards, tiles, keys | CSS on the press token, 100ms; never GSAP, never waiting for data |

Nothing else animates on these pages: filters, sync updates, card state changes and totals on the list are instant. Reduced motion and the battery guard apply through the engine.

## 6. Robustness checklist

Every item is an acceptance criterion; a PR does not merge with one open.

- **States.** Each list and sheet has loading, empty because nothing happened, empty because filters exclude everything, offline, and rejected. No blank screen, no spinner under 100ms.
- **Local first.** Every action renders locally before any network call. No button waits on the server except approval PINs.
- **Hydration.** No clock or elapsed value rendered without `useHydrated` or `suppressHydrationWarning`. The console shows no hydration warning on any route.
- **Text.** Nothing clips at 200% text or with a 40 character name; truncation always has a `title` or a full accessible name.
- **Numbers.** Money is `Money` or `formatKes` only, `decimals="whole"` on cards, no raw bigint arithmetic in components.
- **Touch.** Every target at least 48px on Floor with 8px between; nothing relies on hover.
- **Keyboard and reader.** Every card, chip and sheet is reachable in visual order. Sheets trap focus, Escape closes, focus returns to the trigger. Every icon-only control is labelled. Live regions are polite.
- **Colour.** No state by colour alone: a dot plus a word, an edge plus hidden text.
- **Performance.**
  - Cards memoised.
  - One clock per `Elapsed`, not one per page.
  - Queries scoped to open tabs.
  - No `will-change` left on elements.
  - The Floor bundle does not import Console motion.
- **Classes.** No Tailwind default-theme utility (section 10). No arbitrary value where a token exists.
- **Copy.** docs/08: sentence case in source, no exclamation marks, verbs naming outcomes, capitals only through `eyebrow` and `caps`.

## 7. Execution plan

Each step is a reviewable slice with its own checks. Order matters: later steps compose earlier ones.

| Step | Slice | Owner | Depends on | Done when |
|---|---|---|---|---|
| 0 | Foundation (section 3) | Done | | Typecheck, token check, style check, UI tests all pass |
| 1 | Data: scoped tab query, stable ordering, `rejectedCount`, shared `tableLabel`, scroll restoration helper | Fullstack | 0 | Unit test for ordering and counts; no visual change |
| 2 | Cards: `TabCard`, `FreeTableCard` on `PaneButton` and `InviteButton`, memo, accessible names | Frank, reviewed | 0, 1 | The five stress cases render at 1280 × 800 and at 200% text |
| 3 | Tab list page: header, sections, empty and offline states, `useListEnter` | Frank | 2 | Every state reachable; no hydration warning; filter instant |
| 4 | Shell: nav wash, `CountBadge`, `Avatar`, base layer message slot | Frank | 0 | Long rejected message does not move the action |
| 5 | Open tab sheet | Frank | 0 | Offline open works; errors announced |
| 6 | Tab screen header and tables rail | Frank | 1, 4 | Current tab marked three ways; rail scrolls independently |
| 7 | Sheets and dialogs | Frank, reviewed | 0 | Poured void with PIN fully usable at 1280 × 800 |
| 8 | Review pass | Fullstack and design | 2–7 | Checklist in section 6 green; docs/08 copy review |

Steps 2, 4 and 5 can run in parallel. Step 1 lands before 2 so the card is built against the final data shape.

## 8. Verification while the dev server runs

Never `next build` while Frank's dev server is running.

```bash
pnpm typecheck
pnpm tokens:check
node scripts/check-styles.mjs
pnpm vitest run packages modules
npx eslint "app/(floor)" packages/ui --cache
```

- Run ESLint on the changed paths only: the whole-repo type-aware run exhausts memory on this machine.
- **Visual check** at 1280 × 800 and 1024 × 768, signed in as Amina (dev PIN 111111):
  1. Empty list.
  2. A busy list.
  3. Offline, with the network off in devtools.
  4. A rejected change.
  5. Every sheet.
  6. 200% zoom.
  7. Reduced motion.

## 9. Decisions on the baseline's open questions

1. **Tab card total at `num-lg`.** Yes, with `decimals="whole"` and no currency prefix. At 24px mono, "1,245,000" fits a 240px card beside a truncating state line. The total is what the waiter looks for.
2. **Free table "+ Open tab".** Yes. The icon is `aria-hidden` phrasing content inside the button, with no box of its own, so it does not nest a surface. The whole card stays the target.
3. **Nav active wash.** Yes, as `bg-accent-wash` on the row. The rail has no background, so the row is the only surface; the count badge inside is a mark, exempt like seat chips. This reading goes into docs/06 section 1 as a clarification.

Still needed from you:

- **Floor sign-in roles.** Waiters only, or supervisors too? This affects the shell's Orders badge and approvals.
- **Long-press tab menu** on cards (move, hand over), or keep those only inside the tab screen? This plan assumes both, with the tab screen route as the required equivalent.

## 10. Classes that compile to nothing here

The theme resets these namespaces. Do not use them; use the token on the right.

| Avoid | Use |
|---|---|
| `shadow-sm/md/lg/xl/2xl/inner`, `drop-shadow-*` | `shadow-raised`, `shadow-lift`, `shadow-key` |
| `blur-*`, `backdrop-blur-*` | `backdrop-blur-glass`, `backdrop-blur-veil` (atmosphere only) |
| `tracking-*`, `leading-*` | The type token (`text-title`, `eyebrow`, `caps`); an arbitrary `leading-[x]` only for one-off display |
| `animate-pulse/spin/ping` | `animate-breathe`, `spin` |
| `font-normal`, `font-semibold`, `font-bold` | `font-medium` or nothing |
| `text-xs/sm/base/lg/xl` | `text-body-sm`, `text-body`, `text-title` … |
| Spacing outside 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 56, 72, 96 (e.g. `p-10`, `mt-28`, `gap-14`, `translate-x-1`) | The nearest scale value, or a size token |
| `sm:`, `md:`, `lg:`, `xl:` | `tablet:`, `desktop:`, `wide:` |
| `rounded-sm/md/lg` still work; `rounded-xl/2xl/3xl` do not | `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-dot` |
