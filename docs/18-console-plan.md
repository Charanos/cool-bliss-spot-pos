# Console hardening and refinement plan

Version 1.0
26 September 2026

The working plan for bringing the Console to production quality. Every agent working on the Console reads this first, then `06-design-system.md`, `08-ux-copy.md` and, once it exists, `19-console-system.md`. Work lands on one branch, one focused commit per numbered step, and each commit message names the step it closes (for example `plan 1.5`).

## Context

Seven recent commits (98455c6 → 14cabf6) revamped part of the back-office Console: Overview, Trade (bills, open tabs, tab and bill detail), Staff, Zoning, GRN intake and Dynamics. They moved it toward an "Apple-grade" bento look. About half the workspaces are still in the old style, and the revamp was built with arbitrary Tailwind values rather than the token system. Three read-only audits found the following.

**The design layer has drifted from its own system.**
- `tokens.css` resets every Tailwind namespace. As a result, **863 classes in the revamped code compile to nothing**, for example:
  - `tracking-wider` ×80, `rounded-xl`, `font-semibold`, `shadow-sm`, `text-title-sm`;
  - the `sm:`, `md:` and `xl:` breakpoints;
  - `bg-black/*`, `animate-in`, `bg-attention-wash`.
- Visible consequences:
  - the lightbox scrims are transparent;
  - dialog error banners have no styling;
  - dialog grids never become two columns;
  - the Dynamics cards have square corners.
- `pnpm lint` currently fails on `check-classes` (863), `no-raw-hex` (about 130 `shadow-[…rgba]` lines) and `max-font-weight` (34).
- There are about 196 `text-[..]`, 94 `shadow-[..]`, 78 `rounded-[..]` and 504 ad-hoc opacity modifiers.
- The same card, strip and label recipes are copy-pasted across pages.
- Primitives are duplicated: 6 button kinds, 5 badge kinds, 9 separate tone enums, 4 dropdowns and 2 switches.
- `dark:` follows the OS setting, not the app's `data-theme`.
- The revamp guidelines (`.agents/rules/ui-guidelines.md`) contradict docs/06 and the lint rules.

**Functional integrity has serious gaps.**
- **Auth.** The console session is an unsigned staff-id cookie. `currentConsoleActor` fails open to *owner*. PINs are hard-coded (`DEV_PINS`) with no rate limit.
- **PIN exposure.** Plaintext `pinHash` values are sent to the browser.
- **Station routes.** `/api/dev/*` is on in production with no auth; `staffId` is taken from the request body, and void approval tokens are never verified.
- **Uploads.** The upload route has no auth, trusts the client's MIME type and writes to `public/`.
- **Lost counts.** `recordCounted` bypasses `withWrite`, so stock counts are never persisted.
- **Tablets never sync.** Zone, table and staff edits never bump the sync version.
- **GRN.** Intake has no PO status or quantity guards and no idempotency.
- **Audit log.** `unshift` rewrites the whole log on every write and scrambles its order.
- **Dynamics.** The P&L uses hard-coded, invented figures.
- **Performance.** The shell layout does roughly variants × movements work on every navigation.

**The words and the frame read like a prototype.**
- **Copy** reads as developer or AI filler, for example:
  - "Executive Overview" and "OPERATIONAL INTELLIGENCE · VENUE OVERVIEW";
  - "Exceptions requiring operational clearance" and "Tender Settlement Mix";
  - "Venue legal identity, cutover, and operating parameters";
  - intros that explain implementation ("A permission is enforced on the server…", "Theoretical depletion is sold serves times the depletion factor…");
  - Title Case and ALL CAPS labels, and invented placeholders ("KES · VAT incl. / Station #1", "Reload Console Data").
- **The shell looks like a template:**
  - the rail has glass, blurred colour blobs, gradient sheens and pill badges;
  - the "bliss console" wordmark says nothing about the venue;
  - breadcrumbs are raw URL slugs;
  - the telemetry is a set of unlabelled micro-pills;
  - the refresh button does a full `window.location.reload()`.
- **Typography** mixes about 20 ad-hoc sizes, three ways of writing labels, and text colour done with opacity.

**Goal.** Keep the visual direction you are heading in and bring it to production quality with precision:
- a considered, venue-first shell;
- a disciplined type system;
- plain, exact copy in the product's own voice (docs/08);
- all of it built on a token and primitive foundation that is robust, enforced and consistent.

Fix every correctness, security and consistency defect. Then migrate every Console page onto that foundation.

**Decisions taken**
- **Hybrid direction.**
  - The *Pane* family stays flat, per the docs/06 one-pane rule. It covers dense data surfaces: tables, forms, lists and settings.
  - The *Card* family covers dashboards, grid views and detail pages: an elevated bento card with bands and a hover lift.
  - One level of depth still applies: no card inside a card.
- **Single branch.** All work goes on `claude/great-curie-mgu2kh`, one focused commit per step below, and the work is reviewed at the end.
- **Desktop-first.** Pages are polished at 1280px and wider. At narrower widths they must stay usable, meaning they scroll rather than clip, but they get no dedicated mobile design.

