# Surface language: the atmosphere layer

Status: adopted, from the entry and Floor sign-in revamp. Its flat counterpart for working screens, and the Floor tabs plan built on both, is [13-floor-tabs-revamp.md](13-floor-tabs-revamp.md). Extends [06-design-system.md](06-design-system.md) and [07-motion-and-interaction.md](07-motion-and-interaction.md); the amendments it needs are listed at the end.

The revamp gave Bliss a second register. The working surfaces (ticket rail, item grid, Console tables) stay flat, dense and quiet. The *atmosphere* screens, where a device rests, where a person arrives, where a choice is made, get glass, light and photography. This document turns that register into tokens and primitives so a Floor screen adopts it by composition, never by copying class strings.

---

## 1. When to use it

| Use atmosphere | Stay flat |
|---|---|
| Entry, sign-in, lock and idle screens | Ticket rail, item grid, seat selector |
| Opening a tab: choosing a table | Anything with a running total |
| Empty states that deserve a moment | Console tables, reports, counts |
| A handover or shift summary card | Dialogs that ask for a reason |

Rule of thumb: if a waiter reads a number off it mid-service, it is flat. Glass is for moments, not for work.

## 2. Tokens

All in `packages/ui/src/tokens/tokens.ts`, generated into `styles/tokens.css` by `pnpm tokens:build`.

### Colour roles (both themes)

| Token | Dark | Use |
|---|---|---|
| `glass` / `glass-hover` | raised at 40% / 65% | Pane fill |
| `glass-strong` / `glass-strong-hover` | raised at 65% / 80% | Keypad keys |
| `glass-edge` / `glass-edge-hover` | hairline at 30% / 70% | Pane border |
| `veil` / `veil-hover` | ink at 3% / 8% | Quiet pill controls, round action nodes |
| `veil-edge` / `veil-edge-hover` | hairline at 20% / 40% | Veil border |
| `glint` | frost-0 | Highlights inside artwork, never text |

Alphas are `color-mix(in oklab, <hex> n%, transparent)`, so a role is still one hex in the token file and Tailwind opacity modifiers keep working.

### Type

| Token | Size / line / tracking / weight | Use |
|---|---|---|
| `eyebrow` | 11 / 14 / 0.2em / 500 | Mono capitals above content |
| `caps` | 11 / 14 / 0.08em / 500 | Mono capitals beside a value: role, telemetry |
| `badge` | 10 / 12 / 0.06em / 500 | Badge text |
| `heading` | 32 / 36 / -0.02em / 500 | Card and panel titles at tablet width |
| `persona` | 42 / 42 / -0.02em / 500 | A name set large |
| `clock` | 112 / 96 / -0.04em / 400 | The resting clock |

### Size, depth, motion

- `size-avatar` 64, `size-avatar-lg` 96, `size-node` 32.
- `shadow-lift` (0 12 32 -8 black 50%, dark) under glass; `shadow-key` under keypad keys. Not a second elevation level: on an atmospheric screen the glass pane *is* the one raised surface.
- `blur-glass` 8px, `blur-veil` 12px, as `backdrop-filter`.
- `--bliss-duration-surface` 300ms and `--bliss-duration-glide` 500ms for colour and border only. `--bliss-scale-press` 0.985 and `--bliss-scale-key` 0.94 for press, which always runs on the 100ms press duration.
- `animate-breathe` for a waiting label; stopped under reduced motion.

## 3. Utilities (`packages/ui/src/styles/base.css`)

| Utility | What it is |
|---|---|
| `surface-glass` | Fill, edge, radius-lg, lift shadow, backdrop blur |
| `surface-glass-interactive` | Hover (pointer devices only), 100ms press scale |
| `surface-key` | Keypad key: strong glass, key shadow, deep press |
| `surface-veil` | Pill or quiet key over atmosphere |
| `eyebrow`, `caps` | Mono capitals by CSS; the source string stays sentence case |
| `rule-fade-x`, `rule-fade-y` | Hairline that fades out |
| `ink-sheen` | Ink falling to muted ink, for a large name |

Hover lives inside `@media (hover: hover)`. On a tablet a tap never leaves a pane stuck in its hover colour.

## 4. Primitives (`@bliss/ui/components/atmosphere`)

| Component | Notes |
|---|---|
| `GlassPane` | Static pane. `as` div, section, article, li. `padding` none, sm (16), md (24, 32 at tablet) |
| `GlassLink` | Whole pane navigates. Nothing interactive inside it |
| `GlassButton` | Whole pane acts. Phrasing content only: spans, never headings |
| `Eyebrow` | `size` eyebrow or caps; `tone` subtle, muted, ink, accent, attention, poured |
| `ActionNode` | Arrow affordance, square or round; decorative, nudges on the pane's hover |
| `FadeRule` | `orientation` x or y |
| `VeilButton` | Pill control with an icon; the label is a verb naming the outcome |
| `Avatar` | Photo or initials, md or lg; decorative, because the name is always printed beside it |
| `PhotoBackdrop` | Luminosity photo faded into the page. Never behind dense data |
| `AtmosphereClock` | `@bliss/ui/components/atmosphere-clock`, client. Date, rule, clock; hydration safe |
| `glassClass()` | The class list, for an element none of the wrappers can be |

Artwork, decorative and inert, in `@bliss/ui/components/artwork/*`:

- `bar-glassware` exports `AmbientBarArtwork`: coupe, rocks glass and shaker, with a clear centre.
- `frost-crystals` exports `AmbientTerminalArtwork`: generated D6 snow crystals.

SVG ids are prefixed `bliss-bar-` and `bliss-frost-` so two artworks can share a page.

