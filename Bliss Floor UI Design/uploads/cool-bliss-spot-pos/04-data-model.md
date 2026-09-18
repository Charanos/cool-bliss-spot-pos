# Data model, Bliss

Version 1.0
Neon Postgres 16, Drizzle ORM
52 tables across seven domains

---

## Conventions applied to every table

| Convention | Detail |
|---|---|
| Primary key | `id uuid` (UUIDv7), generated client-side wherever a client can create the record offline |
| Outlet scope | `outlet_id uuid not null` on every transactional table, enforced by a repository base class and a CI test |
| Money | `bigint`, KES cents, column suffix `_cents`. Never a float, never nullable where a value is required. |
| Quantity | `numeric(14,4)` for volumes in millilitres and fractional units, `integer` for whole units |
| Timestamps | `timestamptz`, UTC in storage, `Africa/Nairobi` at the presentation boundary |
| Business day | `business_date date not null`, computed at write time, never recomputed on read |
| Soft state | A `status` enum plus `archived_at`. The application role has no DELETE grant. |
| Provenance | `created_by`, `created_at`, `updated_by`, `updated_at`, and `device_id` where a device originated the row |
| Reason | Any row representing a void, discount, write-off, hold, override or adjustment has `reason text not null check (length(reason) >= 10)` |

---

## Domain 1, identity and organisation (7 tables)

### `outlets`
`id`, `name`, `legal_name`, `timezone` (default `Africa/Nairobi`), `business_day_cutover time` (default `05:00`), `address`, `currency` (default `KES`), `tax_rate_bps int` (reporting only, no fiscal transmission), `prices_tax_inclusive bool` (default true), `low_stock_default int`, `drawer_variance_threshold_cents bigint`, `status`.

One row at launch. It exists because a second outlet should be a row, not a migration.

### `staff`
`id`, `outlet_id`, `full_name`, `display_name`, `phone`, `email`, `pin_hash` (Argon2id), `password_hash` (nullable, Console only), `totp_secret_encrypted` (nullable), `role_id`, `employment_status`, `pin_locked_until`, `failed_pin_attempts`, `colour_index int`, timestamps.

`display_name` is what appears on a ticket and a bill. `full_name` is what appears in an employment record. Two columns, deliberately.

### `roles`
`id`, `key` (`owner`, `manager`, `supervisor`, `cashier`, `waiter`, `stock_controller`), `name`, `is_system bool`.

### `permissions`
`id`, `key`, `description`, `domain`.

Keys in use: `cost.read`, `price.write`, `void.approve`, `discount.approve`, `hold.set`, `stock.count.commit`, `stock.writeoff`, `drawer.close`, `refund.approve`, `staff.manage`, `device.manage`, `report.margin`, `export.run`.

### `role_permissions`
`role_id`, `permission_id`. Composite primary key.

### `devices`
`id`, `outlet_id`, `label` (`Floor 3`), `kind` (`floor`, `counter`, `bar`, `console`), `fingerprint_hash`, `public_key`, `enrolled_at`, `enrolled_by`, `last_seen_at`, `last_event_seq bigint`, `app_version`, `status` (`active`, `suspended`, `lost`, `retired`), `revoked_at`, `revoked_reason`.

### `auth_sessions`
`id`, `staff_id`, `device_id`, `refresh_token_hash`, `family_id`, `issued_at`, `expires_at`, `rotated_from` (self reference), `revoked_at`, `revoke_reason`, `ip`, `user_agent`.

Reuse of a rotated refresh token revokes the entire `family_id`.

---

## Domain 2, catalogue and pricing (9 tables)

### `categories`
`id`, `outlet_id`, `parent_id` (nullable), `name`, `sort_order`, `routing_target` (`bar`, `kitchen`, `none`), `colour_token` (a design token key, never a hex value), `track_stock bool`, `status`.

### `products`
`id`, `outlet_id`, `category_id`, `name`, `brand`, `sku`, `barcode`, `container_volume_ml numeric` (nullable), `abv numeric(4,2)` (nullable), `is_sold_sealed bool`, `is_sold_by_serve bool`, `low_stock_threshold int` (nullable, falls back to the outlet default), `reorder_point numeric`, `reorder_qty numeric`, `lead_time_days int`, `default_supplier_id`, `status`.

A product can be both sealed and by-serve. That dual nature is the whole reason the bar and the bottle counter share one stock pool.

### `product_variants`
`id`, `outlet_id`, `product_id`, `name` (`Bottle 750ml`, `Double`, `Tot`, `Glass 175ml`), `kind` (`sealed`, `serve`), `serve_volume_ml numeric` (nullable for sealed), `depletion_factor numeric`, `barcode`, `is_default bool`, `sort_order`, `status`.

