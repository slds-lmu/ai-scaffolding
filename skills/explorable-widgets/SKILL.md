---
name: explorable-widgets
description: >
  Design, build, and review interactive teaching widgets (explorable
  explanations) for web-based lecture scripts and interactive textbooks
  built with React + TypeScript + Vite + Tailwind + MDX + MathJax. Encodes
  the didactic patterns of Victor, Case, Distill (Hohman et al. 2020), and
  Red Blob Games as concrete build checklists and a review rubric. Use this
  whenever the user asks to add, improve, redesign, or critique a widget,
  interactive figure, diagram, animation, stepper, quiz, or deep-dive block
  in a lecture script or interactive textbook — even if they just say "make
  this section interactive", "this widget is boring", "review the widgets in
  chapter 12", or paste a static figure and ask for an interactive version.
  Also use it when writing the prose *around* a widget.
---

# Explorable Widgets

A widget is not decoration. It exists to let the reader **act on a
mathematical object and see the consequence**, inside an explanation that
would also work if the widget were a static figure. This skill governs three
jobs; read the matching reference before starting:

| Job | Read |
|---|---|
| Choosing *what kind* of interaction a concept needs | `references/design-patterns.md` |
| Implementing it correctly in this stack | `references/craft.md` |
| Reviewing/critiquing existing widgets | `references/review-rubric.md` |

The target project's own convention and style documents always win over this
skill where they conflict — read them first. All reader-facing text (labels,
verdicts, captions) is written in the script's language, with UI strings kept
localizable.

## The five duties of a widget

Every widget must satisfy all five. They are the condensed core of the
literature (Victor 2011; Case 2014/2018; Hohman et al., Distill 2020; Patel);
the review rubric scores against them.

**1. It answers a question the prose just asked.**
The section text poses the question; the widget is where the reader finds
out; a verdict inside the widget interprets what they found. Never drop a
bare `<Widget />` between paragraphs, and never put paragraph-length
motivation *inside* the widget — that is the prose's job. Division of labor:
**question in the text → action in the widget → interpretation in the
verdict → consolidation after the widget, still inside its interactive
box** ("As the widget shows, a single counterexample pair settles it…").
Inside the box, because a print export replaces the widget with a
placeholder and the consolidation then has to stand next to it, carrying
the insight in two to four sentences on its own. The prose before the box
*introduces every quantity the widget uses*, with the same symbols and
units the widget shows: a bet whose payouts were never stated, a loss
function or data set that first appears in the widget, a bandwidth slider
before the kernel was defined were the most common audit defects
(design-patterns §11). If the widget knows something the reader was not
told, the text is incomplete.

**2. It is readable dead.**
The initial state is the single most instructive static figure you could have
drawn: curated defaults, everything labeled, nothing requiring interaction to
make sense. Test: screenshot the initial state — is it a figure you would put
in a PDF script? (Victor: the reader is never *forced* to interact; Patel
makes his pages work printed.) Corollary: choose defaults that already show
the interesting phenomenon, not the trivial case.

**3. It lets the reader act on the object, not only on knobs.**
Preference order for the *primary* interaction:
direct manipulation of the mathematical object (drag the vector, the point,
the interval endpoint) → slider → scrubbable number → button. Buttons are for
discrete acts (step, reset, new sample, preset choice), never the only way to
vary a continuous quantity. Every drag interaction must have an equivalent
non-drag path (slider or number input) — the **dual-path rule** — both for
keyboard accessibility and because trackpads are bad at dragging.