**Ground rules for every agent working this plan**
- Per `AGENTS.md`, read the relevant guide under `node_modules/next/dist/docs/` before touching Next APIs. Next 16 is in use, and `cookies()` and route handlers may differ from what you expect.
- Run `pnpm install` first, since `node_modules` is currently absent.
- Record the baseline output of `pnpm ci` in the first commit message.

---

## Phase 1: Security & data integrity (do first; correctness before polish)

### 1.1 Console session
- Add `lib/auth/session.ts` (server-only). It issues an HMAC-SHA256 signed token using `node:crypto` (no new dependency) with the secret in `BLISS_SESSION_SECRET`.
  - Token payload: `{ sid: staffId, iat, exp (12h), v }`.
  - Cookie flags: `httpOnly`, `secure` in production, `sameSite=lax`, `maxAge`.
- `modules/identity/service.ts:105 currentConsoleActor`:
  - verify the signature and expiry;
  - re-check that `employmentStatus === 'active'` and `canSignInOn('console', role)` on **every** call;
  - **delete the fail-open owner fallback** at lines 121-127.
  - Tests that relied on the fallback (`modules/contract.test.ts:32,53,70`) switch to an explicit `testActor()` helper.
- `app/(console)/console/sign-in/actions.ts`:
  - verify the PIN against the stored hash (see 1.2), not `DEV_PINS`;
  - add a per-staff and per-IP attempt limiter (in memory, 5 attempts per 5 minutes, escalating lockout, audited).
- Wire `signOutFromConsole` into the rail's profile card. Break the stale-cookie redirect loop between the sign-in page and the layout.

### 1.2 PINs
- Hash PINs with `scrypt` from `node:crypto`. The seed (`packages/db/seed/organisation.ts`) stores hashes of the dev PINs.
- Stop sending `pinHash` to the client. The staff page (`people/staff/page.tsx:27`) and the sign-in page (`sign-in/page.tsx:16`) receive a `StaffSummary` DTO instead, with `id`, `displayName`, `roleKey` and `photo`. This also removes `as any`.
- `staff-dialog.tsx`: replace the pre-filled PIN with an optional "Set a new PIN" field, where blank means unchanged. Send one `updateStaff` action that includes the role, rather than two unawaited ones.

### 1.3 Station API (`app/api/dev/*`, used in production by the Floor and Counter tablets)
- The identity route verifies the PIN on the server and issues a signed **station token** containing `{ staffId, deviceId, exp }`.
  - `lib/pos/api.ts` sends it as a header.
  - `sync/pull`, `sync/push`, `history` and `counter/drawer` take the staff id from the verified token, **never from the request body**, and reject suspended staff.
- Approval tokens:
  - the approve endpoint returns a short-lived signed token bound to `{ approverId, permission, exp }`;
  - `trade/commands.ts voidLine` verifies it and records the real `approverId`;
  - approve attempts are rate-limited.
- `lib/dev.ts devDataEnabled`: make the behaviour match its comment (off in production unless `BLISS_DEV_DATA=1`). This applies only to routes that really are dev-only; the station routes stay on, now authenticated.

### 1.4 Uploads (`app/api/upload/route.ts`)
- Require a console session with the relevant permission.
- Reject oversized bodies up front using Content-Length, and cap the number of files and the size of each.
- Detect the file type from its magic bytes (JPEG, PNG, WebP, PDF) instead of trusting `file.type`.
- Name stored files by random id and write them to `BLISS_UPLOAD_DIR`, outside `public/`.
- Serve files through an authenticated `app/api/uploads/[id]/route.ts`.
- Return generic error messages.
- `procurement/service.ts:491` accepts only ids issued by our own uploader.
- Object storage is noted as a follow-up.

### 1.5 One robust server-action layer
- Add `app/(console)/console/(shell)/_lib/action.ts` exporting `defineAction(schema, handler, { revalidate })`. It:
  - parses the input with **zod** (already a dependency);
  - resolves the actor, then runs the handler inside `withWrite`;
  - maps a `DomainError` (new, carrying a user-safe message) to `{ ok: false, message }`, and any other error to a generic message plus a server log;
  - calls `revalidatePath`.
- Migrate **every** action in `_actions.ts` to it, and split them into per-workspace `_actions/*.ts` files.
- Specific fixes:
  - `recordCounted` goes inside `withWrite` (it is currently lost on restart and invisible to other instances);
  - add `assertCan` to `recordCounted`, `submitForReview`, `returnLineToCounting` and `cancelCount` (`inventory/service.ts:433-552`);
  - enum-validate `writeOff.category`, `setEmploymentStatus.status`, `setRolePermission.permission` and `openCount.kind`;
  - replace the hard-coded `+03:00` (`_actions.ts:209`) with `@bliss/shared/time` zoned helpers.
