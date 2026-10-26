# Choosing a teaching form

Use these as design options, not universal prescriptions. The synthesis by
[Hohman et al., Distill (2020)](https://distill.pub/2020/communicating-with-interactive-articles/)
collects relevant research and examples; it does not establish that every
pattern helps every audience. An expert revisiting a definition may need a
short reference, while a novice needs a worked example before exploration.

| Learning goal | Smallest useful candidate | Add only if needed |
|---|---|---|
| Definition or fixed identity | Explanation and worked example | Annotated figure |
| Compare methods | Aligned static panels/table | Shared controls for meaningful variation |
| Geometry of a transformation | Object and image together | Dragging or sliders on relevant coordinates |
| Boundary or regime change | Contrasting cases | Continuous control and regime explanation |
| Algorithm mechanics | Short annotated trace | Reversible stepper highlighting the active operation |
| Correct a plausible misconception | Question and explanation | Skippable prediction/reveal |
| Sampling variability | Several realizations or distribution | Explicit resampling and seed control |
| Retrieve a prerequisite | Inline gloss or existing section link | Short concept pop-up |

## Interaction

Link representations when the correspondence is the lesson: a matrix and its
image, a residual and its geometric projection. Keep notation and color roles
consistent, but do not add a third panel just to fill a template.

Choose controls by meaning and ease of use. Spatial dragging can clarify
geometry; numeric input is better for exact values; sliders are good for a
bounded scalar. Offer presets only for genuinely different cases. Provide
reset when it helps recover the starting example.

For a comparison, preserve comparable axes and inputs. Side-by-side views
reduce memory demands when they remain legible; a labeled toggle, overlay,
or stacked view can be better on a phone. Do not interpolate discrete objects
through mathematically invalid states just to animate a switch.

## Guided learning without click requirements

For an unfamiliar procedure, begin with a worked example; let the learner
control the pace of a longer trace and return to earlier states. Preserve a
full-trace/full-proof view for review. Retain the project's chosen default.

Ask for a prediction only when the learner has enough information to make a
meaningful one. Keep a reveal/skip path, preserve the attempted answer, and
explain the discrepancy. Do not hide essential definitions or make routine
reading contingent on answering correctly.

A task should require a mathematical decision, not repeated adjustment until
an arbitrary target turns green. A useful follow-up changes the example or
asks why the observation holds. A widget-independent answer is not a defect.

## Feedback

Use adjacent labels, annotations, or short prose to connect action to meaning.
A constant explanation is appropriate for an invariant. A changing verdict is
useful for regime changes, failed assumptions, or a misleading numerical
state. Cite a numbered result only when it helps the reader connect ideas.
Do not repeat the same conclusion in four places.

State all regimes that the actual controls allow. For gradient descent on
f(θ)=θ², θ[k+1]=(1−2γ)θ[k]: with θ[0]≠0 and γ≥0, γ=0 gives no movement,
0<γ<1/2 monotone convergence, γ=1/2 reaches zero in one step,
1/2<γ<1 alternating convergence, γ=1 a two-cycle, and γ>1 alternating
unbounded growth in exact arithmetic. θ[0]=0 stays zero for any finite γ.
An overflowing floating-point trace is a separate implementation condition.

## Concept pop-ups and optional material

A prerequisite pop-up should answer the immediate question without requiring
another pop-up. Start with a definition and, when useful, one small example.
Do not force every concept through a question/widget/verdict narrative.
Link only needed prerequisites; reuse existing explanations and resolve
synonyms. Stop recursive expansion at the declared audience boundary.

Use expandable blocks for optional depth. Keep essential assumptions and
interpretation visible; an optional reference into a collapsed block is fine
if navigation reveals it. For print, use a representative figure or a concise
worked conclusion, not a narration of every control state.
