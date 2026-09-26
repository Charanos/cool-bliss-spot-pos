---
name: "Bliss OS UI Engineering Guidelines"
description: "Core principles for designing and refactoring production-grade, Apple-quality UI components in the POS system."
---

# Bliss OS UI Engineering Guidelines

When building or refactoring UI elements for Bliss OS, you **MUST** adhere to the following principles. The user expects *production-grade, Apple-quality* precision—never settle for generic, basic, or unrefined layouts.

## 1. Structural Architecture & Bento Layouts
- **No Generic Lists**: Do not rely on simplistic `map` loops that generate a 1D column of `LABEL -> VALUE`. 
- **Bento Style**: Evolve lists and grid cards into structured Bento layouts (e.g., `grid grid-cols-2 gap-16`). Group related secondary data into highly legible sub-grids.
- **Uncard Elements**: Avoid "double carded" containers (a card inside a card). If rendering a list of items inside a larger panel (e.g., Tenders on a Bill detail page), use an unboxed ledger-style layout with elegant hairline border indicators (`border-l-2 border-hairline/60`), not nested gray boxes.
- **Hero & Footer Positioning**: Ground the primary identifier (e.g., Bill number) in a prominent header strip (`bg-control/20`). Isolate the most critical financial value (e.g., Total Exposure) in a dedicated footer strip (`bg-control/40`).

## 2. Spatial Utilization (Horizontal over Vertical)
- Do not lazily stack data vertically (e.g., `flex-col`) if there is ample horizontal space. 
- Use `flex items-baseline gap-6` to combine related data points onto a single baseline.
- **Example**: `33h12 at 17:55` is vastly superior to stacking `33h12` over `17:55`.
- **Eliminate Redundancy**: If two pieces of data are identical (e.g., Table is "Quick sale" and Scope is "Quick sale"), use conditional rendering to suppress the duplicate label. Keep the UI dense and intentional.

## 3. Typographical Scale & Hierarchy
- **Avoid Obnoxious Sizing**: Do not use massive fonts (e.g., `text-[22px]`) for list cards. Scale headers proportionally (e.g., `text-[17px] font-medium tracking-tight`).
- **Contrast over Weight**: Avoid using `font-bold` for micro-labels. Use `text-[10px] uppercase tracking-wider font-medium text-ink-subtle`. Achieve hierarchy through color/contrast (ink vs ink-subtle) rather than blunt font weight.
- **Tabular Nums**: Any number, duration, or time must use `tabular-nums` so the layout remains stable as digits change.

## 4. Micro-Interactions & Borders
- **Hard Borders are Banned**: Never use harsh borders. Soften all borders to `border-hairline/60` or `border-hairline/40`.
- **Hover Physics**: Interactive grid cards MUST have a physical hover state:
  ```css
  transition-all duration-300 hover:border-hairline/80 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:-translate-y-[2px]
  ```
- **Badges**: Status chips and badges should be tightly integrated (`rounded-md` or `rounded-full`, `px-[6px] py-[3px]`, `leading-none`) rather than bulky blocks that break padding.
