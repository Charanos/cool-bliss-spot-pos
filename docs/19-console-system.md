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
| `console/metric`: `Metric`, `MetricGrid`, `CountUp` | a headline figure; a row of them. `Metric` renders on the server too, so a server page may pass it an icon |
| `console/section`: `Section`, `SectionHeader`, `Overline`, `Separator`, `KeyValueList`, `MetaRow`, `SummaryStrip`, `LedgerList`, `LedgerItem`, `DetailHeader`, `Callout`, `Totals` | page composition; a `Callout` says one thing that needs a person, `Totals` ends a bill, an order or a delivery |
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

Console-local parts: `ProductThumb` (a catalogue photograph or its initial, with the category edge) and `StaffAvatar` (an uploaded photo or initials, never a stock photograph). Every primitive is on one page at `/console/kit` when development data is on.

Console-local composition (`app/(console)/console/(shell)/_components`):

| Part | Use |
|---|---|
| `EntityLink` | A record's name as a link to its page, through `hrefFor(kind, id)` in `_lib/nav.ts`. The one way a name is shown, so nothing dead-ends. It sits above a stretched row link, so it may go in any cell of a linked row except the first |
| `hrefFor`, `hrefForEntity` | The page for a record kind, and for an audit entry's entity type (a voided line opens its tab) |
| `ViewHeader` | A list page's title, purpose, headline actions and aside figure, from the nav manifest |
| `FormDialog`, `Fieldset` | Every create and edit: one form for both, the server's refusal above the fields, the dialog closing and the page refreshing on success |
| `ReasonDialog` | Every archive, void, refund, review or reinstatement: a reason of at least ten characters for the audit trail; extra fields go in as children |
| `useDialog`, `useCreateParam` | One piece of dialog state per page; `?new=1` opens the page's create dialog, from the command menu or a header `ButtonLink variant="create"` |
| `OneTimeCode` | A secret shown once, such as a device's pairing code |
| `PhotoField`, `DaysField` | An uploaded photograph with its preview; days of the week as toggles |

Managers that serve a list and its record alike live beside the list: `useStaffManager` (people), `useDeviceManager` (devices). A record page's header actions use the same hook as the list's row menu, so an action reads and behaves the same in both places.

Console server actions go through `runAction` (`app/(console)/console/(shell)/_lib/action.ts`): the
session actor, a zod schema for every field, `withWrite`, safe error messages, revalidation.

### The expressive layer

The touches the Console's first revamp introduced, rebuilt on tokens so every page can use them
the same way. Each is decoration beside something a page already says in words and figures.

| Primitive | Use |
|---|---|
| `Metric` top line | Every metric card carries a 1px line along its top in its tone (`card-topline`, `topline-*`); its icon tile sits before the label and swells a little on hover |
| `CardMedia` | A real photograph across the top of a record card (a product, a person, a delivery), the title on a scrim. If the image fails, an initial tile stands in and the title turns to ink |
| `CardGroup` | The bento label: a heading and its icon above a grid of cards, never inside one |
| `Separator variant="pill"` | A named break between two parts of a page: a hairline fading at both ends around a small band |
| `Callout size="hero"` | The one banner at the head of a page when something needs a person: an icon tile, the figure behind a rule, the way on |
| `ActionPill` | The way on from a row or card: turns solid ink when its row (`group`) is hovered, its arrow nudging forward |
| `InlineBar` | A 3px bar inside a figure's cell: a share, days of cover, how much of an order has come |
| `ChartCaption` | The line above a chart that says what to look at |
| `Sparkline` | A small trend in bars or a line, labelled for a screen reader |
| `Button variant="create"` | The one way to make something new on a page: the accent pill, lit from above with a glow in its colour, rising a pixel under the pointer, its plus turning a quarter |
| `KeyRows`, `KeyRow` | A record card's facts as rows: an uppercase label, its value on the right, a hairline between |
| `CardBand` | The head of a record card with no photograph: the record's number or kind as a mono eyebrow, its state, its name and one line |
| `PillTabs` | A workspace's pages at the head of each page: a track, the current page a raised chip, counts inside |
| `Toaster`, `useToast` | The confirmation of a finished action, at the foot of the sheet. `FormDialog` and `ReasonDialog` toast in the words of their button unless told otherwise (docs/11 D-22) |
| `PinBoxes` | A PIN typed on a keyboard: one box per digit over one real input, so typing, paste and one-time-code fill work. Digits only; hidden until shown. Used by the PIN dialogs, never on the Floor or Counter, which keep `PinPad` |
| `Pagination` | The foot of a long table or grid: the range shown, numbered pages and a page size, all in the address |

