# Design drift register, Bliss

Where the build departs from the design documents, and why. Code cites these by number. A drift is
either a correction the documents should adopt, or a deliberate exception; each says which.

| No | Where | Drift | Why | Status |
|---|---|---|---|---|
| D-01 | Seat colours | Colour index is `(seat_no - 1) mod 8`, not `seat_no % 8` as docs/04 writes it | The palette table and every design file give Seat 1 Glacier; `% 8` would make it Ember and Seat 8 Glacier | Correction: docs/04 to adopt |
| D-02 | Floor product tile | A photograph band on the tile | The tile imagery decision for the Floor revamp; the category edge stays | Accepted exception |
| D-07 | Light focus colour | `focus` is glacier-600, not glacier-400 | glacier-400 measures 2.6:1 on frost-0, below the 3:1 floor for a focus indicator | Correction: docs/06 section 8 to adopt |
| D-08 | Light Shared outline | frost-600, not frost-300 | frost-300 measures 1.8:1 on frost-0 | Correction |
| D-11 | Floor order fire | Unfired markers lift and fade, staggered 16ms inside 120ms; rows stay | Fired lines remain on the rail as waiting, then poured | Correction: docs/07 to adopt |
| D-12 | Motion ceilings | `seat.total` (180ms) and the fire count-down (160ms) are clamped to 140ms | The Floor ceiling is the harder rule | Correction |
| D-13 | Lenis | Only `lerp` is set; `syncTouch: false` replaces `smoothTouch` | Lenis 1.3 has no `smoothTouch`, and `lerp` overrides `duration` | Correction |
| D-14 | Console surfaces | The Card family: an elevated card with bands for dashboards, grids and records, beside the flat Pane family for tables and forms | The Console's dashboards read better as cards; one level of depth still holds (docs/19 section 1) | Adopted in docs/06 section 1 |
| D-15 | Console type | A 14px Console ramp (`title-page`, `title-section`, `title-card`, `ui`, `label-caps`, `num-kpi`, `num-md`) | A dense desktop tool; the Floor's 15px floor stays for the Floor | Adopted in docs/06 section 3 |
| D-16 | Radius | `control` 12, `card` 16, `overlay` 20, `pill` for counts and segmented controls | Buttons were 10 to 16 by hand; dialogs 28 by hand | Adopted in docs/06 section 5 |
| D-17 | Status chip | On a wash of its tone, radius sm | The chip needs to read on a card surface; the dot and word still carry it in greyscale | Adopted |
| D-18 | Printed bill | No fiscal wording; "This bill is not a tax invoice" | KRA eTIMS is out of scope (docs/00); an invented fiscal footer was a false claim | Correction |