- **Idempotency keys.** The client generates a uuidv7 (`@bliss/shared/id`), and the service dedupes on it, for `recordGoodsReceipt`, `raisePurchaseOrder` and any other create that isn't naturally idempotent. Submit buttons lock while pending.

### 1.6 Domain fixes
- **Identity** (`modules/identity/service.ts:188-229`):
  - no-one can grant a role above their own;
  - only an owner can edit an owner;
  - no self-demotion or self-suspension;
  - validate `roleId`;
  - require a reason for sensitive changes;
  - store avatars as uploads (1.4), not base64 in the staff row.
- **Zoning** (`modules/trade/service.ts:169-231`):
  - validate names, `seats > 0`, `zoneId` and `defaultPriceListId`;
  - block setting a table to "available" while a tab is open on it.
- **Tablet sync.** Zone, table and staff mutations `touch()` and bump the catalogue/identity sync version, so `sync/pull` delivers them to tablets.
- **Goods receipt** (`procurement/service.ts:393`):
  - merge `receiveAgainstOrder` and `recordGoodsReceipt` into one internal `receive()` (about 150 duplicated lines);
  - check that the PO is open, the supplier matches and the order exists (no silent unlinking);
  - enforce over-receipt limits and costs of zero or more;
  - require a variance note when a delivery is short;
  - match lines by remaining quantity;
  - link the GRN note to its receipt by an explicit `receiptId`, removing the guesswork in `noteForReceipt`;
  - add an `approveReceiptVariance` action for `pending_variance_approval`.
- **Batches** (`inventory/service.ts:628,679`): FEFO draws from the right location, and `reverseSale` and write-offs restore or adjust batches.
- **Dead or wrong functions.**
  - Fix `voidGoodsReceipt` (it subtracts rejected units twice) or delete it.
  - Delete the unused `refundBill`, or make it complete by reversing tenders and drawer cash.
  - Delete the dead `ReceiveForm` in `order-detail.tsx:186`, and the unused `actorId` prop in `receipts/new/page.tsx:12`.
- **Audit log** (`audit/service.ts:40`):
  - append with a monotonic `seq` and read newest-first by sorting;
  - stops the full-log rewrite on every write (`store.ts:329`);
  - fixes the order across instances and restarts.
- **Schema hygiene:**
  - one GRN type home, with `GoodsReceipt` and `GoodsReceivedNote` reconciled;
  - fix the cross-module schema imports (`reporting/dynamics.ts:27`, `history/service.ts:11`);
  - fix the lint rule's regex so it catches relative imports (`no-cross-module-schema.js:22`).

### 1.7 Honest reporting (`modules/reporting/dynamics.ts`)
- Cost of goods uses `reporting/service.ts:34 costOfLines`.
- Gross and net sales come from settled bills, net of VAT, consistent with `headline()`.
- Supplier cash-on-delivery is scoped to the selected range.
- Remove the invented constants (pour costs, named shrinkage, labour average, eTIMS queue, the KES 1,200 shrinkage fallback) at lines 312 and 416-447.
  - Operating costs (rent, power) become outlet settings, labelled "Estimate" in the UI.
  - Anything that isn't tracked shows a "Not tracked yet" state instead of a fake number.
- Remove every eTIMS reference (the dynamics queue and the GRN "eTIMS KRA Ref" field). KRA eTIMS is explicitly out of scope in docs/00.
- Gate the page with `report.margin`/`cost.read`, validate `?date`, and remove the unused imports.

### 1.8 Shell performance (`(shell)/layout.tsx:43-56`)
- Memoise the rail counts per store version (for example, `memoByVersion(fn)` in `modules/_data/store.ts`).
- Compute velocity and average cost for all variants in one pass over movements (`inventory/service.ts:56-97`).
- Index orders by tab in `trade/service.ts:83`.

### 1.9 Store concurrency (`modules/_data/store.ts:236-240`)
- Move `txn`, `tracking` and `writing` onto the same global singleton as the rest of the store state.
- Serialise `fresh()` catch-up with the `withWrite` catch-up so the same change isn't applied twice.

---

## Phase 2: Token foundation (the hybrid system, enforced)

All changes are made in `packages/ui/src/tokens/tokens.ts`, then run through `pnpm tokens:build` to regenerate `tokens.css`. The contrast tests in `tokens/contrast.test.ts` are extended to the new pairs.

- **Colour roles** (light and dark):
  - `hairline-soft` replaces the ad-hoc `/40` and `/60`, and must be contrast-checked;
  - `band` and `band-strong` replace the card strip tints `bg-control/20` and `/40`;
  - `scrim` gets used (it has 0 uses now);
  - `success-fill` replaces `#34C759`;
  - fix light `attention-subtle`, which is currently identical to `attention`;
  - replace `attention-wash`/`text` usage with `InlineNotice`.