**4. It responds with authored interpretation.**
Redrawn pixels are not feedback. State-dependent verdict text tells the
reader what the current state *means*, referencing the script's own numbered
results ("here inequality (3.4) fails; since Theorem 3.2 requires it for all
pairs, f is not convex"). Cover every reachable state class, including the
boring ones ("this pair passes the test — which proves nothing, because…").
This is the single feature that separates an explanation from a sandbox.

**5. It is honest and deterministic.**
Every number the widget displays or the verdict claims has been verified by a
small script that lives *in the repository* (`scripts/verify/<Widget>.mjs`,
run by one `npm run verify:numbers`), and the header comment cites that path.
Session scratchpads are not evidence (craft.md §Verification has the story),
and assertions must be able to fail: `assert(|a − a| < 1e-12)` holds for any
input, and it was found in a shipped widget. No naked `Math.random`: seeded RNG, with an explicit "new sample"
button if resampling is wanted. Degenerate states are either made unreachable
by constraints (clamp a < b − ε) or detected and explained, never silently
wrong. Tolerance is not equality: a determinant below 0.05 is not
"singular", nearly parallel lines are not "parallel". Verdicts distinguish
exactly degenerate, nearly degenerate and regular states (details in
`craft.md` §Numbers and rubric F3) and name the mathematical reason, not
just the measured value. A statement that holds only for the widget's three
curated cases is not stated as a theorem.

## Workflow: adding or redesigning a widget

1. **Name the one insight.** One widget = one claim the reader should walk
   away believing because they *did* something ("equidistant interpolation
   nodes blow up at the boundary, Chebyshev nodes don't"). If you have two
   insights, build two widgets or a two-stage widget. Write the insight as a
   comment at the top of the file.
2. **Pick the pattern.** Open `references/design-patterns.md`, use the
   decision table. Default combo for a quantitative claim:
   *predict-then-reveal* wrapper + *direct manipulation or slider* +
   *reactive verdict*. First climb the ladder of smallest effective form
   (pattern 11 in `design-patterns.md`: no figure → static figure → static
   pair → interaction) and stop at the first rung that shows the insight
   completely; zero widgets is a legitimate outcome for a section. If a
   static form wins, build that (Patel: "interactivity isn't always
   needed"; publisher data says most readers never touch optional
   interactives).
3. **Design the presets and edge cases before the visuals.** Choose 3–5
   presets that *are* the case distinction, with didactic labels; choose
   defaults showing the phenomenon; enumerate degenerate states and decide
   clamp-away vs detect-and-explain.
4. **Verify the numerics** with a script under `scripts/verify/` that asserts
   the claimed values (and would fail if they were wrong); cite its path and
   the verified values in the header comment.
5. **Build** against `references/craft.md` (responsiveness, pointer
   handling, color roles, a11y, transitions). Reuse the app's shared
   component library; extend it rather than forking a third slider.
6. **Write the surrounding prose**: question before, consolidation after,
   and a one-line task caption at the widget ("Drag both endpoints onto the
   same branch of the double well."). The project's style guide governs
   tone.
7. **Self-review** with `references/review-rubric.md`; fix everything rated
   CRITICAL or MAJOR before handing over. Run the project's type checks
   (`npx tsc --noEmit` or equivalent), then *look at it rendered* at a
   phone width (~390 px) and a desktop width. Source review and screenshot
   review catch disjoint defect classes (see "Acceptance" below).
8. **After a fix round, cut.** Fixes inflate (a caveat lands in prose,
   task line, verdict and closing at once). Record a word-count baseline
   before fixing and run a shortening pass after; rubric step 7 has the
   details.

## Acceptance needs two passes

Source review and rendered review catch disjoint defect classes, and
neither can stand in for the other. A screenshot pass reports nothing about
minified files, missing headers, verdicts that never change or tautological
verify scripts; a source pass cannot see a solution visible before the
reveal, a marker under the legend, a panel wider than the phone, or an SVG
collapsed to 2 px inside a flex column (all found in one project after the
other pass had said "no defects"). So sign-off means both: read the
source against the rubric *and* look at every widget rendered at ~390 px and
~1300 px, and a "no defects" claim is only credible once the denominator
(how many widgets exist) was counted from the source tree, not from what
happened to be on screen.

## Placement

Place a core-insight widget inline in its section, right after the question-
posing paragraph, in an open "Interactive" box; expandable deep-dive blocks
are for optional *material* (a proof the lecture only cites, an excursion, a
second representation), never for hiding the main widget — choose the wrapper
by whether the material is optional, not by whether it is interactive. Visible
prose must never depend on collapsed content: a self-test question about deep-
dive material goes inside the deep dive, a theorem the main text cites is not
parked in one, and a widget's verdict may not invoke an example that is folded
away (a shortening pass produced a dozen such dangling references in one
review). If the app supports it, links to anchors inside a collapsed block
should open it. Segmenting beats stacking: one core widget per subsection,
extras go behind an expandable. Algorithm steppers sit next to the algorithm
block they animate and reuse its step numbering. Close sections with self-test
questions; make at least one answerable only by having used the widget — that
makes the widget load-bearing. Project-specific placement conventions live in
the target repo's own docs and, if present, its most recent widget review
document — read those for the current house state.

## Reviewing existing widgets

When asked to review or critique widgets (a chapter, the whole app, one
file), read `references/review-rubric.md` and follow its procedure:
count the denominator and read the project's conventions, then the
quantitative scan, then per-widget scoring (source pass and rendered pass)
with a media decision (KEEP / REVISE / STATIC / REMOVE), then a report in
the project's review-report format if it has one. Never "improve" widgets during a review
pass; reviews produce findings, fixes are a separate commissioned step. If
the repo contains a prior widget review, report deltas against its baseline
instead of rediscovering known debts. Read the project's notation conventions
before flagging "errors": one audit's top-priority finding demanded a
column-vector gradient in a script that defines the gradient as a row vector,
and every downstream fix would have been a regression. When the findings come
from an external batch review, expect over-reporting: re-derive each claim
against the source, record verdicts (fixed / rejected + reason / accepted as
design), and make the second round triage-aware so it does not re-report
them.
