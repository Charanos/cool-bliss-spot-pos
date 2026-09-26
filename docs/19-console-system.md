# Console system, Bliss

Version 1.0
26 September 2026

The Console's working reference: the two surface families, the type ramp, the tokens and primitives
every page is built from, the shell, the copy rules, and the definition of done for a page. Read it
with `06-design-system.md` (the product-wide system) and `08-ux-copy.md` (the voice). The plan that
produced it is `18-console-plan.md`.

---

## 1. Two families, one level of depth

The Console is one pane deep, like the rest of Bliss, but it holds two kinds of content, and they
look different on purpose.

| Family | For | Looks like |
|---|---|---|
| **Pane** | Tables, forms, settings, lists: anything a person reads row by row | Flat on the page. Grouping by space and one hairline. A table sits on one card surface of its own with a header band. |
| **Card** | Dashboards, grid views of records, a record's detail page | A surface one step off the page (`card`), an edge (`edge`), the `card` shadow in light (none in dark, where the edge carries it). Bands head and foot it. |

Rules that hold in both:

- **A card never sits inside a card.** Its header and footer are **bands**: a tint on a strip of the
  same card (`card-band`, `card-band-strong`), separated by one rule. `bliss/one-pane` fails the
  build on a surface inside a surface, a box border inside a box border, or a ring used as a border.
- **One elevation.** Hover deepens the card's shadow a step and lifts it 2px (`card-interactive`);
  it never adds a second level. Menus and dialogs use `popover`.
- **A card that leads somewhere is one link.** Its title is a stretched link (`link-stretched`), so
  the card is a single tab stop and opens in a new tab on middle click; buttons inside sit above it
  (`z-raised`). Never an `onClick` on a `div`.

## 2. Type

One sans (Geist) and one mono (JetBrains Mono), weights 400 and 500 only. The Console reads at 14px:
it is a dense desktop tool. It has exactly three heading levels.

| Role | Token | Spec | Use |
|---|---|---|---|
| Page title | `text-title-page` | 26/32, -0.022em, 500 | the one `h1` |
| Section | `text-title-section` | 17/24, -0.012em, 500 | a section, a dialog title (`h2`) |
| Card title | `text-title-card` | 15/20, -0.006em, 500 | a card or panel (`h3`) |
| Body | `text-ui` | 14/20, 400 | default Console text |
| Small | `text-body-sm` | 13/19, 400 | secondary lines, meta, help |
| Label | `text-label` | 12/15, +0.02em, 500 | table headers, field labels |
| Capitals | `label-caps` | 11/14, +0.06em, 500, uppercase | a label over a value, rail groups. Never a sentence. |
| KPI | `text-num-kpi` + `font-mono` | 30/36, -0.03em, 500 | a metric's figure |
| Figure | `text-num-md`, `text-num-sm` + `font-mono` | 14/20, 12/17 | table and inline numbers |

- Every number is mono with tabular figures. `KES` is set small and subtle before the figure; a
  negative amount takes a leading minus and the stop colour. `<Money>` does all of this.
- Text hierarchy is **three ink roles**: `ink`, `ink-muted`, `ink-subtle`. No opacity on text:
  `bliss/no-arbitrary-design-values` refuses `text-ink-*/NN`.
- A description stops at about 68 characters (`measure`); titles balance, paragraphs wrap pretty.
- Only `label-caps`, `text-num-sm` and the status chip go below 13px.

## 3. Tokens and primitives

Everything comes from `packages/ui/src/tokens/tokens.ts` (run `pnpm tokens:build`). A value in
brackets (`text-[13px]`, `shadow-[...]`, `rounded-[12px]`, `px-[6px]`) is refused in Console code by
`bliss/no-arbitrary-design-values`; layout templates (`grid-cols-[...]`, `w-[...]`) stay allowed.
`scripts/check-classes.mjs` fails on any class that compiles to nothing.

**Surfaces and roles** (light and dark): `page`, `card`, `edge`, `edge-strong`, `band`, `band-strong`,
`rail`, `rail-hover`, `rail-active`, `thumb`, `scrim`, `on-scrim`, and the washes `poured-wash`,
`served-wash`, `low-wash`, `stop-wash`, `info-wash`, `accent-wash`, `attention-wash`, `neutral-wash`.

**Radius**: `sm` 6 (chips), `md` 10 (small buttons, menus, rows), `control` 12 (buttons), `card` 16,
`overlay` 20 (dialogs), `pill` (count badges, segmented controls only).

**Shadows**: `card`, `card-hover`, `popover`, `control`, `control-primary`.

**Utilities**: `card-surface`, `card-interactive`, `card-band`, `card-band-strong`, `label-caps`,
`measure`, `transition-hover`, `transition-card`, `press-scale`, `link-stretched`, `scroll-x`,
`grid-cols-kv`, and the named stack `z-raised`, `z-sticky`, `z-bar`, `z-rail`, `z-popover`,
`z-overlay`, `z-toast`. `dark:` follows the product's theme, not the operating system.

**Primitives** (`@bliss/ui/components/...`):

