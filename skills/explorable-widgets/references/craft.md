# Implementing teaching widgets

Use the existing stack and shared components. React/TypeScript examples in
interactive-textbook are optional implementation support, not a reason to
migrate a Quarto, plain HTML, or other working project. Extract a shared
abstraction when it removes actual duplication without hiding the lesson.

## Rendering and input

- SVG is a good default for modest vector plots with labels and handles.
  Canvas fits dense raster/point work; choose by measured behavior, not a
  universal element-count threshold. Do not write a numerical solver merely
  to avoid a well-supported dependency.
- Use a viewBox and responsive sizing; supply intrinsic width/height when a
  wrapper in a flex layout otherwise collapses. Give shrinking columns
  min-width: 0. Test the rendered result, including labels at domain edges.
- Canvas backing resolution follows its measured CSS size and device pixel
  ratio. Redraw on resize. Keep labels and controls readable on narrow screens.
- For drag: convert pointer coordinates to the plot coordinate system, capture
  the pointer, preserve a grab offset where needed, and clear dragging on
  pointerup, pointercancel, and lostpointercapture. Scope touch-action to the
  interactive region so the page remains scrollable.
- Provide keyboard operation and a single-pointer alternative without dragging,
  such as click-to-position, increment buttons, or suitable native inputs.
  Keyboard access alone does not satisfy the non-drag pointer requirement:
  see [W3C dragging guidance](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).
- Keep editable numeric input as a string until valid; accept intermediate
  states such as empty or minus without coercing them to zero. Validate finite
  values and domains before committing. Label units and log scales explicitly.

## Numerics and state

Derive graphic, readout, and feedback from the same state and calculation.
Keep nontrivial calculations in importable functions when that makes them
independently testable. Do not maintain a second implementation only for tests.
Compare production output with known solutions, algebraic invariants, or an
independent trusted computation. Check representative interiors, boundaries,
and invalid inputs; do not write one test per displayed number.

Treat undefined, infinite, and finite values separately. Tolerance measures
numerical closeness, not exact rank, parallelism, or singularity. Use a
controlled/symbolic condition for known exact cases and explain numerical
uncertainty for general input. Conditioning depends on scale and singular
values; a small determinant by itself is insufficient. Preserve unstable
arithmetic deliberately when instability is the lesson, with a reference
calculation that makes the discrepancy explicit.

Use seeded sampling for reproducibility. Regenerate only on an explicit
sample/seed action; hold randomness fixed during a parameter comparison when
appropriate. For Monte Carlo claims, state the sampling design and distinguish
empirical error from the theoretical quantity. A curated realization may
illustrate a phenomenon but does not establish its frequency.

Reuse project formatting (including decimal-point overrides); do not infer it
solely from language. Keep meaningful precision and separate NaN from infinity.
Preserve mathematical notation in readouts and use the host's cross-reference
mechanism rather than retyping result numbers.

## Accessibility and performance

- Prefer native labeled inputs/buttons, visible focus, and meaningful groups.
  Use `role="img"` plus `aria-label` for a static graphic. An SVG that
  contains focusable targets (keyboard-operable handles, clickable presets)
  gets `role="group"` plus `aria-label` instead: `role="img"` hides its
  children from assistive technology. Supply a textual equivalent for
  essential graphics.
- Use color consistently with labels/shapes; check contrast on actual surfaces.
  A shared page/pop-up widget should inherit the host's surface tokens. When
  the project has no palette, default to a colorblind-safe one such as
  Okabe-Ito (`#0072B2` blue, `#009E73` green, `#D55E00` vermillion, `#E69F00`
  orange, `#CC79A7` purple, `#56B4E9` light blue, `#F0E442` yellow, sparingly)
  and keep one color per mathematical role across diagram, formula and prose.
- Floating panels (tooltips, pop-ups) clamp to the viewport:
  `max-w-[min(28rem,calc(100vw-20px))]` with `min-w-0` on the content; a plain
  `max-w-md` (448 px) overflows a 390 px phone.
- Announce important status changes politely. Do not announce every numerical
  update during dragging; keep a visible readout and announce committed changes
  or meaningful regime changes where useful.
- Animate only when motion clarifies correspondence. Respect reduced motion,
  never chase a continuously dragged control with another animation, and avoid
  invalid intermediate mathematical states. Playback needs pause and teardown.
- Local state is usually sufficient. Memoize expensive work on real inputs;
  measure before introducing workers, a store, or a new rendering library.
  Stop loops when hidden/unmounted. Keeping a collapsed widget mounted preserves
  state but can retain expensive work: choose deliberately.
- Shareable state is optional. Preserve the host router and section anchors;
  do not overwrite the URL hash with widget parameters in an anchored textbook.

## Validation

Run relevant host checks and focused numerical tests. For changed widgets,
exercise defaults, important regimes, input/reset, keyboard and touch/non-drag
paths, plus narrow/desktop rendering. Check actual math output and console
errors. Note tests that could not run. Review a requested print/static form.

Keep verification code in the repository where it can be rerun; existing unit
or integration tests are fine. Put the calculation a test should exercise in a
plain `.ts` module (no JSX) that the widget imports, so a Node script can
import the same function: Node's type stripping handles `.ts`, not `.tsx`, and
a formula re-typed inside the test only tests itself. One script per widget
and exhaustive header lists are not requirements. Header comments are useful
for a non-obvious model assumption, numerical method, or provenance; avoid
duplicating code and readouts in comments. When porting a widget from another
project, take the code and rewrite every reader-facing string (task, verdicts,
captions) from your own understanding; ported status texts have shipped as
sentence-by-sentence translations under a header claiming otherwise. Respect
applicable source licenses and user permissions.