`depletion_factor` is stored rather than computed, so a deliberately generous house pour is modelled honestly instead of showing as permanent variance.

### `modifier_groups`
`id`, `outlet_id`, `name` (`Mixer`, `Ice`, `Glass`), `min_select`, `max_select`, `is_required bool`, `sort_order`, `status`.

### `modifiers`
`id`, `modifier_group_id`, `name`, `price_delta_cents bigint`, `linked_variant_id` (nullable, so a mixer depletes real stock), `sort_order`, `status`.

### `variant_modifier_groups`
`product_variant_id`, `modifier_group_id`, `sort_order`. Composite primary key.

### `price_lists`
`id`, `outlet_id`, `name` (`Standard`, `Happy hour`, `Staff`, `Counter`), `kind` (`base`, `overlay`), `priority int`, `effective_from`, `effective_to`, `status`.

### `price_list_items`
`id`, `price_list_id`, `product_variant_id`, `price_cents bigint`, `min_qty numeric` (nullable, for case pricing at the bottle counter), `status`. Unique on `(price_list_id, product_variant_id, min_qty)`.

### `price_rules`
`id`, `outlet_id`, `name`, `price_list_id` (the overlay to apply), `days_of_week int[]`, `start_time`, `end_time`, `crosses_midnight bool`, `applies_to` (`all`, `category`, `product`, `variant`), `target_ids uuid[]`, `priority`, `effective_from`, `effective_to`, `status`.

---

## Domain 3, inventory and availability (10 tables)

### `stock_locations`
`id`, `outlet_id`, `name` (`Store`, `Bar shelf`, `Cold room`, `Counter`), `kind` (`store`, `service`, `retail`), `is_default_receipt bool`, `is_default_sale bool`, `status`.

### `stock_movements`
The spine. Append only.

`id`, `outlet_id`, `business_date`, `product_variant_id`, `stock_location_id`, `qty_delta numeric(14,4)` signed, `volume_delta_ml numeric` signed, `unit_cost_cents bigint` (moving average at the time of movement), `movement_type`, `source_type`, `source_id`, `reason`, `occurred_at`, `created_by`, `device_id`.

`movement_type`: `receipt`, `sale`, `sale_reversal`, `transfer_out`, `transfer_in`, `write_off_breakage`, `write_off_spillage`, `write_off_expiry`, `staff_drink`, `comp`, `count_adjustment`, `return_to_supplier`, `opening_balance`.

Indexes: `(outlet_id, product_variant_id, occurred_at)`, `(outlet_id, business_date)`, `(source_type, source_id)`.

**Invariant.** No UPDATE, no DELETE. A correction is a compensating movement, never an edit.

### `stock_snapshots`
`id`, `outlet_id`, `product_variant_id`, `stock_location_id`, `as_of`, `qty_on_hand numeric`, `volume_on_hand_ml numeric`, `avg_unit_cost_cents bigint`, `rebuilt_at`.

A performance cache, rebuilt nightly and on demand. If it ever disagrees with the ledger, the ledger is right.

### `availability_state`
The derived answer to "can the floor sell this right now". Owned by the availability module, never written by anything else.

`id`, `outlet_id`, `product_variant_id`, `state` (`available`, `low`, `last_few`, `finished`), `qty_available numeric`, `threshold int`, `reason` (`stock`, `hold`, `variant_status`, `category_status`), `computed_at`, `version bigint`.

`version` is bumped on every recompute and is what the Floor compares against to detect a stale snapshot before pushing its outbox.

### `stock_holds`
Manual 86 records. A hold always outranks the computed stock figure.

`id`, `outlet_id`, `product_variant_id`, `placed_by`, `placed_at`, `reason text not null`, `expected_back` (nullable), `released_by`, `released_at`, `release_note`, `status` (`active`, `released`).

The bar knowing a bottle broke beats the ledger thinking it is full. That is the entire justification for this table.

### `pour_specs`
`id`, `product_variant_id`, `nominal_volume_ml numeric`, `tolerance_pct numeric` (default 2.0 spirits, 1.0 beer), `effective_from`, `status`.

### `recipes`
`id`, `outlet_id`, `product_variant_id` (the sold item), `name`, `yield_qty numeric`, `notes`, `status`.

### `recipe_components`
`id`, `recipe_id`, `component_variant_id`, `qty numeric`, `volume_ml numeric`, `is_optional bool`, `wastage_pct numeric`.