Tokenized in place: `Badge` (a span, `text-badge`), `PinPad` keys (`surface-key`, `surface-veil`), `BlissMark` (decorative unless given `label`).

## 5. Recipes for the Floor

- **Section label.** `<Eyebrow as="h2">Open tabs</Eyebrow>` with the count beside it in `font-mono text-num-sm text-ink-muted`.
- **Choice card** (a table to open, a person to hand over to). `GlassButton` holding `Avatar` or `SeatChip`, a name in `text-title font-medium`, a `caps` line, and `ActionNode shape="round"`.
- **Navigation card.** `GlassLink` with a `Badge`, `ActionNode`, a `heading` title and a `caps` telemetry line. Telemetry is real data or it is absent.
- **Quiet control over atmosphere.** `VeilButton`. Over a flat surface, use `Button variant="ghost"`.
- **Composition divider.** `FadeRule`. Inside a list, keep `border-rule`.
- **Waiting state.** `Eyebrow tone="accent" className="animate-breathe"` with `aria-live="polite"`.

### Guardrails

1. Capitals come from `eyebrow` or `caps` only. Never type a string in capitals: screen readers spell it out and docs/08 forbids it.
2. Press feedback within 100ms. Only colour and border may take the 300 to 500ms durations.
3. No glass inside glass. A pane inside a pane is still a container inside a container.
4. Artwork and photography only on atmospheric screens, at most one of each per screen.
5. Every value is a token. Arbitrary values are for one-off geometry only, such as a `max-w`.
6. No utility from Tailwind's default theme: the theme is reset, so such a class compiles to nothing (see section 6).

## 6. Fidelity audit of the revamp

The theme resets Tailwind's default namespaces, so these classes in the revamp produced **no CSS**. The screenshots that were approved are what actually rendered, so the tokens match those, plus a few intended effects now switched on deliberately.

| Class | Intent | Resolution |
|---|---|---|
| `backdrop-blur-sm`, `backdrop-blur-md` | Glass blur | **Now real**: `blur-glass`, `blur-veil` |
| `shadow-2xl`, `shadow-inner`, `shadow-sm` | Depth on avatar and pill | Dropped; matches the approved render |
| `drop-shadow-lg/md/2xl/sm` | Logo and clock glow | Dropped; invisible on the dark page |
| `tracking-tight/wide/wider` | Letter spacing | Folded into `heading`, `caps`, `badge` |
| `leading-tight/relaxed/none` | Line height | Folded into the type tokens |
| `animate-pulse` | Verifying pulse | **Now real**: `animate-breathe` |
| `font-normal` | Hero weight | Already 400 in `display` |
| `gap-10`, `translate-x-1`, `p-64`, `mt-22` | Off-scale spacing | Dropped, or moved to the scale (`translate-x-2`) |
| `md:` | Breakpoint | Not a Bliss breakpoint; dropped |

Also fixed on the way:

- **Inline `rgba()` shadows and raw `#ffffff`.** Moved to tokens.
- **Capitals typed into strings** ("AWAITING 6-DIGIT PIN ENTRY", "VERIFYING CREDENTIALS..."). Now sentence case, rendered in capitals by CSS.
- **Terminal jargon** ("unlock terminal session", "personnel"). Replaced with plain words per docs/08.
- **A heading inside a button** (invalid HTML). Now spans.
- **Clock hydration mismatch.** The minute differs between server and browser; now opted out on the two text nodes only.
- **Placeholder faces picked by hashing the staff id.** Two people could share a face. Now an explicit per-person map with an initials fallback (`floor/_lib/staff-photos.ts`).
- **Hardcoded landing telemetry** ("2 live tabs", "KES 184.2K"). Now live, and deliberately not financial on a page in front of sign-in.
- **The frost artwork built its geometry inside a hook.** Now built once at module level, so it is server safe.

## 7. Open items

1. **Sign-in lists waiters only.** A supervisor or manager covering a section cannot sign in on a floor tablet. Needs a product decision.
2. **Frost artwork cost on tablets.** Optimised without changing the picture:
   - It is memoised, so typing a PIN no longer re-renders it.
   - Glow is blurred once per arm instead of once per branch tip.
   - Rotation steps ten times a second, under half a pixel per step at 420 seconds a turn.
   - Geometry for unused crystal habits is not built.

   Still worth one measurement on the real waiter tablet.
3. **Asset weight.** `public/logo.png` is 900KB and `public/logo.jpg` (390KB) is unused. Export the mark as SVG, or a 192px PNG.
4. **Originals kept.** `app/(entry)/_components/ambient-bar-artwork.tsx` and `app/(floor)/floor/sign-in/_components/ambient-terminal-artwork.tsx` are superseded by the package versions and no longer imported. They still contain raw hex, which the lint rule will flag. Delete them once confirmed.

## 8. Proposed amendments

- **docs/06 section 3.** Add `eyebrow`, `caps`, `badge`, `heading`, `persona` and `clock` to the scale. Capitals are allowed only through the `eyebrow` and `caps` utilities, with sentence-case source strings.
- **docs/06 section 5.** "One level of elevation" gains a clause: on atmospheric screens the glass pane is that level and carries `shadow-lift`.
- **docs/06 radius.** "No pills" gains an exception for `surface-veil` controls and avatars.
- **docs/07.** Surface transitions of 300 to 500ms are allowed for colour and border on atmospheric screens. Press stays at or under 100ms, and the Floor ceiling of 140ms still binds anything that moves.
- **docs/04.** Add `staff.photo_key`, mirroring `products.image_key`.
