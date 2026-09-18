# Motion and interaction, Bliss

Version 1.0
7 September 2026

---

## 1. Principle

A point of sale that feels slow gets bypassed, and a bypassed till produces no data. Every animation in this product has to justify itself against that.

Motion here does exactly three jobs:

1. **Confirm.** Something happened, and here is proof, faster than the network could confirm it.
2. **Connect.** This object came from there and went to here, so the eye does not have to re-find it.
3. **Orient.** This is new, this is leaving, this is where you are.

Anything that does none of those three is decoration and does not ship.

---

## 2. The budget

Hard limits, enforced by a lint rule on duration literals and by a CI test that walks the animation registry.

| Surface | Ceiling | Typical |
|---|---|---|
| **Floor** | 140ms | 90 to 120ms |
| **Counter** | 240ms | 120 to 200ms |
| **Bar view** | 160ms | 120ms |
| **Console** | 400ms | 200 to 320ms |

A waiter's interaction loop is roughly 400ms end to end. An animation that takes a third of that is felt as lag, not polish. The Console is read at a desk by somebody who is not holding a tray, which is the only reason it gets a longer budget.

Nothing anywhere exceeds 400ms. There is no exception and there is no "hero" animation.

---

## 3. Easing

Four curves, named, and that is the whole set.

| Token | Curve | Use |
|---|---|---|
| `ease.out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Entering, revealing, expanding. The default. |
| `ease.in` | `cubic-bezier(0.64, 0, 0.78, 0)` | Leaving, collapsing |
| `ease.inOut` | `cubic-bezier(0.65, 0, 0.35, 1)` | Moving between two on-screen positions |
| `ease.snap` | `cubic-bezier(0.34, 1.3, 0.64, 1)` | Press release and confirm only. The only curve with overshoot, and the overshoot is 3% at most. |

No bounce. No elastic. No `power4`. A till does not need personality in its easing curves.

---

## 4. GSAP setup

### Registration, once, at the application root

```ts
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(ScrollTrigger, Flip);

gsap.defaults({
  duration: 0.16,
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
  overwrite: 'auto',
});

// One global scale. Set to 0.25 in the debug panel to inspect any
// animation frame by frame, or to 0 to prove the product works without motion.
gsap.globalTimeline.timeScale(1);

// Never animate on the main thread more than necessary.
gsap.ticker.lagSmoothing(500, 33);
```

### Reduced motion, handled once

```ts
const mm = gsap.matchMedia();

mm.add('(prefers-reduced-motion: reduce)', () => {
  gsap.globalTimeline.timeScale(100); // effectively instant
  ScrollTrigger.getAll().forEach(t => t.kill());
  return () => { gsap.globalTimeline.timeScale(1); };
});
```

Reduced motion makes things instant. It never removes the state change, never removes the feedback, and never leaves a control looking unresponsive. Opacity fades are allowed to survive at 80ms, because a hard cut on a colour change reads as a glitch.

### Scoping, in every component

```ts
useLayoutEffect(() => {
  const ctx = gsap.context(() => {
    gsap.from('.ticket-row', { y: 8, opacity: 0, stagger: 0.02 });
  }, rootRef);
  return () => ctx.revert();
}, [dep]);
```

`gsap.context` scoped to a ref, reverted on unmount, every time. A POS runs for eight hours without a page reload. An animation that leaks a listener or a transform is a memory leak that surfaces at 1am as a laggy tablet.

### What may be animated

`transform` and `opacity`. Nothing else.

The one sanctioned exception is **Flip**, which reads layout, applies transforms and cleans up after itself. Flip is the correct tool for exactly two things in this product, both of which involve an object genuinely changing its position in a list.

Never animate `width`, `height`, `top`, `left`, `margin`, `padding` or `box-shadow`. A lint rule fails the build on any of those appearing in a GSAP tween target.

---

## 5. Lenis

### Where it runs

**Console only.** Lenis is not imported into the Floor or Counter bundles. The bundle budget test fails if it appears there.

Reasoning is in ADR-014 and bears repeating: smooth scroll intercepts native scrolling and re-drives it from a rAF loop. On a desktop wheel that reads as polish. On a touch device it adds one to two frames of latency to the most frequent interaction in the product, breaks the fast flick a waiter uses to scan a long item grid, fights virtualised lists, and makes the interface feel like it is lagging behind the finger.

### Configuration

```ts
import Lenis from 'lenis';