### `stock_counts`
`id`, `outlet_id`, `business_date`, `stock_location_id`, `kind` (`full`, `cycle`, `spot`), `is_blind bool` default true, `status` (`open`, `counting`, `review`, `committed`, `cancelled`), `opened_by`, `opened_at`, `committed_by`, `committed_at`, `total_variance_cents bigint`, `notes`.

### `stock_count_lines`
`id`, `stock_count_id`, `product_variant_id`, `expected_qty numeric`, `counted_qty numeric`, `counted_volume_ml numeric`, `variance_qty numeric`, `variance_cents bigint`, `reason`, `counted_by`, `counted_at`, `recount_of` (self reference).

**Blind count rule.** `expected_qty` is omitted from the API response until the count moves to `review`. Hiding it in the UI is not sufficient, and a test fails if the field appears in a pre-review payload.

---

## Domain 4, procurement (6 tables)

### `suppliers`
`id`, `outlet_id`, `name`, `contact_name`, `phone`, `email`, `payment_terms_days`, `lead_time_days`, `min_order_cents`, `status`.

### `supplier_products`
`id`, `supplier_id`, `product_variant_id`, `supplier_sku`, `pack_size numeric`, `last_cost_cents bigint`, `last_purchased_at`, `status`.

Powers supplier price history, and the alert when a case of beer quietly went up six per cent.

### `purchase_orders`
`id`, `outlet_id`, `supplier_id`, `po_number` (gapless per outlet), `status` (`draft`, `sent`, `partially_received`, `received`, `cancelled`), `expected_at`, `subtotal_cents`, `total_cents`, `raised_by`, `approved_by`, `approved_at`, `notes`.

### `purchase_order_lines`
`id`, `purchase_order_id`, `product_variant_id`, `qty_ordered numeric`, `qty_received numeric`, `unit_cost_cents bigint`, `line_total_cents bigint`, `status`.

### `goods_receipts`
`id`, `outlet_id`, `purchase_order_id` (nullable, direct receipts allowed), `supplier_id`, `grn_number`, `delivery_note_ref`, `received_at`, `received_by`, `stock_location_id`, `status` (`draft`, `posted`, `cancelled`), `variance_note`.

### `goods_receipt_lines`
`id`, `goods_receipt_id`, `purchase_order_line_id` (nullable), `product_variant_id`, `qty_expected numeric`, `qty_received numeric`, `qty_rejected numeric`, `rejection_reason` (required when rejected above zero), `unit_cost_cents bigint`, `status`.

Posting a receipt writes `receipt` movements and triggers an availability recompute for every affected variant.

---

## Domain 5, trade (9 tables)

### `zones`
`id`, `outlet_id`, `name` (`Terrace`, `Main bar`, `Counter`), `sort_order`, `default_price_list_id` (nullable), `status`.

### `service_tables`
`id`, `outlet_id`, `zone_id`, `label` (`T7`), `seats int` (the physical capacity, a default for guest count), `position_x`, `position_y`, `status` (`available`, `occupied`, `out_of_service`).

Named `service_tables` because `tables` collides with too many reserved contexts.

### `tabs`
`id`, `outlet_id`, `business_date`, `service_table_id` (nullable, walk-ups exist), `zone_id`, `tab_number` (gapless per outlet per business day), `name` (nullable, `Birthday`), `guest_count int`, `opened_by`, `opened_at`, `assigned_to` (current waiter, changes at handover), `status` (`open`, `part_settled`, `settling`, `settled`, `voided`, `merged_into`), `merged_into_tab_id` (nullable), `closed_at`.

### `tab_seats`
**The table that defines this product.**

`id`, `outlet_id`, `tab_id`, `seat_no int`, `label text` (nullable, max 24 chars), `colour_index int` (0 to 7, assigned by seat_no modulo 8), `status` (`active`, `settled`, `removed`), `settled_bill_id` (nullable), `settled_at`, `created_by`, `created_at`.

Unique on `(tab_id, seat_no)` where status is not `removed`.

Notes:
- Seats are created automatically when a tab opens, from `guest_count`.
- A seat may be added at any time. `seat_no` is the next unused integer, never a reused one, so a seat number is stable for the life of the tab.
- Removing a seat with lines attached is refused. The lines must be moved or voided first.
- `label` is free text and used constantly by waiters. It is never required and never validated beyond length.

### `orders`
`id`, `outlet_id`, `tab_id`, `business_date`, `order_number`, `fired_at` (nullable until fired), `fired_by`, `device_id`, `status` (`draft`, `fired`, `partially_served`, `served`, `voided`), `client_created_at`, `server_received_at`, `note`.