| Primitive | Use |
|---|---|
| `console/card`: `Card`, `CardHeader`, `CardBody`, `CardStats`, `Stat`, `CardFooter`, `IconTile` | every Card-family surface |
| `console/metric`: `Metric`, `MetricGrid`, `CountUp` | a headline figure; a row of them |
| `console/section`: `Section`, `SectionHeader`, `Overline`, `Separator`, `KeyValueList`, `MetaRow`, `SummaryStrip`, `LedgerList`, `LedgerItem`, `DetailHeader` | page composition |
| `console/data-table`: `DataTable`, `NumCell`, `StackCell` | every table; four states, URL state, export |
| `console/toolbar`: `Toolbar`, `SearchInput`, `ToggleChip`, `ResultCount` | the strip above a table or report |
| `console/filter-select`: `FilterSelect` | a filter, as a real listbox |
| `console/tabs`: `RouteTabs`, `Tabs`, `TabPanel`, `useTabValue` | views as URLs; in-page views in the URL |
| `console/dialog`: `ConsoleOverlay` | every Console dialog and side sheet |
| `console/lightbox`: `ImageLightbox` | a photo or scan at full size |
| `console/skeletons` | loading states in each view's shape |
| `button`, `button-link`: `Button`, `IconButton`, `ButtonLink` | one button style; `IconButton` requires a label |
| `status`: `StatusChip`, `ToneChip`, `Dot`; `badge`: `Badge` | states and labels, in one set of tones |
| `money`: `Money`, `AnimatedMoney` | every amount |
| `choice`: `Segmented`, `FilterChips` | radio groups with arrow keys |

Console server actions go through `runAction` (`app/(console)/console/(shell)/_lib/action.ts`): the
session actor, a zod schema for every field, `withWrite`, safe error messages, revalidation.

## 4. The shell

```
┌──────────────┬────────────────────────────────────────────────────┐
│ ◈ Cool Bliss │ Trade / Bills / Bill 142        ● 4 of 5 stations ▾│
│ ● Trading ·  ├────────────────────────────────────────────────────┤
│   Sat 26 Sep │ Trade                                              │
│ ⌕ Search  ⌘K │ Open tabs, settled bills, drawer sessions, shifts. │
│ SERVICE      │ Open tabs 6   Bills   Drawers   Shifts             │
│ ▎Overview    │ ─────────────────────────────────────────────────  │
│  Trade     6 │                                                    │
│ STOCK        │   page content                                     │
│  Inventory ●2│                                                    │
│  Purchasing  │                                                    │
│ MENU …       │                                                    │
│ BUSINESS …   │                                                    │
│  Settings  ●2│                                                    │
│  Dan, Manager│                                                    │
└──────────────┴────────────────────────────────────────────────────┘
```

- **The nav manifest** (`_lib/nav.ts`) names every workspace and view once. The rail, the workspace
  header and tabs, the breadcrumbs, the command menu and page titles all read it.
- **Rail**, 240px: the venue and its business day, search, the workspaces in four groups (Service,
  Stock, Menu, Business), Settings, the account menu (theme, stations, sign out). It folds to 64px
  with `[` and folds itself below 1280px.
- **Top bar**, 56px: breadcrumbs (a detail page names its record with `<RecordCrumb>`), the stations
  popover, and a warning only when orders are waiting. `R` refreshes data.
- **Command menu**, Cmd or Ctrl K: go to any view, find a record by number or name, do a common thing.
- **Page frame**: one column up to 1440px with 32px gutters; the page title, one sentence, actions;
  sticky underline tabs. A record page (`isRecordPath`) drops the workspace chrome and uses
  `DetailHeader` with a way back.
- **States**: each workspace has a loading skeleton in its own shape and an error boundary; the
  Console has a not-found page. A workspace that needs a permission refuses itself on the server.

Below 1280px the rail is icons; below 1024px the page scrolls sideways rather than crushing.

## 5. Copy

The voice is `08-ux-copy.md`. The Console section there has the rules; `scripts/check-copy.mjs` runs
in `pnpm lint` and flags banned phrases, locked-term slips, shouted capitals, Title Case labels and
prototype language. The rewrites made in this pass, for reference:

| Was | Now |
|---|---|
| Executive Overview, OPERATIONAL INTELLIGENCE · VENUE OVERVIEW | Overview: "Last night at a glance, and what needs you now." |
| Exceptions requiring operational clearance | Needs attention |
| Tender Settlement Mix | Tender mix |
| Recent Tariff Adjustments | Recent price changes |
| Venue legal identity, cutover, and operating parameters | Outlet: "Name, tax details and when the business day ends." |
| Unclosed Sales Alert, Total Leakage | Tabs open past close, open value |
| Vendors to Order | Suppliers to order from |
| Receive Goods, Goods Received Note | Receive a delivery; Delivery |
| Units Rejected / Returned | Rejected |
| eTIMS KRA Ref, eTIMS queue, FISCAL RECEIPT | Removed: KRA eTIMS is out of scope, and a Bliss bill is not a tax invoice |
| Reload Console Data | Refresh the data |
| Dynamics P&L | Performance |
| People & Zoning, Zoning | People; Zones and tables |

## 6. Definition of done for a Console page

- [ ] Built from the primitives above; Pane or Card family chosen deliberately.
- [ ] No arbitrary design values, no dead classes, no text opacity (lint passes).
- [ ] One `h1`, then `h2` and `h3` in order; every number mono and tabular; money through `Money`.
- [ ] Copy passes `check-copy` and reads in the docs/08 voice: sentence case, locked terms, one
      sentence of purpose, specific empty, filtered and error states.
- [ ] Every table has its four states; filters, sort and view live in the URL.
- [ ] Every control is reachable and operable by keyboard, with a visible focus ring; icon-only
      controls are labelled; dialogs trap focus and return it.
- [ ] Correct in light and dark, at 1440 and 1280, and usable (scrolling, not clipped) at 1024.
- [ ] Every write goes through `runAction` with a schema; the service enforces permission and rules.
