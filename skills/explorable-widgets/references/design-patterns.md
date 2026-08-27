# Design patterns for explorable widgets

Sources: Victor, "Explorable Explanations" (2011) and "Up and Down the Ladder
of Abstraction" (2011); Case, "Explorable Explanations" (2014) and "4 More
Design Patterns" (2018); Hohman, Conlen, Heer, Chau, "Communicating with
Interactive Articles" (Distill 2020) — the best single synthesis, with the
education-research citations; Patel, Red Blob Games "making-of" pages;
Mayer's multimedia learning principles as summarized in the Distill piece.

## Decision table

| Teaching goal | Primary pattern | Add |
|---|---|---|
| Quantitative claim with a surprising answer | 1 Predict-then-reveal | 6 verdict |
| Geometric/structural intuition (what does A do to space) | 2 Direct manipulation | 3 linked representations, 10 readouts |
| "These two things are the same object seen differently" | 3 Multiple linked representations | 2 |
| "Method X beats method Y (here)" | 4 Side-by-side comparison | 5 presets |
| Case distinction (convex / strictly / concave / neither) | 5 Curated presets | 6 verdict |
| Algorithm dynamics | 7 Stepper with narration | play opt-in (in 7); 12 for discrete jumps |
| "Prove you got it" | 8 Puzzle/task, or quiz | — |
| System with several interacting mechanics | 9 Build-up, sandbox last | Case's interest curve |
| Definition/parameter with a continuum of behaviors | slider + 6 verdict | 10 |
| None of the above / a static figure suffices | **11 Don't build a widget** | — |

## 1. Predict-then-reveal (belief elicitation)

Ask for the reader's expectation *before* showing the answer: click where the
maximum will be, drag a guess curve, pick "grows / falls / stays", type a
number. Only then reveal, and show the gap. Evidence: Kim, Reinecke & Hullman
(CHI 2017) — drawing your prediction measurably improves recall and
comprehension; NYT "You Draw It"; Case's "Place Your Bets"; Strogatz:
traditional teaching "answers questions the student hasn't thought to ask" —
this pattern makes them ask.

Stack sketch: a small wrapper component holding phase `"guess" | "revealed"`;
in phase 1 render the click/drag guess layer over the empty axes and a
"reveal" button; in phase 2 render truth + guess + delta and the verdict.
Persist the guess so re-opening shows it. For curve guesses: pointer-drawn
polyline snapped to the x-grid.

