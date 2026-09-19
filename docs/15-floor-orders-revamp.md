# Floor orders revamp: specification, design tokens, order cards, and action modal

Status: built and verified. Baseline: floor orders surface revamp following [12-surface-language.md](12-surface-language.md) and [13-floor-tabs-revamp.md](13-floor-tabs-revamp.md). Extends the tactile Bliss surface language to the live kitchen/bar order fulfillment pipeline on the Floor.

Scope: the Floor Orders screen (`/floor/orders`), dynamic bento-grid card layout, responsive order cards, distinct semantic state tokens (`served` vs. `poured`), high-contrast hero delivery actions, and the full-width Order Action Modal (`OrderActionSheet`).

---

## 1. Concept and Service Flow

On the floor, waiters carry tablets across dimly lit rooms. The service flow for orders is:
1. **Fired**: A waiter fires drinks or food from the table tab to the bar or kitchen (`at_bar`).
2. **Poured / Ready**: The bartender or kitchen prepares the round and marks it poured (`poured`).
3. **Delivered / Served**: The floor waiter delivers the poured drinks to the table and marks the order served to guests (`served`).
4. **Attention / Needs You**: If a variant runs out at the counter, the order requires floor waiter intervention (`needs_you`).

Previously, both `poured` and `served` shared green tokens, obscuring whether drinks were still sitting at the pickup station or already enjoyed at the table. The revamp establishes clear chromatic distinction, tactile ticket geometry, and streamlined one-tap delivery actions.

---

## 2. Design Tokens: Served vs. Poured

A new first-class signal token was created in `packages/ui/src/tokens/tokens.ts` and generated into `tokens.css`:

| State | Semantic Key | Dark Theme Hex | Light Theme Hex | WCAG Contrast | Visual Meaning |
|---|---|---|---|---|---|
| **Poured** | `poured` | `#63B98A` (Mint Emerald) | `#2E7D52` (Deep Forest) | 8.04:1 on page | Ready at bar counter for pickup |
| **Poured Wash** | `poured-wash` | `color-mix(poured 12%)` | `color-mix(poured 8%)` | -- | Background wash for ready state |
| **Served** | `served` | `#7FA8E0` (Azure Blue) | `#235896` (Navy Blue) | 7.92:1 on page | Delivered to guests at table |
| **Served Wash** | `served-wash` | `color-mix(served 12%)` | `color-mix(served 8%)` | -- | Background wash for served tickets |
| **At Bar** | `accent` | `#6FC6D6` (Glacier Cyan) | `#1F6E82` (Teal) | > 7:1 on page | Actively being prepped |
| **Needs You** | `stop` | `#E08585` (Coral Red) | `#A33232` (Crimson) | > 7:1 on page | Stock ran out / conflict |

Verified by `packages/ui/src/tokens/contrast.test.ts` (50/50 automated contrast tests passing).

---

## 3. Order Card Architecture (`order-card.tsx`)

The order card is the hero object on the `/floor/orders` surface.
- **Dynamic Bento Grid**: Adapts to varying ticket line counts (single-drink quick fires vs. 14-line group banquet rounds).
- **Seat Chip Multiplier Separation**: Clear visual rhythm `[SeatChip] [Qty×] [Item Name & Modifiers]`.
- **Badge Primitive Integration**: All line items consume the `@bliss/ui/components/badge` primitive rather than ad-hoc spans.
- **Differentiated Glow & Borders**:
  - `poured`: Mint Emerald border and soft glow (`border-poured/45 shadow-[0_0_18px_color-mix(in_oklab,var(--color-poured)_16%,transparent)]`).
  - `served`: Azure Blue border (`border-served/40 shadow-[0_0_18px_color-mix(in_oklab,var(--color-served)_14%,transparent)]`).
- **One-Tap Mark Served Action**: High-contrast button in `bg-poured text-page font-medium` (dark charcoal icon and typography on bright mint background, resolving the invisible green-on-green text bug).
- **Preserved `flex-col` Layout**: Total label and amount stack vertically (`flex flex-col items-baseline gap-6`), and delivery status stacks above the `View tab` trigger (`flex flex-col items-end gap-4`).

---

## 4. Order Action Modal Console (`OrderActionSheet`)

Triggered on long-press or card action button. Completely revamped to eliminate generic SaaS slop in favor of a tactile floor management console.

### Geometry & Working Room
- Desktop width upgraded to `width="lg"` (`w-[min(720px,calc(100vw-48px))]`) with `desktop:!w-[760px] desktop:max-w-[760px]`.
- Provides ample horizontal breathability for multi-seat banquet tickets.

### Sunken Ticket Well
- Outer container: `bg-sunken/80 border border-rule-raised/30 shadow-inner rounded-[20px]`.
- Sub-headers and footers: `bg-sunken/50 border-b border-rule-raised/25 px-18 py-12`.
- Scroll viewport: `max-h-[280px] desktop:max-h-[330px]` with `divide-y divide-rule-raised/20 px-12 py-6`.
- Decoupled tabular quantity multiplier (`w-[32px] text-center`) with `gap-12` spacing.
- Columnar price alignment (`min-w-[76px] text-right`) and equalized status badges (`min-w-[80px] justify-center`).

### Contextual Hero Controls
- **When Poured**: Full-width glowing hero card in Azure Blue (`bg-served text-page font-medium shadow-[0_6px_28px_color-mix(in_oklab,var(--color-served)_35%,transparent)]`) reading **"Mark served to table"**.
- **When Served**: Settled confirmation banner with single-tap **"Undo delivery"** button.
- **When At Bar**: Full-width hero action in Mint Green (`bg-poured text-page font-medium`) reading **"Mark order poured"**.
- **Table Batch Action**: *"Mark all orders for this table served"* with `IconChecks` to deliver every open order for that table in one go.
- **Shortcuts**: Two-column quick-access tiles to *"Open tab & bill"* and *"Move tab"*.
- **Exception Section**: Distinct bottom row separated by a hairline for *"Void or swap items on tab"* in `text-stop`.

---

## 5. House Rules and Linter Conformance

- **`bliss/max-font-weight`**: Strictly enforced; no `font-semibold` or weights exceeding 500 anywhere.
- **`bliss/one-pane`**: Only one level of depth; buttons and cards inside the `<Sheet>` avoid nested `bg-raised` or nested full-box borders, utilizing single hairlines (`border-t`), wash tints, and `hover:bg-control-hover`.
- **`check-styles.mjs`**: Confirmed 100% token usage across all modified stylesheets and components.

---

## 6. Bridge to the Floor Shift Revamp (`/floor/shift`)

With the floor tabs (`/floor/tabs`) and floor orders (`/floor/orders`) surfaces fully overhauled, the next surface in the floor waiter workflow is the **Floor Shift Screen** (`/floor/shift`).

Key requirements for the Shift screen revamp:
1. **Live Shift Telemetry**: Total sales volume, covers/guests served, active open tabs under waiter care, and uncollected tips.
2. **Break / Active Status Toggle**: Smooth tactile toggle for waiter rest breaks and floor return.
3. **Cash Float & Drawer Reconciliation**: Clear breakdown of cash collected vs. recorded tenders without fiscal fluff.
4. **Handover & End of Shift**: Shift handover protocol transferring open tabs to colleague waiters with PIN validation.
