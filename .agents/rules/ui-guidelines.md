---
name: "Bliss Console UI guidelines"
description: "How to build and refine Console screens: the Pane and Card families, the tokens and primitives, the type ramp, copy, and the definition of done. Read docs/19-console-system.md first."
---

# Bliss Console UI guidelines

The Console is precise, quiet and dense. It gets its polish from alignment, a disciplined type ramp
and restraint, not from effects. Everything below is enforced by lint where it can be; the full
reference is `docs/19-console-system.md`.

## 1. Choose the family first
- **Pane** for tables, forms, settings and lists: flat on the page, grouped by space and one rule.
  A table goes in `DataTable`, which puts it on one card surface with a header band.
- **Card** for dashboards, grid views of records and a record's detail page: `Card` with
  `CardHeader`, `CardBody`, `CardStats`/`Stat`, `CardFooter`. Bands head and foot a card; **a card
  never contains a card**, and nothing inside a card has its own border box.
- A card that leads somewhere is one link (`CardHeader href`): one tab stop, middle click works.
  Never `onClick` on a `div`.

## 2. Use the primitives, not class recipes
- Page: `PageHeader` (title, one sentence, actions), `Section`, `SectionHeader`, `DetailHeader` on a
  record page with `<RecordCrumb>`.
- Figures: `Metric` in a `MetricGrid`; money always through `Money`; numbers in `NumCell` or mono.
- Parts: `KeyValueList`, `MetaRow`, `SummaryStrip`, `LedgerList`, `Overline`, `Separator`.
- Controls: `Button`, `ButtonLink`, `IconButton` (label required), `FilterSelect`, `Toolbar`,
  `SearchInput`, `ToggleChip`, `Segmented`, `Tabs`, `ConsoleOverlay`, `ImageLightbox`.
- States: `StatusChip`, `ToneChip`, `Badge`, `EmptyState`, `InlineNotice`, the skeletons.

## 3. Tokens only
- No value in brackets for type, colour, radius, shadow, space or motion (`text-[13px]`,
  `shadow-[...]`, `rounded-[12px]`, `px-[6px]`, `duration-[160ms]`): `bliss/no-arbitrary-design-values`
  fails the build. Grid track lists and widths are fine.
- No opacity on text (`text-ink-subtle/60`). Hierarchy is `ink`, `ink-muted`, `ink-subtle`.
- No Tailwind defaults outside the theme (`tracking-wider`, `rounded-xl`, `shadow-sm`, `sm:`,
  `font-semibold`): they compile to nothing, and `check-classes` says so.
- Surfaces: `card`, `edge`, `band`, `band-strong`, the washes. Shadows: `shadow-card`,
  `shadow-popover`. Motion: `transition-hover`, `transition-card`, `card-interactive`.

## 4. Type
- One `h1` (`text-title-page`), then `h2` (`text-title-section`), then `h3` (`text-title-card`).
- Body is `text-ui` (14px); secondary is `text-body-sm`; a label over a value is `label-caps`.
- Numbers: `font-mono tabular` with `text-num-kpi`, `text-num-md` or `text-num-sm`.
- Weights are 400 and 500 only.

## 5. Copy (docs/08, Console section)
- Titles are the nouns people use at the bar; one sentence of purpose under them.
- Sentence case everywhere; capitals only through `label-caps`.
- The terminology lock: tab, seat, line, bill, tender, variance, write-off, void, business day.
- Buttons name their outcome. Empty, filtered and error states are specific to the table.
- No invented figures, no stock photos, no fiscal or eTIMS wording. `check-copy` runs in lint.

## 6. Done means
Light and dark, 1440 and 1280, usable at 1024, keyboard operable with visible focus, lint clean,
and every write through `runAction`. The checklist is `docs/19-console-system.md` section 6.