### `order_lines`
`id`, `outlet_id`, `order_id`, **`tab_seat_id` (nullable, null means shared)**, `product_variant_id`, `qty numeric`, `unit_price_cents bigint`, `line_total_cents bigint`, `price_derivation jsonb`, `pour_spec_id` (nullable), `note`, `status` (`pending`, `served`, `voided`), `stock_conflict bool` default false, `served_at`, `served_by`, `voided_by`, `voided_at`, `void_reason`, `created_by`, `device_id`, `client_created_at`.

Indexes: `(order_id)`, `(tab_seat_id)`, `(outlet_id, business_date)`.

`stock_conflict` is set when a line arrives for a variant that went finished while the device was offline. The line is kept, flagged and surfaced, because the waiter may already have promised the drink. It is never silently dropped.

`price_derivation` is the stored resolution chain, so a bill from three months ago can be explained without recomputing anything.

### `order_line_modifiers`
`id`, `order_line_id`, `modifier_id`, `qty numeric`, `price_delta_cents bigint`, `linked_variant_id` (nullable, drives mixer depletion).

### `routing_tickets`
`id`, `outlet_id`, `order_id`, `target` (`bar`, `kitchen`), `payload jsonb` (includes seat numbers and labels), `status` (`queued`, `delivered`, `acknowledged`, `failed`), `channel` (`print`, `screen`), `printer_name` (nullable), `attempts`, `delivered_at`, `error`.

Separated from any printing implementation, so a bar screen and a printer are two consumers of one table.

### `shifts`
`id`, `outlet_id`, `business_date`, `staff_id`, `role_at_shift`, `started_at`, `ended_at`, `handover_to` (nullable), `handover_at`, `tabs_opened int`, `tabs_handed_over int`, `sales_cents`, `voids_cents`, `discounts_cents`, `status`.

Void and discount totals sit here deliberately. They are the numbers that matter most and should not need a report to see.

---

## Domain 6, settlement (6 tables)

### `bills`
`id`, `outlet_id`, `business_date`, `tab_id` (nullable for counter quick sales), **`tab_seat_id` (nullable, set when one seat is settled on its own)**, `bill_number` (gapless per outlet), `scope` (`tab`, `seat`, `even_split`, `quick_sale`), `split_group_id` (nullable, groups the bills produced by one even split), `subtotal_cents`, `discount_cents`, `tax_cents`, `total_cents`, `rounding_cents`, `status` (`open`, `settled`, `refunded`, `partially_refunded`, `voided`), `settled_at`, `settled_by`, `device_id`.

### `bill_lines`
`id`, `bill_id`, `order_line_id` (nullable for quick sales), `product_variant_id`, `description` (snapshot, because product names change), `seat_no int` (nullable, snapshot), `seat_label` (nullable, snapshot), `qty`, `unit_price_cents`, `line_total_cents`.

Descriptions and seat labels are snapshotted at settlement. A reprint two years later shows what the customer actually bought and who it was for, not what the record says today.

### `tenders`
`id`, `bill_id`, `kind` (`cash`, `mpesa`, `card`, `account`, `comp`), `amount_cents`, `tendered_cents` (cash only), `change_cents` (cash only), `reference text` (nullable, typed by the cashier), `created_by`, `device_id`, `created_at`.

**No provider integration.** There is no status field beyond existence, because Bliss does not know whether a payment succeeded. It records what the cashier observed. See ADR-012.

### `refunds`
`id`, `outlet_id`, `bill_id`, `business_date`, `amount_cents`, `reason text not null`, `method` (`cash`, `other`), `approved_by`, `approved_at`, `processed_by`, `processed_at`, `status`.

### `drawer_sessions`
`id`, `outlet_id`, `business_date`, `device_id`, `opened_by`, `opened_at`, `opening_float_cents`, `closed_by`, `closed_at`, `counted_cash_cents`, `expected_cash_cents`, `variance_cents`, `variance_reason`, `status` (`open`, `counting`, `closed`), `supervisor_witness_id` (nullable).

**Blind close rule.** `expected_cash_cents` is null on the client until `counted_cash_cents` is committed, and is omitted from the API response before then.

### `cash_movements`
`id`, `drawer_session_id`, `kind` (`opening_float`, `sale`, `change_given`, `payout`, `drop_to_safe`, `pickup`, `adjustment`), `amount_cents` signed, `reason` (required for `payout` and `adjustment`), `created_by`, `witnessed_by` (nullable), `occurred_at`.

---

## Domain 7, platform (5 tables)

