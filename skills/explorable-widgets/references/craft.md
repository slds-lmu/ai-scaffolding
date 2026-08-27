# Craft: implementing widgets in the React/MDX script stack

Stack: React + TypeScript + Vite + Tailwind + MDX + MathJax. Assume the app
has (or should grow) a small shared component library: a labeled slider, an
editable matrix input, a plot component, a linear-map canvas, math
components wrapping MathJax, environment blocks (Definition/Theorem/…), an
expandable deep-dive block, step-revealable proofs, quiz blocks, concept
tooltips, and axis/tick helpers. Extend that library rather than
duplicating; a pattern used twice becomes a library component.

## SVG vs Canvas

- **SVG by default.** DOM events per element (drag handles, hover), CSS
  transitions, scales for free via `viewBox` + `max-w-full`, printable.
- **Canvas** only for >~2000 elements or per-pixel work (heatmaps, fields).
- Hybrid (Patel): canvas underlay for the heavy layer, SVG overlay
  (absolutely positioned, same coordinate system) for handles and labels.

## Responsiveness (hard requirement: usable at 390 px)

- SVG: fixed `viewBox`, `className="max-w-full h-auto"`, and an intrinsic
  size (`width`/`height` attributes) whenever the `<svg>` is not itself the
  flex item. Reason: a viewBox-only SVG has no intrinsic width, so a
  wrapping `<div>` in a flex row can resolve `flex-basis: auto` to ~0
  (observed in Chromium: a 2 px sliver, the whole plot column gone, build
  green), and without an intrinsic size the browser starts from its
  300×150 replaced-element default before applying the aspect ratio. The
  CSS `max-w-full h-auto` still scales the SVG down on narrow screens, so
  the attributes cost no responsiveness. Give sibling flex columns
  `min-w-0`, because a flex item otherwise refuses to shrink below its
  content's minimum width and the SVG column gets squeezed instead. Both
  failures pass every automated gate; only a screenshot shows them.
- Tick and edge labels: mirror `textAnchor` near the right/top edge instead
  of letting the label clip; draw the legend outside the data area or with
  a backing rect, never over markers.
- Floating panels (tooltips, pop-ups) clamp to the viewport:
  `max-w-[min(28rem,calc(100vw-20px))]` plus `min-w-0` on the content —
  a plain `max-w-md` (448 px) overflows a 390 px phone.
- Canvas: never a fixed CSS pixel width. Measure the container
  (`ResizeObserver`), set `canvas.width = cssWidth * devicePixelRatio`,
  `ctx.setTransform(dpr,0,0,dpr,0,0)`, redraw on resize. Cap at the design
  width (e.g. 460) so desktop doesn't balloon.
- Controls **below** the graphic, not beside it: fingers cover the diagram
  during touch interaction (Patel), and side-by-side collapses badly on
  phones. Wrap control rows with `flex flex-wrap gap-*`.
- Side-by-side comparisons stack vertically under ~sm breakpoint with shared
  controls staying on top.

## Pointer interaction recipe (drag)

```tsx
<circle r={7} /* enlarged handle; the visible dot can be smaller on top */
  style={{ cursor: "ew-resize", touchAction: "none" }}
  onPointerDown={(e) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragging.current = "a";
  }}/>
// on the <svg>:
onPointerMove={(e) => { if (!dragging.current) return;
  const x = clientToWorld(e.clientX);          // via getBoundingClientRect
  setA(clamp(x, LO, b - 0.15));                // constraints DURING drag
}}
onPointerUp={() => (dragging.current = null)}
```

- `setPointerCapture` so fast drags don't escape the handle; `touch-action:
  none` on handle *and* svg so the page doesn't scroll mid-drag — but keep
  draggable regions small relative to the page so scrolling past on mobile
  stays possible (Patel's scroll-trap warning).
- Hit area ≥ 14 px radius (invisible circle under a small visible one if the
  dot must look small; `pointer-events: none` on the visible one).
- Remember the grab offset for large shapes (position relative to grab
  point, not snap-to-cursor).
- Constraints clamp *during* the drag (a ≤ b − ε keeps degenerate states
  unreachable); continuous quantities snap only if the lesson is discrete.
- **Dual-path rule:** every draggable has a mirrored slider or number
  input. This is the keyboard-accessible path; do not ship a drag-only
  widget.
- Z-order: SVG paints in document order; render handles last. Reordering
  nodes mid-drag loses pointer capture in React — avoid designs needing it.

## Surfaces: the same widget on a light page and in a dark pop-up

A concept widget renders once in the page body and once inside an
always-dark tooltip window, so hard-coded colours break in one of the two.
Draw SVG internals with CSS variables (`--w-bg`, `--w-grid`, `--w-axis`,
`--w-text`, `--w-muted`, `--w-border`; the dark panel carries a `.w-dark`
class that redefines them) and build DOM controls from shared class strings
that cover light, `dark:` and `.w-dark` (`W_PANEL`, `W_TEXT`, `W_BUTTON`, …
in the template's `src/lib/widgets/surface.ts`). Semantic colours come only
from the project's palette constant (the template calls it `FMM_COLORS`);
a hard-coded `slate-700` text colour is invisible on a dark page.

## Determinism & continuity

- No naked `Math.random`. Use a seeded generator:

```ts
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

  Seed lives in state (`useState(1)`), a "new sample" button increments it;
  the default seed is *chosen* so the default picture argues the point
  (verify it!).
