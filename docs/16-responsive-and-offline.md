# 16. Responsive surfaces and offline

How Bliss behaves on the devices it actually runs on, and what it does when the network is not
there. This is the companion to docs/12 (surface language), docs/13 (working surfaces) and
docs/14 (surfaces and sync): those decide what a screen says, this decides how it fits and how it
survives a dead spot.

## 1. The devices

| Name | Width | What it is |
| --- | --- | --- |
| base | 360 to 430 | a phone held upright: a waiter's own phone, the spare |
| `compact` | 480 | a phone on its side, and the small tablets kept as spares |
| `pad` | 768 | a tablet held upright, which is the Floor's own device in portrait |
| `tablet` | 960 | a tablet on its side, the Floor and the Counter at ten inches |
| `desktop` | 1280 | the Console, and a counter on a monitor |
| `wide` | 1440 | a large monitor in the office |

Width alone does not describe a phone on its side: 844 wide is past `compact` while 390 of height
has to hold a header, a list and a dock. Two height variants answer that:

- `short` — `max-height: 34rem`. A phone on its side, or any screen with the keyboard up. Chrome
  collapses: the top bar drops to 40px, the dock loses its labels and drops to 48px, page headers
  halve their padding.
- `tall` — `min-height: 48rem`. Room to breathe.

`short` is defined in base.css after the breakpoints, so a `short:` utility wins over a `pad:` one
on the same property by source order. No important modifier is needed, and none should be used:
the copy lint rule reads `!` in any string as an exclamation mark.

Two more variants exist for the cases where the input, not the size, is the question: `touch`
(`pointer: coarse`), `mouse` (`pointer: fine`) and `standalone` (installed to the home screen).

## 2. Rules that hold on every surface

1. **The chrome is in the flow, never over it.** The Floor's dock is the last child of the shell's
   flex column, so a list ends where the dock begins. Nothing is hidden under a thumb, and no page
   needs a `pb-[160px]` to guess the dock's height. The dock still *looks* free floating: it is a
   rounded, translucent pane with a gutter on all four sides, on a phone and on a desktop alike.
2. **A page owns one scroll region.** `scroll-region` (min-height 0, flex 1, overscroll contain)
   inside a flex column parent. A parent that is not a flex column gives its child no height, and
   the child silently stops scrolling; the shell's `<main>` is therefore a flex column.
3. **Every edge that meets the device frame pays back its inset.** `safe-t`, `safe-b`, `safe-x`
   add `env(safe-area-inset-*)` to a gutter set with `--bliss-gutter-*`. They own that side's
   padding, so the gutter goes through the variable, never a `px-*` beside them: the two set the
   same property and one silently loses (section 10).
4. **A sheet is a sheet on a phone and a dialog on a tablet.** `placement="adaptive"` on the
   overlay: full width at the bottom edge under the thumb, centred card from `pad` up.
5. **Density changes with the screen, the information does not.** A phone gets two columns of
   tabs, two columns of items, a list view of the menu; it does not get a shorter tab card with
   less on it.

## 3. What is checked

`pnpm lint` runs `scripts/check-classes.mjs` after ESLint. Bliss resets every Tailwind namespace
in tokens.css, so a class naming a token we do not have compiles to nothing at all: `p-18` between
our 16 and 20 is not a rounding error, it is a card with no padding, and nothing else in the
toolchain notices. The checker walks every class list in `app`, `lib` and `packages/ui/src` and
fails on any utility in a reset namespace whose value is not one of ours, including the variant in
front of it, so `md:` fails as loudly as `p-18`.

It found 725 of them the first time it ran.

Two habits it protects against, both easy to fall into:

- **The scale is in pixels, not steps.** `gap-8` is 8px, not 32. Tailwind's own `gap-2` would be
  8px, and here it is 2px, which compiles and looks almost right.
- **The palette is ours.** `bg-white/5`, `text-amber-200` and `shadow-sm` are all gone.

## 4. The PWA

`app/sw.ts`, built by Serwist. Two rules decide every route:

1. **Nothing that talks to the server is ever cached.** A cached pull hands the device rows from a
   moment that has passed on top of rows it already has; a cached push response tells it an order
   was accepted that the server never saw. `/api/*` is `NetworkOnly`, deliberately, forever.
2. **The shell is cached so a tablet in a dead spot still starts.** Pages are `NetworkFirst` with
   a four second timeout, so a waiter never works against a stale build while the network is fine,
   and the last good copy answers when it is not. `/offline` is precached as the fallback for a
   navigation with neither.

Build output is cache first and immutable. Fonts and the menu's photographs are cache first with
expiry. The manifests set no `orientation`: a waiter holds a phone upright and a tablet on its
side, and locking to landscape letterboxes half the devices. Their scope is the whole origin, so
the surface switcher opens the Counter inside the installed app rather than in a browser tab, and
each keeps its own `id`. Icons are PNG at 192, 512 and maskable, rendered from the same two rounded
squares as `icon.svg` — iOS reads `apple-touch-icon` and has never supported SVG there.

**A new build never takes over on its own.** `skipWaiting` is false. The running page holds
references to chunks the new build has renamed, so activating mid-order turns the next tap into a
failed import. A waiting build is reported by `lib/pos/updates.ts`, the shell offers it in one
quiet line, and restarting is refused while the outbox still holds anything. `reloadOnOnline` is
off for the same reason: coming back into range must not reload the page under someone's hands.

## 5. Offline, honestly

What works with no network, because it never needed one: opening a tab, adding lines, firing an
order, pouring, settling, the drawer's open and drop, and every list the device already holds. The
outbox carries them when the network returns, and docs/14 section 4 governs what happens then.

What does not:

- **Signing in.** The PIN is checked by the server. A waiter who arrives to a dead network cannot
  start a shift on a device that is not already signed in.
- **Approvals.** A supervisor's PIN is checked the same way; a poured line cannot be voided until
  the network is back. The line stays as it is, which is the honest outcome.
- **Counting the drawer.** Deliberate, not a limitation: the expected figure must not exist on the
  device before the count is committed (docs/14 section 7), so the count is a server call.

> **Open decision.** Offline sign-in would need a PIN verifier on the device. With six digits, a
> stolen tablet plus a fast hash is a few seconds of brute force, so it needs a slow KDF and a
> decision about how long a device may hold one. Worth doing before a real outlet opens on a
> flaky line; not worth guessing at now.

## 6. One chrome, two stations

The Floor and the Counter wear the same chrome, from `app/_pos/chrome.tsx`: `TopBar`,
`SurfaceSwitcher`, `LiveClock`, `Dock`, `DockLink`, `DockButton` and `PageHeader`. What each
surface owns is its contents, never the behaviour, so a waiter who moves from the floor to the
counter mid-shift already knows where everything is.

| | Floor | Counter |
| --- | --- | --- |
| Artwork | Frost and Liquid Architecture, glacier | Pour and Ledger, ember, dendritic crystal high right (`counter-workspace.tsx`) |
| Top bar | search, switcher, clock, the waiter (opens their shift) | tab finder, switcher, drawer pill, link, clock, account menu |
| Dock | Tabs, Orders, Shift, History, Settings, Search | Orders, Tabs, Sale, Drawer, History |
| Action inline from | `pad` | `tablet`: settling carries an amount, and a 768 tablet needs the room |
| Keyboard | Ctrl K search | Ctrl K find a tab, Alt 1 to 5 the five views, digits and Enter on the keypad |