## 4. The shell: a desk and a sheet

```
  desk (sunken, no surface of its own)   sheet (raised, rounded, scrolls on its own)
┌──────────────────────┐ ┌──────────────────────────────────────────────────────────┐
│ ◈ Cool Bliss Spot    │ │ ▣ Inventory › Stock        ● 6 orders waiting  ● 4 of 5 ▾│
│   ● Trading · Sat 26 │ │ Stock   Counts ②   Movements   Recipes   Holds ①         │
│ ⌕ Search or jump  ⌘K │ ├──────────────────────────────────────────────────────────┤
│ SERVICE              │ │ Stock                                  STOCK AT COST     │
│ ▢ Overview   (chip)  │ │ What is on hand at cost, what is ...   KES 431,968  [+]  │
│   Trade            6 │ │                                                          │
│ STOCK …              │ │ ┌metric┐┌metric┐┌metric┐┌metric┐                         │
│ ┌ LAST NIGHT ──────┐ │ │ ┌ table or cards ───────────────────────────────┐       │
│ │ KES 105,720 ▁▃▅▇ │ │ │                                                          │
│ │ 79 bills  6 open │ │ │                                                          │
│ └──────────────────┘ │ │                                                          │
│   Settings  Collapse │ │                                                          │
│   Dan, Manager       │ └──────────────────────────────────────────────────────────┘
└──────────────────────┘
```

- **The desk** (`bg-desk`) is the ground: the navigation sits on it directly, with no border and no
  panel. What is active is a chip of the sheet's own surface (`bg-desk-active`, `shadow-chip`), so
  the eye reads it as "the sheet is here". The search field and the Tonight reading are wells
  sunk into the desk (`bg-desk-well`, `shadow-well`).
- **The sheet** (`ConsoleSheet`) is the one raised surface: `rounded-sheet`, `shadow-sheet`, inset
  `sheet-inset` from the viewport. It scrolls on its own (Lenis runs inside it, and ScrollTrigger
  measures against it); the desk never scrolls. Inside it, `sheet-scope` makes `page` the sheet's
  colour, so sticky headers and table heads match in both themes.
- **The nav manifest** (`_lib/nav.ts`) names every workspace and view once, with the one sentence
  each view's header shows. The desk, the sheet header's tabs, the breadcrumbs, the command menu
  and page titles all read it. `_lib/counts.ts` reads every navigation count once per request.
- **The desk navigation**, 232px: the venue and its business day, search, the workspaces in four
  groups (Service, Stock, Menu, Business), Tonight (takings so far, the night by hour, bills and
  open tabs; Last night once the day has closed), Settings, the fold, the account menu. It folds
  to 60px with `[` and folds itself below 1280px.
- **The sheet header** rides at the top of the sheet: the workspace's icon and the breadcrumb (a
  record page names its record with `<RecordCrumb>`), orders waiting when there are any, and the
  stations popover. Its second row is the workspace's views as underline tabs with their counts;
  on a record page it is a way back to the list. `R` refreshes data.
- **Page frame**: one column up to 1440px with 32px gutters. A list view opens with `ViewHeader`
  (title and sentence from the manifest, at most one figure beside it, then its actions). A
  record page uses `DetailHeader`.
- **Command menu**, Cmd or Ctrl K: go to any view, find a record by number or name, do a common thing.
- **States**: each workspace has a loading skeleton in its own shape and an error boundary; the
  Console has a not-found page. A workspace that needs a permission refuses itself on the server.

Below 1280px the desk is icons; below 1024px the page scrolls sideways rather than crushing.

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
- [ ] A list page has its anatomy: `ViewHeader`, a `MetricGrid` of up to four toned metrics, a hero
      `Callout` only when something needs a person, then the table with a card view for anything
      with an identity.
- [ ] A record page has its anatomy: `DetailHeader` with the record's own actions, a callout when its
      state needs explaining, its figures, then a two-column grid of cards with related records.
- [ ] Every record named on the page is an `EntityLink`, or the row opens it; nothing dead-ends.
- [ ] Create, edit and archive (or its domain's word: void, refund, withdraw) are reachable for the
      page's own records, and `?new=1` opens its create dialog.
- [ ] Removal is a status, never a delete: stored rows are only ever upserted, and history keeps
      reading back.