- **Typography: one Console ramp, refined.** It replaces about 20 ad-hoc sizes. Every role is a composite token (size, line height, tracking and weight together), so no page sets tracking or leading by hand.

  | Role | Token | Spec (Geist unless noted) | Use |
  |---|---|---|---|
  | Page title | `title-page` | 26/32, −0.022em, 500 | one `h1` per page |
  | Section | `title-section` | 17/24, −0.012em, 500 | section and card-group headings (`h2`) |
  | Card title | `title-card` | 15/20, −0.006em, 500 | card and panel headings (`h3`) |
  | Body | `body` | 14/20, 0, 400 | default Console text (dense desktop) |
  | Body small | `body-sm` | 13/18, 0, 400 | secondary lines, table meta |
  | Label | `label` | 12/16, +0.01em, 500 | field labels, table headers |
  | Overline | `overline` | 11/14, +0.06em, 500, uppercase | label-over-value in cards, rail group labels; never a sentence |
  | KPI | `num-kpi` | JetBrains Mono 30/36, −0.03em, 500 | metric figures |
  | Figure | `num` / `num-sm` | Mono 14/20 and 12/16 | table and inline numbers |

  - **Rules.**
    - All numbers are mono with tabular figures, and `KES` is set in `label` at `ink-subtle`.
    - Only three text colours are used: `ink`, `ink-muted`, `ink-subtle`. **No opacity on text.**
    - Descriptions are capped at 68ch, with `text-wrap: balance` on titles and `pretty` on paragraphs.
    - The heading order `h1` → `h2` → `h3` is strict (Metric and Card take a heading-level prop).
    - Weights stay at 500 or below (docs/06 holds).
  - **Changes elsewhere.**
    - The Floor and Counter tokens stay as they are; the Console ramp is namespaced so those surfaces are untouched.
    - `text-[10px]`, `[11px]` and `[17px]`, `tracking-wider` and `text-title-sm/md` all map onto this ramp.
    - docs/06 §3 is rewritten with the ramp, and it replaces the "never below 13px" rule with "only `overline` and `num-sm` go below 13px".
- **Radius:**
  - `card` 16px (an alias of `lg`), `overlay` 20px, and `pill` for count badges and segmented controls only;
  - status chips stay `sm` per docs/06 §6.8.
- **Elevation** (the hybrid exception, documented):
  - `shadow-card` and `shadow-card-hover`: light values are built from frost-950 alpha inside tokens.ts; dark is `none`, with hover handled by a `hairline` step;
  - `shadow-popover` for menus.
  - No `rgba` in class strings ever again.
- **Motion:**
  - expose durations and easings as utilities: `transition-hover` (160ms), `transition-card` (240ms plus `ease-standard`), and a `lift` utility (`translateY(-2px)` on hover, turned off under reduced motion);
  - replace the roughly 68 uses of `duration-150/200/300`.
- **Layout:** add a `z-*` scale (rail, topbar, popover, overlay, toast) and a `max-w-console` container.
- **Dark mode:** add `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));` in `base.css`, which fixes `shell.tsx:137`.
- **Recipes as utilities** in `base.css`: `@utility card-surface`, `card-band` and `micro-label`, so class strings stay short and consistent.
- **Guardrails** (`packages/config/eslint-plugin`, `scripts/`):
  - `check-classes` must reach **0** and stays in CI;
  - a new rule bans opacity modifiers on text colours (`text-ink-*/NN`), so type hierarchy comes only from the three ink roles;
  - a new rule, `bliss/no-arbitrary-design-values`, bans `text-[`, `shadow-[`, `rounded-[`, `tracking-[` and `p-/m-/gap-[` in `app/(console)` and `packages/ui`, while still allowing `grid-cols-[…]` and `w-[…]` layout templates;
  - `one-pane` understands the Card family (a band inside a card is allowed; a card inside a card is not), and also catches `bg-x/NN` and `ring-1` borders;
  - fix the `no-cross-module-schema` regex.
- **Docs:**
  - rewrite docs/06 §1 and §5 for the hybrid Pane/Card model;
  - rewrite `.agents/rules/ui-guidelines.md` so it points to primitives and tokens, with no arbitrary classes;
  - add the `docs/11-design-drift.md` that the code already references, or remove those references;
  - add `docs/19-console-system.md`: the primitive catalogue, which family each page uses, and a definition-of-done checklist.

## Phase 3: Primitive library (`packages/ui/src/components/console/*`)

Consolidate the library, then delete the duplicates.