Shared pieces the Counter reuses rather than copies: `MetricTile` (drawer, bills, the Floor's
shift), `ProductTile` (quick sale shows the same tiles as the Floor's grid), `TicketLineView`
(the bill reads like the ticket the waiter built), `PaneButton` (tab cards).

### The blind count, on screen

docs/14 section 7 makes the drawer count blind. Two screens could have given it away, and don't:

- **Drawer** shows the float, the time open, the bills taken here and the cash sent to the safe. It
  never shows the cash taken on bills: with that one figure the expected total is simple arithmetic.
- **History** (which replaced Bills) hides tonight's takings, and each of tonight's tender amounts, while a drawer is open on the device, and shows them once
  it is closed. Each bill still carries how it was paid; that is what a cashier needs to answer a
  guest.

### Two sync fixes this surfaced

A device's first pull runs before it is bound to a device id, so anything addressed to the device,
its open drawer and its bills today, reached nobody. A counter set up on a fresh browser showed
"drawer not open" over a drawer the server had open, and let a second one be opened on top.

1. `ensureDevice` rewinds the trade cursor and wakes the sync cycle the moment it binds, so the
   next pull is a full one with the device id on it.
2. Every pull now carries the device's own drawer rows (`deviceDrawers` in modules/sync/apply.ts),
   and a `drawer.open` the server refuses takes the device's optimistic drawer away with it.

And one wire convention made explicit: only fields ending in `Cents` come back as money
(lib/wire.ts), so the drawer preflight's `total` and the count's `threshold` are now `totalCents`
and `thresholdCents`. As plain strings they crashed the refusal screen.

## 7. Every action answers

A tap that changes something says so. The notices in `packages/ui/src/components/notices.tsx` are
a small store outside React (`notify`, `dismissNotice`, `useNotices`) with one viewport,
`NoticeViewport`, mounted once in `app/_pos/pos-root.tsx`, bottom centre on every screen, just above
the dock. The dock publishes its height, action row included, as `--bliss-dock-h`, so a notice
rises from the rack the action was taken on and never lands on the clock or the account menu.

- **Tone.** Success, info, warning and error. An error stays until it is dismissed; the rest hold
  for their `holdMs` and pause while a finger or pointer is on them, or focus is inside.
- **Keys.** A notice with a `key` replaces the one before it, and with `count` it counts up
  ("Tusker added ×3") instead of stacking. At most four stand at once; the oldest calm one goes
  first.
- **Undo.** Only where a real inverse exists, and it runs through the outbox like any change. A
  notice with an undo holds for at least six seconds. If the server has since made the undo
  impossible, the refusal comes back as its own notice.
- **Haptics.** `lib/pos/haptics.ts`, opt in from the Floor's settings. A tap, a success, a
  warning, an error; nothing when the device or the person says no.

Screens call `lib/pos/actions.ts`, not the mutations, for anything a person triggers: `addItem`,
`fire` (says when it is held offline), `deliver`, `undeliver`, `deliverTable`, `clear`,
`closeEmpty` and `pour`. The mutations stay data only. The quick sale, the settle screen and the
drawer say what they did in the same voice, with the change to give where there is change.

Things nobody tapped are announced too, by the watchers in `app/_pos/watchers.ts`: on the Floor,
a round poured at the counter ("Mark served" right on the notice) and an item that ran out; on the
Counter, a new ticket when the orders view is not the one on screen. Each watcher reads its
baseline first, so opening the app never replays the night.

## 8. A table, from sitting down to walking out

Paid is not the same as gone. A tab settled while the guests are still finishing their drinks
keeps its table, so nobody walks a second party to it.

| `Tab.clearedAt` | Meaning |
| --- | --- |
| `null` | Settled, guests still seated. The table is held. |
| a time | Cleared: the guests have left and the table is free. |
| absent | A tab from before this existed; read as cleared. |

`isSeated`, `holdsTable` and `isOrdering` in `@bliss/shared/trade` read it the same way on the
server and the devices.

- **Clear.** `tab.clear` from either surface: the Floor's tab list ("Paid, still seated"), the
  settled tab's dock, or the Counter's settle result ("Guests are leaving, clear the table").
  Refused with `TAB_NOT_SETTLED` while anything is still to pay.
- **Undo.** The same kind with `undo: true`. Refused with `TABLE_TAKEN` once new guests sit there.
- **New guests.** Opening a tab on a table whose last party paid and never cleared clears the old
  tab on the spot; the table is plainly free.
- **Nobody ordered.** An open tab with nothing fired closes with a reason of at least ten
  characters, becomes `voided`, and leaves an audit record (`tab.closed_empty`, notable).
- **At the table.** `order.deliver` records a poured round as taken to the table, and takes it
  back. It used to live only on the device that marked it; now every device and the history see it.

## 9. History

`modules/history/service.ts` reads trade and settlement into the night's record, and
`GET /api/dev/history` serves it (`from`, `to`, `staff`, `only`, `device`, `q`). The shapes and the
named ranges live in `@bliss/shared/trade` (`history.ts`), so the server and the screens share one
definition.

- **Ranges.** Tonight, yesterday, this week (from Monday), the last seven days, this month, last
  month, or two dates. At most 93 days and 600 tabs, newest first; wider reports belong in the
  Console.
- **Scope.** The Floor opens on the waiter's own tabs, the Counter on what this till settled; both
  widen to everyone. Search takes a table, a waiter, a tab number or an item.
- **A record.** Closed, a tab is its table, number, waiter, guests, state and total. Opened, it is
  the night in order: opened, each round with every line poured (when, by whom), taken to the
  table or voided with its reason, each bill with how it was paid, and when the table cleared.
  An active tab links straight to it.
- **The blind count.** With a drawer open on the asking device and tonight in the range, the
  summary's takings and split by tender are null, and so is each of tonight's tender amounts.
- **Offline.** History is the server's record, so it is fetched, not read from the local store.
  The last twelve answers are kept in Dexie meta; with the network down the screen opens on the
  saved one and says when it was saved. A range that includes tonight reads again after each sync,
  at most every fifteen seconds. Changes this device has not sent yet are named above the list.

`/counter/bills` redirects to `/counter/history`, which opens on the same day Bills showed, and
Alt 5 goes there.

## 10. Refinements

- **Orientation.** Neither manifest locks orientation. The Floor's used to say `landscape`; an
  installed copy picks the change up on its next manifest check, or on a reinstall.
- **Dock.** Items are 52px (56 from `pad`), the current one sits in a soft accent pill, and the
  page's action is sized by the dock itself (`DOCK_ACTION` in `app/_pos/chrome.tsx`: 48px, the
  dock's rounding, body type), so pages keep passing their usual buttons.
- **States.** `StatePill` (a card's state: tinted, one line, 24px, 28 from `pad`, with a `more`
  that only shows from `pad`) and `StateMark` (a line's state: a dot and a time, no box) in
  `packages/ui/src/components/status.tsx`. The Floor's order cards and order sheet and the
  Counter's tickets use them; the old badges wrapped beside the table name on a phone.
- **Quick sale.** From `pad` up, the cart and the tender sit on their own panes beside the shelf.
  On a phone the shelf keeps the screen and the dock's action, "Pay KES X · n items", opens the
  cart and tender in a sheet with the settle button pinned in its footer.
- **Settle.** On a phone the bill and the payment are one scroll, the payment on its own pane.
- **Gutters.** `safe-x` owns left and right padding, so a `px-*` beside it lost and pages sat flush
  against the screen edge. Every `safe-x` now takes its gutter through `--bliss-gutter-x`.
- **Widths.** Counter pages run full width with the Floor's gutters (12, 24 from `pad`); the
  drawer and history no longer stop at 1080px.
- **Artwork.** The Counter's crystal is dendritic now (tapered ribs, five graded branch pairs,
  twigs, a double hex core and a halo), in the upper third, with a smaller one and a few glints.

## 11. When the dev server cannot see a new export

Webpack's persistent cache in `.next/dev/cache/webpack` remembers how a workspace package's
`exports` resolved. When a subpath moves (`@bliss/shared/trade` went from `places.ts` to an
index), a dev server started from that cache keeps the old file and every sync pull fails with
"is not a function", which the devices report as offline. A production build is unaffected.
Stop the dev server, delete `.next/dev/cache/webpack`, and start it again.