### `events`
`seq bigserial primary key`, `outlet_id`, `channel`, `type`, `payload jsonb`, `actor_id`, `device_id`, `created_at`.

Indexes: `(outlet_id, seq)`, `(outlet_id, channel, seq)`.

Seven day retention, swept nightly. A transport buffer, never authoritative. The only table in the system with a delete path, and it is a scheduled job rather than an application code path.

### `sync_cursors`
`id`, `device_id`, `stream` (`catalogue`, `availability`, `trade`, `settlement`), `cursor bigint`, `last_pulled_at`, `last_pushed_at`, `last_ack_seq bigint`, `catalogue_version int`, `availability_version bigint`.

### `outbox_dead_letters`
`id`, `device_id`, `outbox_entry_id`, `kind`, `payload jsonb`, `rejection_code`, `rejection_detail`, `first_seen_at`, `resolved_at`, `resolved_by`, `resolution_note`.

Anything a device could not push and the server would not accept lands here visibly. The Console surfaces the count on the overview, because a dead letter queue nobody looks at is a data loss mechanism with extra steps.

### `audit_events`
`id`, `outlet_id`, `occurred_at`, `actor_staff_id`, `actor_device_id`, `actor_ip`, `action` (dotted key: `price.changed`, `line.moved_seat`, `hold.placed`, `count.committed`, `device.revoked`), `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `reason`, `severity` (`info`, `notable`, `sensitive`).

No UPDATE, no DELETE. Partitioned monthly.

### `settings`
`id`, `outlet_id`, `key`, `value jsonb`, `updated_by`, `updated_at`.

Runtime configuration that is not worth a column: low stock defaults, drawer thresholds, receipt footer text, bar routing channel, motion preferences for shared devices.

---

## Derived queries that matter

### On hand at a moment
```sql
select sum(qty_delta) as on_hand
from stock_movements
where outlet_id = $1
  and product_variant_id = $2
  and occurred_at <= $3;
```
Served in production from `stock_snapshots` plus same-day deltas. The query above is the definition; the snapshot is only ever an optimisation of it.

### Availability state for a variant
```
hold active?                     -> finished, reason 'hold'
variant or category not active?  -> finished, reason 'variant_status' | 'category_status'
qty <= 0                         -> finished, reason 'stock'
qty <= 3 serves                  -> last_few
qty <= threshold                 -> low
otherwise                        -> available
```
Evaluated in that order. The hold check is first for a reason.

### Per seat total on an open tab
```sql
select s.id, s.seat_no, s.label,
       coalesce(sum(l.line_total_cents), 0) as seat_total_cents
from tab_seats s
left join order_lines l
       on l.tab_seat_id = s.id
      and l.status <> 'voided'
where s.tab_id = $1
  and s.status = 'active'
group by s.id, s.seat_no, s.label
order by s.seat_no;
```
Shared lines (`tab_seat_id is null`) are excluded here and reported separately, because a shared plate is not anybody's line until somebody decides it is.

### Even split with exact reconciliation
```
remaining      = tab_total_cents - already_settled_cents
base           = remaining / n            (integer division)
remainder      = remaining - (base * n)
allocate base to every seat, then one extra cent to the first `remainder` seats
assert sum(allocations) == remaining
```
Largest remainder, property tested across ten thousand random amounts and seat counts. A split that does not reconcile exactly is a bug that surfaces as an argument at the counter.

### Pour variance for a period
```
theoretical_ml = Σ (order_lines.qty × variant.serve_volume_ml) for sold serve variants
actual_ml      = opening_ml + received_ml - closing_counted_ml
variance_ml    = actual_ml - theoretical_ml
variance_cents = variance_ml × avg_unit_cost_cents / container_volume_ml
```
Per product, per location, per period, compared against `pour_specs.tolerance_pct`.

### Gapless numbering
Tab numbers, bill numbers, PO numbers and GRN numbers use a per-outlet advisory lock and a counter row, not a Postgres sequence. Sequences leave gaps on rollback, and a gap in a bill number is a question nobody wants to answer at a stock take.

---

## Migration policy

Expand, migrate, contract. Every migration leaves the previous application version able to run.

1. Add the new column nullable, deploy.
2. Backfill in a job, deploy the dual write.
3. Switch reads, deploy.
4. Drop the old column in a later release.

Every pull request that touches the schema gets a Neon branch seeded from a production snapshot, and the migration runs there before review. No migration that takes an exclusive lock on `stock_movements`, `order_lines`, `events` or `audit_events` runs inside the configured trading window, and the deploy pipeline refuses them.