| Primitive | Replaces / notes |
|---|---|
| `Card` + `Card.Header` (band), `Card.Body`, `Card.Stats`/`Stat`, `Card.Footer` (band-strong); `interactive` and `href` props render a real `<Link>` | `ConsoleBentoCard`, the shells of `Metric` and `MetricTile`, the DataTable grid card, the bills/open-tabs/staff/zoning cards (fixes the `div onClick` with no keyboard or middle-click support) |
| `Panel` (flat, one-pane) + `SectionHeader` | the unused `SectionHeading` and `SectionHeader`, and hand-rolled h2 + rule headers (sync, audit, product detail) |
| `Overline` (label-over-value), `Separator` (optional label), `MetaRow`, `SummaryStrip`, `KeyValueList` (`<dl>`), `LedgerList` (hairline rail) | about 75 micro-label copies, 7 gradient separators, 6 hand-rolled `<dl>`s, the `TotalRow` in bill detail |
| `DetailHeader` (back link, title, status, meta, actions) + a detail layout mode that hides the section tabs | the double headers on bill, tab, receipt, product and GRN pages |
| `Button` (sm32/md40/lg48, variants incl. `pill`) + a shared `buttonClass()` used by `ButtonLink`; `IconButton` (requires `aria-label`) | `ButtonLink`'s separate sizes and shadows, 3 copies of the hand-rolled "Add" pill, 22 raw `<button>`s |
| One `Tone` type (`packages/ui/src/lib/tone.ts`); `StatusChip`, `Badge`, `CountBadge` | 9 separate tone enums, 6+ hand-rolled chip recipes |
| `Select` (native `SelectField` for forms; an accessible listbox for filters), `Switch`, `Segmented` (roving tabindex and arrow keys), `Tabs` (URL-backed via `console/url-state.ts`) | the GRN `CustomSelect`, the DataTable inline switch, the ThemeToggle copy, the Dynamics `useState` tabs |
| `Toolbar`/`FilterBar` | DataTable internals, the Dynamics control deck, the sales filter strip |
| `Overlay` on tokens (no inline glass), `ImageLightbox` on `Overlay` | 2 hand-rolled lightboxes with no Escape key, focus trap or label |
| Skeletons: `CardSkeleton`, `MetricRowSkeleton`, `TableSkeleton` | loading states that don't match the real layouts |

**DataTable** (`data-table.tsx`, 814 lines) splits into `data-table/{index,table,row,toolbar,filters,pagination,grid}.tsx`.
- **Layout:** `overflow-x-auto` scroll instead of clipping (`:628`); grid view uses `Card`.
- **Accessibility:**
  - one tab stop per row;
  - `aria-rowindex` offset by the page;
  - correct listbox and checked semantics in `FilterDropdown`;
  - visible focus rings (`:251,274,514`);
  - `desktop:focus-within:opacity-100` for row actions.
- **Fixes:** a per-table `emptyFilteredMessage` prop; fix the invalid `rgba(var(--color-accent)…)` shadow (`:154,537`).

**Smaller fixes**
- `money.tsx:56`: add sr-only text so screen readers read the amount.
- `Metric` gets a heading-level prop.
- `csv.ts` guards against formula injection.
- Low-contrast `text-ink-subtle/30…70` and the top-bar `text-ink-disabled` icon get fixed.

**Cleanup**
- Remove dead exports: `toast.tsx` (duplicates `notices.tsx`), `glassClass`, `PaneLink`, `SeatLabel`, `MoneyFigure`, and so on.
- Complete the `index.ts` barrel.

**Gallery.** Add a dev-only primitive gallery at `app/(console)/console/(shell)/_kit/page.tsx`, gated by `devDataEnabled`. It renders every primitive in both themes and is used for visual QA.

## Phase 4: Console shell redesign (sidebar, top bar, page frame)

The current shell is a template with polish sprayed on: glass, blurred colour blobs, gradient sheens, pills in pills, a generic wordmark, slug breadcrumbs and invented footer text. The rebuild aims for a quiet, exact, **venue-first** frame, in the spirit of Linear, Stripe or Things. It stays flat, per the Pane family: structure comes from alignment, a single hairline and one tonal step, never from effects.

### 4.1 One navigation manifest
- Add `app/(console)/console/(shell)/_lib/nav.ts` as the **single source** for every workspace and sub-page. Each entry holds:
  - the label, href and icon;
  - the group;
  - the required permission, so items the actor can't use are hidden;
  - a count source;
  - search keywords.
- The rail, the route tabs, the breadcrumbs, the command menu and each page's `metadata.title` all read from it. This ends the drift between "People" and "People & Zoning", and between "Pour-variance" and "Pour variance".
- Counts come from the version-memoised selectors in 1.8.

### 4.2 Sidebar (`packages/ui/src/components/console/shell.tsx` → `console/rail/*`)
- **Structure**, 240px wide, on a flat `bg-rail` surface (one tonal step off the page) with one hairline on its right edge. No glass, no blobs, no gradients.
  1. **Venue block**, 56px, aligned to the top bar.
     - The Bliss mark at 20px, then **Cool Bliss Spot** in `title-card`.
     - Under it, a quiet business-day line in `body-sm`, for example `Fri 25 Sep · Trading since 16:02` with a 6px poured dot, or `Closed · opens 16:00`.
     - This replaces the "bliss console" wordmark and the top bar's Live/Closed pill.
  2. **Search and jump**: a full-width field-styled button reading `Search or jump to…` with a `⌘K` hint that opens the command menu (4.4).
  3. **Workspace groups**, with `overline` labels named for the job:
     - **Service**: Overview, Trade;
     - **Stock**: Inventory, Purchasing;
     - **Menu**: Catalogue, Pricing;
     - **Business**: Reports, People.
  4. **Settings**, pinned above the account row.
  5. **Account row**: avatar, name and role. It opens an account menu with:
     - the theme (Light / Dark / System);
     - Open Floor station and Open Counter station, moved here from the rail body;
     - Sign out, which wires in the unused `signOutFromConsole`.
     - The invented "KES · VAT incl. / Station #1" line is deleted.
