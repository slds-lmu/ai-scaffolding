# Review rubric for explorable widgets

Use when commissioned to review widgets (one file, a chapter, or the app).
Reviews produce findings only; never fix during the review pass.

## Procedure

1. **Count the denominator from the source tree** (one inventory method
   per project: a manifest if there is one, otherwise a glob over widget
   directories plus the components imported from MDX) and read the
   project's conventions and notation
   (row- vs column-vector gradient, colour roles, style guide) *before*
   judging anything: a finding that contradicts a documented convention is
   a false positive, and one audit's top-priority item was exactly that.
2. **Quantitative scan** (whole scope, cheap greps): counts of
   direct-manipulation vs button/slider widgets; `Math.random` without seed;
   `aria-`; `transition`; `max-w-full`/ResizeObserver on graphics;
   prediction prompts in section prose; rAF/setInterval loops; header
   comments citing a verify script that actually exists in the repo. If the
   repo contains a prior widget review document, compare against its
   baseline numbers and open findings to report *deltas*, not rediscoveries.
3. **Read the surrounding MDX** for each reviewed widget before the widget
   itself: what question does the prose pose? (If none, that's finding A1.)
   Does the prose introduce every quantity the widget uses (A7)?
4. **Two passes per widget, always.** Read the full source (a minified
   one-liner is itself a finding) *and* look at it rendered at ~390 px and
   ~1300 px. The passes catch disjoint defect classes. In one project a
   screenshot pass over 14 widgets reported none; the source re-audit of a
   21-widget sample found 19 defective (constant verdicts, tautological
   verify scripts, missing headers). A source-only pass over 69 widgets
   missed 25 rendering defects (spoiler visible before reveal, marker under
   legend, panel wider than viewport, collapsed SVG). "No defects" is
   credible only after both.
5. **Score each widget** against sections A–H below and give a media
   decision: **KEEP** (sound, at most local fixes) / **REVISE** (valuable,
   needs substantive text, task, case or widget work) / **STATIC** (the
   insight is visual but interaction adds nothing; replace by a curated
   figure or table) / **REMOVE** (no didactic gain or duplicates a better
   explanation). Severity per finding: **CRITICAL** (mathematically wrong
   or numerically dishonest; likely to teach a false idea) / **MAJOR**
   (defeats a duty: wrong/unverified numbers, drag-only interaction,
   spoiled reveal, unusable at 390 px, no verdict on a widget that needs
   one, not self-contained) / **MINOR** (degrades: missing transition,
   color-role drift, jittery number widths, missing aria) / **NOTE** (idea,
   not a defect).
6. **Report** in the project's existing review format if it has one;
   otherwise per widget one line `<id> — <KEEP|REVISE|STATIC|REMOVE> — <one
   sentence>`, then findings as `- [MAJOR] file:line — finding. Suggested
   fix.` Every finding carries a file and line. Written in the script's
   language and style, no praise padding — but do name what is genuinely
   good (verified-numerics headers, verdict quality), since reviews also
   teach the conventions.
7. **Second rounds are triage-aware and end with a cut.** After the fixes,
   the re-review gets the triage table (fixed / rejected + reason / accepted
   as design) and is told not to re-report those items, so it spends its
   attention on regressions the fixes introduced (float-equality verdicts,
   spoilers moved in front of the widget, `role="img"` hiding keyboard
   targets). Fix rounds also inflate: one added 19 % words by repeating each
   caveat in prose, task line, verdict and closing; a shortening pass with a
   word-count baseline (`wc -w` before, or `git show HEAD:<file> | wc -w`)
   brought it to 3 %.

## A — Purpose & integration (duty 1)

- A1 The section prose poses the question the widget answers, before it.
- A2 The widget file header names the *one* insight.
- A3 A task caption tells the reader what to do ("Drag …").
- A4 The prose after the widget consolidates ("As the widget shows, …").
- A5 No paragraph-length motivation *inside* the widget; no bare
  `<Widget />` with zero framing.
- A6 Placement: core-insight widget inline in the section in an open
  interactive box; optional *material* in an expandable deep-dive block; at
  least one closing self-test question requires the widget.
- A7 Self-contained: every quantity, rule, data set or scenario the widget
  uses was introduced in the prose before it (no surprise loss function,
  bet payout, kernel bandwidth), under the same symbol and unit the widget
  shows (prose explaining σ² next to a slider labelled σ is a finding);
  statements in verdict and prose carry their hypotheses, and a special
  case is not phrased as a general theorem.
- A8 Nothing visible depends on collapsed content: no reference from the
  main text, a verdict or a visible quiz into a deep dive; self-tests about
  deep-dive material sit inside the deep dive.

## B — Dead-readable initial state (duty 2)

- B1 Screenshot test: the initial state is a figure worth printing.
- B2 Defaults show the phenomenon (not the trivial/empty case).
- B3 Everything labeled: axes, ticks where quantitative claims are made,
  legend (inline legend preferred), units.
- B4 Works without interaction: no state that only exists after clicking is
  required to understand the section's claim.

## C — Interaction design (duty 3)

- C1 The primary interaction is the lowest-barrier one available: object
  drag > slider > scrubbable number > typed number > button.
- C2 Dual-path: every drag has an equivalent slider/number.
- C3 Buttons only for discrete acts; no button-mashing to traverse a
  continuum.
- C4 Presets are curated, didactically labeled, 3–5, and *are* the case
  distinction; defaults per preset land on the interesting configuration.
- C5 Steppers are scrubbable or at least reversible; play mode (if any) has
  pause and doesn't autostart.
- C6 A comparison claim is shown side-by-side with shared controls, not as a
  toggle — unless spatial correspondence demands a toggle, which then has a
  transition.
- C7 Predict-then-reveal used where the answer is surprising; nothing in
  static text spoils an outcome the reader is about to discover.
- C8 The task line is achievable with the controls offered: the target
  state is reachable from the default in a few actions, and the widget's
  state space actually contains it (audits found tasks asking for outputs
  the widget could not produce).

## D — Feedback & interpretation (duty 4)

- D1 Reactive verdict text exists and differs meaningfully across state
  classes, including the "nothing proven" states.
- D2 Verdicts cite the script's numbered results/equations.
- D3 Live readouts for manipulated quantities (value under the handle,
  hover/tap coordinates on plots where values matter).
- D4 Success on an embedded task is detected and acknowledged.
- D5 The verdict names the mathematical reason ("κ grows because σ_min →
  0"), not only the measured value; the consolidating prose after the
  widget states the insight in 2–4 sentences (it is all a print reader
  gets).

## E — Visual & semantic encoding

- E1 Colorblind-safe palette; one color = one mathematical role; roles
  documented in the header and consistent with the coloring used in the
  section's formulas and prose.
- E2 Saturated color small, area fills low-opacity; no decorative color.
- E3 No verdict/status encoded in color alone.
- E4 Transitions on discrete toggles; none fighting a drag.
- E5 Locale-correct number formatting, stable widths for live numbers.

## F — Honesty & robustness (duty 5)

- F1 Header lists every number the verdict or presets claim, each covered
  by the committed verify script it cites (F6); a header citing a scratchpad
  or `/tmp` path is a finding.
- F2 No unseeded randomness; resampling only via explicit button; default
  seed's picture verified to support the claim.
- F3 Degenerate states clamped away or detected-and-explained (division by
  zero, coinciding points, singular matrix, empty selection), with three
  states where the mathematics has three: exactly degenerate (defined by
  the controlled parameter or a symbolic condition, e.g. the slider on 0 or
  the singular preset, not by `=== 0` on a derived float), nearly
  degenerate (small but nonzero: "ill-conditioned", never
  "singular"/"parallel"/"rank-deficient"), regular. A tolerance threshold
  presented as equality is MAJOR.
- F4 Deterministic under re-render and continuous under parameter change (no
  tie-break flicker).
- F5 Provenance note present: ported code credited, all prose (including
  widget status texts and captions) original (mandatory for public repos).
  Reviewers diff ported strings against the source app regardless of what
  the header claims; a header asserting "all strings rewritten" sat above
  sentence-by-sentence translations once.
- F6 Every numerical claim is covered by a committed verify script (the
  template: `scripts/verify/…` via `npm run verify:numbers`) that the
  header cites and whose assertions can fail (compare to an independently
  derived value, not `x − x`). Classify: valid script / missing script /
  missing header / no numerical claims.
- F7 Source is readable (formatted, header present); no minified one-liners.
- F8 Every case the header, presets or verdict advertise is reachable and
  has a verdict branch; the verify script drives each preset and asserts
  the branch it lands in (found: a "shrink step" the default simplex never
  triggers, an "oscillates" promise with no such branch).

## G — Responsiveness, accessibility, performance

- G1 Usable at 390 px: graphic scales (SVG viewBox + max-w-full, or canvas
  with measured width + DPR), no horizontal overflow, controls below the
  graphic, touch targets ≥ ~40 px.
- G2 `touch-action: none` scoped to handles/graphic, page still scrollable
  past the widget.
- G3 `role="img"` + `aria-label` on *static* graphics (`role="group"` when
  the SVG contains focusable targets, since `role="img"` hides them);
  `aria-live` on verdicts; `aria-pressed` on toggles; native controls
  throughout; the keyboard path completes the task.
- G4 Interaction latency imperceptible; no idle animation loops; heavy scans
  memoized.
- G5 Project type checks clean; shared-library components reused instead of
  re-implemented.
- G6 Renders at 390 px without a collapsed SVG (intrinsic `width`/`height`
  when not the flex item, `min-w-0` siblings), without clipped labels or a
  floating panel wider than the viewport; readable on both the light page
  and the dark pop-up surface (CSS variables, no hard-coded text hex).

## Chapter-level checks (when reviewing a whole chapter)

- H1 Widget density: ≤ 1 core widget per subsection; extras in deep-dive
  blocks.
- H2 Dramaturgy: mechanics introduced in isolation before combined widgets;
  any sandbox comes last.
- H3 The chapter's color roles are consistent across all its widgets.
- H4 Self-test coverage: each section closes with quiz questions; ≥ 1
  widget-dependent.
- H5 Widgets from an older generation or a different app layer touched by
  this chapter are flagged if below the current standard (styling,
  spoilers, fixed sizes).
- H6 Length: widget narration after a widget is 2–4 sentences, not a
  retelling of every state; the same caveat is not repeated in prose, task
  line, verdict and closing.