Anti-patterns: static text that announces the outcome above the widget
("beyond γ = 1 the iteration diverges") — move all outcome statements into
the *post-reveal* verdict; asking for a prediction when the answer is obvious
(then it's patronizing, skip the wrapper).

## 2. Direct manipulation of the mathematical object

The reader drags the thing itself: the vector x (and watches Ax), the data
point (and watches the fit), the interval endpoints, the knot, the constraint
boundary. Victor's core mechanism: the barrier is "simply click and drag",
which converts skimmers into explorers. Every parameter that *is* a point,
vector, or position in the diagram should be draggable there, not only
adjustable by a control elsewhere.

Rules: dual-path (a slider/number mirrors every draggable — keyboard access +
trackpad mercy); enlarged or invisible hit areas; clamp to legal region while
dragging; live readout of the dragged value. Implementation recipe in
`craft.md` §Pointer.

Anti-pattern: numeric-input-only interaction for a geometric concept —
typing numbers is the *highest* barrier interaction; keep it as the
precision path, not the primary one.

## 3. Multiple linked representations

Show 2–3 representations of the same state, updating together: algebraic
(the matrix, the formula with the current numbers substituted, colored
consistently), geometric (the SVG/canvas), numeric (the readout table).
Victor's filter example uses six; the Distill piece grounds this in Mayer's
multimedia principle. The link is the lesson: the reader learns the
*correspondence* by seeing both move.

Rules: one color = one subexpression across all representations; substitute
the *current* interactive values into the displayed formula, don't show a
generic formula next to a specific picture. Inline legends: describe diagram
elements by drawing them in the text/caption (a short colored line segment
inline) instead of "the green line" alone (Patel).

## 4. Side-by-side comparison

For "X vs Y", render both simultaneously with shared controls, not a toggle.
Patel: it's cognitively hard to evaluate one thing on its own and easy to
compare two next to each other; "it's often better to show all the variants
than to ask the reader to interact to see them." Sync the axes, sync the
inputs, difference-annotate (max gap marker, ratio).

Use a toggle only when the two states must occupy the same space to show
correspondence — and then with a transition (pattern 12).

## 5. Curated presets as arguments

Preset buttons are the case distinction made clickable. Each preset earns its
place by exhibiting one branch; label with the *didactic* name ("convex, not
strictly"), not the formula; set start parameters so the branch's phenomenon
is visible without further interaction. 3–5 presets; a "custom" free mode may
follow them. Presets replace random examples: randomness never argues.

## 6. Reactive verdict text

State-classified interpretation under the graphic: classify the current state
into the pedagogically distinct cases and write one short paragraph per case,
citing the script's numbered results ("Theorem 3.2", "(3.4)"). Include the
non-events ("this pair passes the test — which proves nothing, because…").
Numbers in verdicts use the script's locale formatting. This is the widget
"holding up the author's end" (Victor) and doubles as self-explanation
prompting (Chi; Distill §Prompting Self-Reflection).

Rule of thumb: if the verdict would read identically for all states, the
widget has no insight; rethink it. Two more failure modes from audits: a
verdict that only echoes the readout ("det = 0.03") instead of naming the
mathematical reason, and a two-state verdict where the mathematics has
three: exactly degenerate, nearly degenerate (small but nonzero: say
"ill-conditioned", not "singular"), regular.

## 7. Stepper with narration

For algorithms: one button = one algorithm step; each step highlights the
active line/quantities in the section's colors and appends a one-line
narration ("line 3: largest pivot in column 2 → row swap"). Keep the full
trace visible or scrubbable (a step slider), so the reader can go back —
scrub beats click-only. Numbering matches the algorithm block in the prose.

Play/pause + speed is an opt-in extra for long runs (gradient-descent
zigzag); default remains manual stepping (deliberate pace, calm page — add an
animation loop only inside an explicit play mode).

## 8. Puzzle / task gate

Give a goal the reader can only hit by understanding: "find a pair (x, y)
for which the double well passes the chord test" / "set γ so the method hits
the minimum in one step." Detect success and acknowledge it in the verdict.
Case: puzzles roll teaching and assessment into one; SineRider's insight is
that inventing a solution forces the thinking that a follow-the-recipe demo
skips. Cheap version: an explicit challenge line in the widget caption +
success detection. Quiz blocks are the non-interactive fallback; at least one
closing question per section should require having used the widget.

## 9. Build-up, sandbox last

For systems with several mechanics: teach each mechanic in an isolated
mini-widget first, then combine; the full sandbox (all knobs) comes last,
when the reader can appreciate it (Case: "start small, build big"; Earth
Primer; Parable of the Polygons). A sandbox first = information overload
(Case on TensorFlow Playground). Within one section this often means: two
small fixed widgets, then one free one in a deep-dive block.

## 10. Details-on-demand

Overview first, details on demand (Shneiderman). At data level: hover/tap
readout of coordinates and values on plots; tooltips on diagram elements.
At text level: concept tooltips and expandable deep-dive blocks — keep the
happy path short, park depth behind one interaction. At math level: hover a
term to see it highlighted in the diagram (consistent semantic coloring of
formulas is the static half of this).

## 11. Don't build a widget: the ladder of smallest effective form

Interactivity has costs: build time, load time, mobile pain, and most
readers won't touch it (NYT internal data via Distill). Climb the ladder
and stop at the first rung that shows the insight completely:

1. no figure: definition plus one worked example already suffices;
2. one static figure or table: a curated view shows it all;
3. two static views side by side: the comparison is the point;
4. interaction, only when the *change* teaches: the reader manipulates the
   object and checks an invariant or boundary, several didactically distinct
   cases must be explored and a static pair would be cluttered, continuous
   variation reveals a transition/stability/asymptote a single frame hides,
   or a genuine prediction gets tested by the action.

Warning signs that a widget sits above its rung: sliders that only decorate a
graph, a task that is "hit this number/curve", many buttons replaying the same
case, the decisive insight fully visible in the initial frame, a verdict that
restates the current value. In an audit of 137 concept pop-ups only 3 widgets
were over-built (better static), while 60 needed revision for prose defects
(missing hypotheses, quantities the text never introduced): the ladder
prevents building the wrong thing, the pop-up arc below prevents the common
defect. When time evolution itself is the object and the reader has no
decision to make, an animation (with pause) fits better than interaction. When
cutting, keep duty 2: bake the best state into a figure.

## 12. Transitions for discrete jumps only

Continuous controls need no animation — the reader generates the in-between
states by dragging. Discrete toggles (basis A ↔ basis B, flat ↔ pointy,
equidistant ↔ Chebyshev knots) *do* need a transition, otherwise the
correspondence between the two states is invisible (Patel; Heer & Robertson
2007 on animated transitions). 200–300 ms, ease-in-out, interpolate
positions not pixels.

## Concept pop-ups (tooltip explanations)

A pop-up is a self-contained mini-explanation, judged as a whole, not by its
widget. Arc: **definition/problem → concrete example → guiding question → an
example, figure or action, whichever rung of the ladder suffices → explicit
insight**. The opening answers "what is it?" and "what do I need it for?";
every quantity, rule or scenario the example or widget uses is introduced
*before* it appears; statements name their hypotheses and scope (a rule of
thumb is not a theorem, a fact about the three curated cases is not a general
fact); the closing paragraph states what was learned rather than "the widget
makes this visible". Link a prerequisite when the reader genuinely needs it
explained; a pop-up that requires opening two more pop-ups is no longer self-
contained, and cycles just grey out in the engine. The most common audit
findings, in order: special case stated as a general theorem; widget uses an
example the prose never introduced; tolerance treated as equality; interaction
that replaces explanation.

## Section-level dramaturgy (Case's interest curve)

Hook with a concrete, low-prerequisite question or mini-interaction; build
mechanics in isolation; combine; close with something only now appreciable
(the sandbox, the hard quiz question, the real-data example). Content gating
is legitimate: withholding the resolution until after the prediction or the
task increases learning (Case's playtesting lesson from Earth Primer).