- **Item anatomy** (built on tokens):
  - 32px high with an 8px inset, a 16px icon at stroke 1.5, and the label in `body`;
  - **resting:** `ink-muted`;
  - **hover:** `bg-rail-hover`;
  - **active:** `bg-rail-active` with `ink` text, the icon in `accent-text`, and a 2px accent indicator on the leading edge. No shadow and no sheen.
  - **Counts** are right-aligned `num-sm` numbers in `ink-subtle`. Only states that need action carry a tone, as a 6px dot plus the number: Inventory holds and counts in review are *attention*; Settings sync conflicts are *stop*.
- **Collapse:** the rail folds to a 64px icon rail, with a tooltip for each item. The state persists in a cookie, rendered on the server with no flash, and `[` toggles it. This buys width for tables at 1280px.
- **Accessibility:**
  - `nav` landmark, `aria-current`, and a visible focus ring on every item;
  - keyboard navigation within the list;
  - reduced motion respected on the collapse.

### 4.3 Top bar (`_components/top-bar.tsx` → `console/top-bar/*`)
- 56px on a flat page surface with a bottom hairline that only appears once the page has scrolled (a scroll-driven token). No glass.
- **Left: breadcrumbs from the manifest.**
  - Format: `Trade / Bills / B-0142`.
  - Record crumbs are supplied by detail pages through a `<Crumb label=…>` slot (a context set by the page), so detail pages show the record, not the id slug.
  - Every crumb except the last is a link.
- **Right: a quiet status cluster.** It shows what matters and stays silent when all is well.
  - **Stations:** `4 of 5 stations online`. Clicking opens a popover listing each device with its last-seen time and unsynced count, plus a link to Settings › Devices. When a device is holding orders it turns *attention* and reads `2 orders waiting on Floor 2`.
  - **Sync:** shown **only when degraded** (sending, offline or unreachable), with the docs/08 copy. It replaces the connection-chip styling hack that overrides `[&_.text-body]`.
  - **Refresh:** removed as a button. Data refreshes through `router.refresh()`, available in the command menu and on a `R` shortcut, never a full `window.location.reload()`.

### 4.4 Command menu (new primitive `console/command-menu.tsx`, built on `Overlay`)
- Opened with `⌘K` or `Ctrl K`, or from the rail's search button. It has three groups:
  - **Go to:** every manifest entry.
  - **Find:** a tab, bill, receipt, product or staff member by number or name, through a server action with a cap on results.
  - **Do:** Receive goods, Start a count, Add staff, Place a hold, Switch theme, Refresh data.
- The listbox follows the full ARIA combobox pattern, with recent items at the top.

### 4.5 Page frame (`PageHeader`, `RouteTabs`, `ConsolePage`)
- **Header:** a `title-page` title and a single-sentence description in `ink-muted` (68ch), with actions right-aligned. **No eyebrows** (remove the `eyebrow` prop).
- **Workspace sub-navigation:** underline tabs on a full-width hairline, sticky under the top bar once the page scrolls. The active tab has a 2px `ink` underline. Counts are `num-sm`. This replaces the pill-in-pill `RouteTabs`.
- **Content:** a `max-w-console` container (1440px) with 32px gutters at desktop and a single vertical rhythm of 32px between sections and 16px within them.
- **Detail pages:** a detail layout mode with **no workspace tabs**. They use `DetailHeader`: a back link to the list (with filters kept), the record title, a status chip, a meta row and actions. This fixes the double headers and the unhighlighted tabs on `/trade/tabs/*`.
- Add a skip-to-content link.
- The top bar keeps its purpose-built role; page headers are not repeated inside it.

### 4.6 Below 1280px (the desktop-only decision)
- The rail auto-collapses to icons below 1280px.
- Below 1024px the page scrolls horizontally inside a `min-w-desktop` frame rather than crushing. No mobile drawer.

### 4.7 Boundaries
  - `not-found.tsx` in the console, since six detail pages call `notFound()`;
  - per-workspace `error.tsx`;
  - the missing `people/loading.tsx`;
  - every `loading.tsx` rebuilt from the Phase 3 skeletons to match its page.
- **Theme:** the account menu applies the theme optimistically and persists it to the cookie. A `System` option follows `prefers-color-scheme`.

### 4.8 Shell tokens (added in Phase 2)
- **Colour:** `rail`, `rail-hover`, `rail-active`, `rail-indicator`.
- **Size:** `h-bar` (56px), `w-rail` (240px), `w-rail-collapsed` (64px).
- **Motion:** `transition-rail`.

## Phase 4b: Copy (production voice across the Console)

The docs/08 voice and terminology lock already exist; the Console ignores them. Copy is treated as a first-class deliverable.