const lenis = new Lenis({
  duration: 1.05,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo out
  lerp: 0.09,
  wheelMultiplier: 1,
  touchMultiplier: 1,
  smoothWheel: true,
  smoothTouch: false,   // non-negotiable, even on Console
  syncTouch: false,
  autoRaf: false,       // GSAP drives the tick, see below
});
```

`smoothTouch: false` even on the Console. A manager on a laptop trackpad gets smooth wheel. A manager on a touchscreen gets native scroll. Both are correct.

### One rAF loop, not two

Lenis and GSAP must not each run their own requestAnimationFrame loop. Drive Lenis from the GSAP ticker so there is exactly one.

```ts
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

lenis.on('scroll', ScrollTrigger.update);
```

### Where Lenis is disabled even on Console

- Inside any scrollable data table. Lenis is instructed to ignore them with `data-lenis-prevent`.
- Inside dialogs and sheets, same attribute.
- On any element with `overflow: auto` that is a virtualised list.
- When a modal is open, scroll is stopped with `lenis.stop()` and resumed with `lenis.start()`, rather than by toggling `overflow: hidden` on the body, which causes a scroll-position jump.

---

## 6. The animation registry

Every animation in the product, named, budgeted and specified. Anything not on this list does not exist, and adding one means adding a row here.

### Floor, ceiling 140ms

| Name | Trigger | Spec |
|---|---|---|
| `tile.press` | Finger down on a product tile | `scale 1 → 0.96`, 80ms, `ease.snap`. Reverses on release. Fires before any state change, so feedback never waits on logic. |
| `line.enter` | Line added to the ticket rail | `y 10 → 0`, `opacity 0 → 1`, 120ms, `ease.out`. No stagger, because it is one row. |
| `line.exit` | Line voided | `opacity → 0`, `x → 12`, 100ms, `ease.in`, then removed from the DOM on complete. |
| `seat.select` | Seat chip tapped | Ring scales `0.8 → 1` with `opacity 0 → 1`, 100ms, `ease.snap`. The chip itself does not move. |
| `seat.total` | Seat subtotal changes | `gsap.to` on a number proxy, 180ms, `ease.out`, tabular figures so nothing reflows. Counter-up only, never a flip or a roll. |
| `line.moveSeat` | Line moved between seats | **Flip**, 140ms, `ease.inOut`. The row travels from its old group to its new one. This is the animation that makes the seat model legible, and it is the one worth the budget. |
| `order.fire` | Fire order tapped | Rows translate `y → -6` and fade, staggered 16ms, total 120ms, `ease.in`. Then the rail empties and the base layer total counts to zero over 160ms. |
| `tile.finished` | `availability.changed` arrives | `opacity 1 → 0.4`, 120ms, `ease.out`, and the diagonal hairline draws with `scaleX 0 → 1` over the same 120ms. Deliberately gentle. An item running out should be noticed, not alarming. |
| `conn.change` | Connection state changes | Dot cross-fades 120ms. The chip never slides, grows or pulses. A waiter should be able to ignore it. |
| `sheet.enter` | Modifier or seat sheet opens | `y 24 → 0`, `opacity 0 → 1`, 140ms, `ease.out`. Scrim fades 100ms. |
| `sheet.exit` | Sheet or Floor dialog closes | `y → 16`, `opacity → 0`, 100ms, `ease.in`. Addition, the entry above specifies only how a sheet arrives. |
| `list.enter` | A Floor list first renders with items, such as the tab list on arrival | `y 8 → 0`, `opacity 0 → 1`, the whole group inside 140ms, staggered up to 16ms, capped at 8 items. Once per mount: never on a data refresh, a filter change or a row scrolled into view. Addition, docs/13-floor-tabs-revamp.md. |

**What the Floor deliberately has no animation for:** tab switching, category switching, grid scrolling, list virtualisation, and any loading state under 100ms. Those are instant, and instant is the feature.

### Counter, ceiling 240ms

| Name | Trigger | Spec |
|---|---|---|
| `amount.change` | Amount due changes | Number proxy tween, 200ms, `ease.out` |
| `scope.switch` | Whole tab / seat / even split | **Flip**, 220ms, `ease.inOut`. Bill lines regroup. The most satisfying moment in the product and it earns its 220ms because it is showing a real reorganisation of the bill. |
| `tender.add` | A tender is recorded | Row enters `y 8 → 0`, 140ms; amount due counts down over 200ms |
| `change.reveal` | Change due appears | `scale 0.96 → 1`, `opacity 0 → 1`, 200ms, `ease.snap`. Then it holds until dismissed. Never times out. |
| `bill.settled` | Settlement completes | Bill pane `opacity → 0.4` and the tab card leaves the grid with **Flip**, 240ms |
| `keypad.press` | Keypad key | `scale 1 → 0.94`, 70ms, `ease.snap` |
| `drawer.variance` | Variance revealed after blind count | Number counts from zero, 240ms. Colour resolves to Poured or Low at the end of the tween, not the start, so the operator reads the number before the judgement. |

### Bar view, ceiling 160ms

| Name | Trigger | Spec |
|---|---|---|
| `ticket.enter` | `order.fired` received | `y 16 → 0`, `opacity 0 → 1`, 160ms, `ease.out`. One short audio tick, if enabled at the outlet. |
| `line.poured` | Line tapped | `opacity → 0.4`, strike-through draws `scaleX 0 → 1`, 140ms |
| `ticket.clear` | All lines poured | Card leaves with `y → -12` and fade, 160ms, `ease.in` |
| `ticket.age` | Ticket older than five minutes | Border colour transitions to `low` over 400ms, once. No pulse, no flash. A bar at 23:00 does not need a strobe. |

### Console, ceiling 400ms

| Name | Trigger | Spec |
|---|---|---|
| `page.enter` | Route change | Content `y 12 → 0`, `opacity 0 → 1`, 240ms, `ease.out` |
| `section.reveal` | **ScrollTrigger**, element enters at 85% viewport | `y 20 → 0`, `opacity 0 → 1`, 320ms, stagger 40ms, `once: true` |
| `metric.count` | Overview figures on first paint | Number proxy from zero, 400ms, `ease.out`, staggered 60ms across the four cards |
| `chart.draw` | Chart enters view | Bars `scaleY 0 → 1` from the baseline, stagger 25ms, total 400ms. Lines draw with `strokeDashoffset`. First view only, never on re-render. |
| `table.row.enter` | Filter applied, new rows | `opacity 0 → 1`, stagger 12ms, capped at 20 rows total so a 500 row result does not take six seconds |
| `sheet.enter` | Any sheet or dialog | `y 32 → 0`, `opacity 0 → 1`, 280ms, `ease.out`. Scrim 200ms. |

### ScrollTrigger rules

- `once: true` on every reveal. A report a manager scrolls up and down must not re-animate.
- Every trigger created inside a `gsap.context` and killed on route change.
- `ScrollTrigger.refresh()` after any async content load that changes document height, debounced 100ms.
- No pinning. No scrubbed timelines. No parallax. This is a management console, not a landing page.

---

## 7. Interaction rules that are not animation

Grouped here because they govern feel as much as motion does.

| Rule | Detail |
|---|---|
| Optimistic first | Every Floor mutation renders locally before any network call. The animation confirms the local state, not the server response. |
| Feedback within 100ms | Any control that cannot complete in 100ms shows a determinate or skeleton state by 100ms. No spinner appears for anything under 100ms. |
| No spinner on a tile | Adding a line is local and instant. A spinner there would be a lie. |
| Gesture parity | Every swipe has a keyboard route and an overflow menu route. Gesture is never the only way. |
| Long press is 450ms | Consistent everywhere. A haptic tick at the threshold where the platform supports it. |
| Scroll position is preserved | Switching seat, switching category and returning from a sheet all restore scroll exactly. |
| Focus is never stolen | Except on a dialog open, where focus moves to the first non-destructive control and is restored to the trigger on close. |
| Nothing auto-dismisses money | Change due, variance and totals stay until an explicit action. Toasts are for nothing that matters. |

---

## 8. Performance guards

| Guard | Implementation |
|---|---|
| Bundle | Floor entry bundle fails CI above 220KB gzipped. Lenis and ScrollTrigger appearing in the Floor bundle fails the build outright. |
| Frame budget | A dev-mode monitor logs any animation frame above 16ms with the animation name attached |
| Concurrency | No more than three animations run simultaneously on Floor. The registry assigns each a lane, and a new animation in an occupied lane kills the previous one rather than queueing. |
| Will-change | Applied by GSAP only for the duration of a tween, never left on an element |
| Virtualised lists | Never animate a row entering a virtualised viewport. Only rows entering the data set. |
| Battery | On `navigator.getBattery()` below 15%, the global timeScale goes to 100, effectively disabling motion. A tablet at 11% at midnight needs to take orders, not to look nice. |

---

## 9. Debug panel

Available in every environment behind a five-tap gesture on the version string in Settings.

- Global timeScale slider, 0 to 1.
- Toggle every animation off entirely, to verify the product is fully usable without motion.
- Highlight animating elements with a 1px outline.
- Log of the last 50 animations with name, duration and longest frame.
- Force reduced motion, to test the branch without changing OS settings.

The first two exist because the honest test of a motion system is whether the product still works with the motion set to zero. If it does not, the motion was carrying meaning it should not have been carrying.