- Continuity under parameter change (Patel): algorithms with ties or internal
  randomness must break ties deterministically, or the picture flickers as an
  unrelated slider moves. If an algorithm resamples per evaluation, hoist the
  sample out and reuse it.
- Heavy recomputation: recompute-everything-on-change is the right default
  (Patel); wrap only genuinely expensive scans in `useMemo` keyed on the
  actual inputs. No stale caches.

## Color

- Use a colorblind-safe palette; Okabe-Ito is the recommended default —
  `#0072B2` blue, `#009E73` green, `#D55E00` vermillion, `#E69F00` orange,
  `#CC79A7` purple, `#56B4E9` light blue, `#F0E442` yellow (sparingly), plus
  neutral grays.
- **One color = one mathematical role**, declared in the widget header
  comment and kept consistent within a chapter. If the script colors terms
  in formulas (color macros in the math layer), the widget uses the *same*
  color for the same subexpression — diagram, formula, and prose share one
  color per concept. No decorative colors.
- Saturated color in small areas for the important thing; large areas get
  low-opacity fills (`fillOpacity` 0.12–0.3) and neutrals (Patel).
- Color the *controls* to match the curves they govern when several series
  share a plot (accent color on the range input).
- Never encode a verdict in color alone: pair with text and/or shape
  (dashed vs solid).

## Numbers & text

- Format every reader-facing number in the script's locale (German scripts:
  decimal comma, real minus sign `−`, `–` for undefined, `∞` for infinite)
  via one shared `fmt` helper that separates `NaN` from `Infinity` (a 0/0
  amplification shown as `∞` is wrong). Fixed decimals per readout so text
  doesn't jitter; `font-mono` + fixed-width spans for live numbers.
- Branch verdicts robustly: every comparison with `NaN` is false, so
  `x < s` silently routes an undefined quotient into the "regular" branch.
  Test `Number.isNaN(x)` first and give it its own verdict. Define the
  *exactly degenerate* state from the controlled parameter or a symbolic
  condition (the slider sits on 0, the preset is the singular matrix), not
  from `=== 0` on a derived float, which is false by a rounding error in
  either direction; use tolerances only for the *nearly degenerate* class.
- Name readouts after the object they are computed from (`‖Q_θA‖`, not
  `‖A‖`), or an invariance demo looks like it prints constants. Quantities
  that cancel in doubles (`(c²+1) − c²` is 0 for c ≥ 1e8) are computed from
  a stable closed form, and the header says which one, so the displayed
  value is the mathematically defined quantity rather than the runtime's
  rounding. Choose slider ranges so every marked point stays inside the
  viewBox at the extremes.
- Example numbers quoted in status text must agree with the live readouts
  and with each other (a verdict once claimed "−11.59 + (−3.06) = −14.64"
  while its readout showed −3.055). A number quoted in more than one place
  (prose, quiz feedback, verdict) comes from one constant or the numbering
  helper, never retyped. If the prose cites an external computation (R
  output), the widget's own floating-point result can differ (R's `mean`
  runs a second correction pass; a naive JS sum printed −128 where R
  printed 0), so say so *in the widget*, or the default state contradicts
  the text.