- **The rules** (added to docs/08 as a "Console" section).
  - Titles are nouns people use at the bar: Overview, Bills, Open tabs, Stock, Receive goods. Not "Executive Overview" or "Tender Settlement Mix".
  - Descriptions are one sentence saying **what the page answers or lets you do**, never how the system works. Mechanics move into a "How this is worked out" disclosure, or into docs.
  - Labels are sentence case, with no ALL CAPS literals; uppercase only comes from `overline` styling. They use the locked terms: Tab, Seat, Line, Bill, Tender, Variance, Write-off, Void, Drawer session, Business day.
  - Buttons are a verb plus an object, carrying the amount or count where money or a batch is involved: `Receive 12 lines`, `Commit count`, `Add staff`.
  - Empty, filtered, error and loading states each get specific copy for their table: `No bills yet tonight`, `No bills match these filters. Clear filters`.
  - Errors follow docs/08: what happened, then what to do. They come from `DomainError` messages written in that voice, and internal messages never reach the UI.
  - No invented placeholders. Every figure or label on screen is real or absent.
- **A rewrite table** goes into docs/19 as the reference, with every current string mapped to its replacement. Examples:

  | Now | Becomes |
  |---|---|
  | Executive Overview / OPERATIONAL INTELLIGENCE · VENUE OVERVIEW | Overview (description: `Last night at a glance, and what needs you now.`) |
  | Exceptions requiring operational clearance | Needs attention |
  | Tender Settlement Mix / How guests settled payments at the counter | Tender mix |
  | Recent Tariff Adjustments / Audit log of authorized price revisions… | Recent price changes |
  | Venue legal identity, cutover, and operating parameters | Outlet (description: `Name, tax details and when the business day ends.`) |
  | Total Leakage / Unclosed Sales Alert | Variance at cost / Tabs open past close |
  | Vendors to Order / Units Rejected / Returned | Suppliers to order from / Rejected |
  | eTIMS KRA Ref, eTIMS queue | Removed. KRA eTIMS is out of scope (docs/00); the GRN field becomes `Supplier invoice number` |
  | Reload Console Data / View Full Size / Receive Goods | Refresh data / View full size / Receive goods |

- **The same pass also covers:**
  - aria-labels and `title` attributes;
  - `metadata.title` for every route;
  - the print receipts reached from the Console;
  - code comments that are marketing ("Apple-grade", "executive operational command dashboard"), rewritten as plain engineering notes.
- **Enforcement:** `scripts/check-copy.mjs` runs in `pnpm lint` and flags:
  - the docs/08 banned phrases (Oops, Please, Kindly, Invalid, Submit, "Something went wrong", "Loading...");
  - locked-term violations (Delete for a line, Pay, Checkout, Receipt used to mean a bill);
  - ALL CAPS string literals;
  - Title Case in `title=`, `label=`, `description=` and `aria-label=`;
  - em dashes, since `no-em-dash-or-emoji` already exists.

## Phase 5: Page migration (workspace by workspace, one commit each)

Each page moves onto the primitives and its family:
- **Pane:** tables, forms, settings.
- **Card:** overview, dashboards, grid views, detail pages.

Every page must meet the docs/19 definition of done:
- zero arbitrary design values and zero dead classes;
- the Console type ramp only, with a strict heading order;
- copy rewritten to the Phase 4b rules and the docs/19 rewrite table: sentence case, locked terms, one-sentence descriptions, specific empty and error states, and no em dashes (`receipts/[receiptId]`, `receipt-detail`, `open-tabs-table`);
- four table states (loading, empty, filtered-empty, error);
- keyboard reachable; light and dark verified.

Order, from most to least revamped, so the reference pages harden first:

1. **Trade:** bills, open, bill and tab detail, drawers, shifts. This is the reference.
   - Remove the duplicate settled time.
   - Keep row actions and totals in grid view.
   - Fix the `'tonight'` default that isn't an option (`bills/page.tsx:39`).
   - Metric rows become 4-up at desktop.
2. **Overview:** normalise spacing to one rhythm (a `gap-24` section stack) and remove the 6 unused imports.
3. **People:** staff (flexible card height, hover lift, a read-only state when `!canManage`), zoning, roles, and the dialogs (two-column via `desktop:` grids, `InlineNotice` errors).
4. **Purchasing:**
   - decompose the 901-line `grn-intake-form.tsx` into `select`, `media-uploader`, `line-editor`, `sticky-summary` and `lightbox` parts on the primitives;
   - the sticky bar is positioned by the layout, not `ml-rail-console`;
   - receipt detail, orders, suppliers, reorder.
5. **Inventory:** stock, counts (`count-stages` overflow), movements, holds, recipes.
6. **Catalogue:** products, product detail, categories (the hand-rolled table becomes DataTable), modifiers.
7. **Pricing:** lists, rules.
8. **Reports:**
   - decompose the 984-line `dynamics-dashboard.tsx` into `control-deck`, `pnl`, `owner-questions` and `sku-quadrants`;
   - URL-backed `Tabs`;
   - drop its own `max-w-[1400px]`;
   - sales, seats, voids, pour variance, dead stock.
9. **Settings:** outlet (row padding), devices, sync, audit.

## Phase 6: Verification & hardening

**Unit tests (vitest)**
- Session sign, verify and expiry; the PIN hash; the rate limiter.
- Upload sniffing and limits.
- `defineAction` rejects bad input and doesn't leak errors.
- Identity role guards.
- Zone and table validation, plus the sync-version bump.
- `receive()` rules and idempotency.
- Audit ordering.
- Dynamics figures against `headline()`.
- CSV escaping.
- The nav manifest: every route has an entry, and permission filtering works.
- `check-copy` passes over the whole Console.
- A store test asserting that `recordCounted` produces a tracked, persisted row.

**Playwright smoke** (the pre-installed Chromium): sign in; visit every Console route at 1440×900 in light and dark mode; assert no console errors and no horizontal page overflow; save screenshots for visual review. Also covers shell behaviour: rail collapse persists, `⌘K` opens the command menu, breadcrumbs show record names, and the account menu signs out. Covers the create-staff, zoning-edit, GRN-submit (double-click leaves one receipt), count-record and reload flows.

**Final gate:** `pnpm ci` (tokens:check → typecheck → lint with 0 dead classes and 0 arbitrary values → test → build → budget) passes end to end. Then push to `claude/great-curie-mgu2kh`.

## Critical files
- **Auth and actions:**
  - `modules/identity/service.ts`
  - `app/(console)/console/sign-in/*`
  - `app/(console)/console/(shell)/_actions.ts` → `_actions/*` + `_lib/action.ts`
  - `lib/dev.ts`
  - `app/api/dev/*`, `app/api/upload/route.ts`
  - `lib/pos/api.ts`, `lib/pos/session.ts`
- **Domain:**
  - `modules/procurement/service.ts`
  - `modules/inventory/service.ts`
  - `modules/trade/service.ts`, `modules/trade/commands.ts`
  - `modules/audit/service.ts`
  - `modules/reporting/dynamics.ts`
  - `modules/_data/store.ts`
- **Design:**
  - `packages/ui/src/tokens/tokens.ts`, `packages/ui/src/styles/base.css`
  - `packages/ui/src/components/console/*`
  - `packages/ui/src/components/{button,button-link,badge,status,overlay,money,fields}.tsx`
  - `packages/config/eslint-plugin/rules/*`, `scripts/check-classes.mjs`
  - docs/06, `.agents/rules/ui-guidelines.md`, new docs/19.
- **Shell:**
  - `(shell)/layout.tsx`, new `(shell)/_lib/nav.ts`
  - `packages/ui/src/components/console/{shell,rail/*,top-bar/*,command-menu}.tsx`
  - `_components/{top-bar,theme-toggle}.tsx`
- **Copy:**
  - `(shell)/_lib/labels.ts`
  - docs/08 (new Console section)
  - new `scripts/check-copy.mjs`

---

## Progress

Done on `claude/great-curie-mgu2kh`, one commit per step. KRA eTIMS stays out of scope (docs/00).

- [x] 0. Baseline: install, record `pnpm ci` output
- [x] 1.1 Console session: signed, 12 hours, re-checked on every request, no fall back to an owner
- [x] 1.2 PINs: scrypt hashes, never sent to a browser, attempts limited and audited
- [x] 1.3 Station API: signed station tokens, the staff id from the token, approval tokens verified
- [x] 1.4 Uploads: a session and a permission, bytes sniffed, stored outside `public/`, served through a route
- [x] 1.5 Action layer: `runAction` with a zod schema for every field, safe errors, request ids
- [x] 1.6 Domain fixes: role guards, zone and table rules, sync bumps, one delivery path, FEFO, audit order
- [x] 1.7 Honest reporting: `performance.ts` replaces `dynamics.ts`; nothing invented, uncosted sales shown as such
- [x] 1.8 Shell performance: indexes and memoised counts
- [x] 1.9 Store concurrency: write state on the global, catch-up serialised
- [x] 2 Tokens, type ramp, guardrails, docs
- [x] 3 Primitive library, DataTable split, gallery at `/console/kit` (development data only)
- [x] 4 Shell redesign (manifest, rail, top bar, command menu, page frame, boundaries)
- [x] 4b Copy rules, rewrite table, check-copy
- [x] 5.1 Trade
- [x] 5.2 Overview
- [x] 5.3 People
- [x] 5.4 Purchasing
- [x] 5.5 Inventory
- [x] 5.6 Catalogue
- [x] 5.7 Pricing
- [x] 5.8 Reports
- [x] 5.9 Settings
- [x] 6 Tests, Playwright smoke, lint at zero across every surface, `pnpm ci`

Follow-ups, deliberately left for later: object storage for uploads; rent, power and wages as outlet
settings, so Performance can show an operating result without estimating; a Playwright suite in the
repository (the smoke run in this pass used the preinstalled browser from a scratch script).