- Typographic quotes („…", “…”) only in JSX text, never inside string
  attributes such as `label="…"`: a closing quote that happens to be an
  ASCII `"` ends the attribute and the file fails to parse.
- Substitute current values into displayed formulas through the math
  components, using whatever macro set the script defines — don't invent a
  parallel notation.
- Scrubbable numbers (Tangle-style drag-a-number) are a good middle ground
  between slider and typing. For any typed numeric input, keep an internal
  *string* state and commit to number state only on valid parse — coercing
  with `Number()` on every keystroke turns "" and "−" into 0 and makes
  typing negative or intermediate values impossible.
- Widget-internal prose is limited to: one task line ("Drag…"), legend,
  verdict. Motivation and consolidation live in the MDX around it. That
  prose follows the project's style guide like any other text: voice
  (captions and quiz feedback are where a "we"-voiced script slips into
  "you"), quotation marks, dash budget.

## Accessibility

- Graphics: `role="img"` + `aria-label` (one sentence in the script's
  language: what the figure shows in its current state class) on a *static*
  svg/canvas; canvas additionally gets fallback text children. An SVG that
  contains keyboard-focusable targets (drag handles with the dual-path
  handles that are keyboard-focusable, clickable presets) must NOT be
  `role="img"`, which hides
  its children from assistive tech; use `role="group"` + `aria-label`.
- The keyboard path is a real path: arrow keys on the mirrored slider move
  in documented increments, focus is visible, presets and reset are
  reachable by Tab, and a task can be completed without a pointer.
- Verdict container: `role="status" aria-live="polite"` so state changes are
  announced.
- Toggles/preset buttons: `aria-pressed`; grouped questions:
  `role="group" aria-labelledby`.
- Keyboard: the dual-path rule covers dragging; ensure buttons/sliders are
  real `<button>`/`<input>` (native controls, never divs with onClick —
  Patel's strong preference for browser controls stands).
- Contrast: verdict text on its background ≥ 4.5:1.

## Transitions

- Only for discrete state jumps (toggle, preset switch): CSS
  `transition: 200–300ms ease-in-out` on SVG `cx/cy/transform` where
  possible; otherwise interpolate in state over ~15 frames. Slight overshoot
  is memorable but optional.
- Never animate while a continuous control is being dragged — the drag *is*
  the animation.

## State

- Widget state is local (`useState`); it should survive collapsing its
  deep-dive container — implement expandables with `hidden` rather than
  conditional rendering so children stay mounted.
- Shareable state (nice-to-have, instructor links): serialize the few
  parameters into the URL hash on change (`history.replaceState`), read once
  on mount; only for widgets where "look at this exact configuration" has
  teaching value.

## Verification & provenance

- The file header comment states: the one insight; the color roles; the
  provenance of any ported code; and, for every number the verdict or
  presets claim, the path of the committed script that checks it (the
  template wires `scripts/verify/*.mjs` into `npm run verify:numbers`; any
  project-configured, committed command will do). Not a session scratchpad:
  one project ended up with 171 headers citing `/tmp` scripts, thirty of
  which were gone. Assertions must be falsifiable (compare against an
  independently derived value, not against the widget's own function).
  A widget without numerical claims needs no script, just the header.
- Source stays readable: no minified one-line files, no generated temp
  files committed (the MDX typecheck's `.*.mdx-check.tsx` are the usual
  offenders). A source audit is part of acceptance, and a one-liner cannot
  be audited.
- One verify script per widget, named after it (`scripts/verify/<Widget>.mjs`),
  so parallel authors never overwrite each other's checks (a shared
  `check-math.mjs` in a scratchpad was clobbered between agents).
- If the repository is public, ported *code* may be credited and reused per
  its license, but prose adapted from copyrighted books must never appear —
  translations are derivative works. All explanatory text is written fresh,
  and *widget status texts, captions and verdicts are prose*: a review found
  three "ported" widgets whose phase texts were translated sentence by
  sentence from the source app. Take the code, rewrite every string.
- Verify every number the verdict claims and every preset's advertised
  behavior. If the verified numbers show something surprising (non-monotone
  error growth), say so in the header — future authors will trust the widget
  because of it.
- After changes: run the project's type checks (`npx tsc --noEmit`) and any
  MDX lint/typecheck scripts it defines, then screenshot at ~390 px and
  ~1300 px. Type checks cannot see a collapsed SVG, a spoiler visible before
  the reveal, or a MathJax macro that does not exist (an undefined macro is
  typeset silently as red literal text, not as an error; see the
  interactive-textbook verification notes).

## Performance budget

- Interaction handler + rerender ≤ a few ms: 200–400 sample points per curve
  suffice; scans over 2000 grid points are fine in `useMemo`, not per
  pointermove unless memoized on the dragged value's rounded version.
- No `requestAnimationFrame` loops outside an explicit play mode with a
  visible pause; idle widgets must be truly idle (battery, calm page).
- Steppers: the caller owns `step` and derives the whole state
  deterministically from it (`useMemo`), so scrubbing backwards is exact.
  The initial frame shows something meaningful (the initialized state, or
  the first step if "step 0" would be an empty frame), because the initial
  state must be readable dead; never autostart (the reader decides when to
  act, and an idle page stays calm); stop at the end.
- Respect the app's bundling constraints (single-file builds share one
  budget): no new dependencies for what 30 lines of code can do (Patel's
  build-longevity argument).
