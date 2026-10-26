---
name: explorable-widgets
description: >
  Design, build, simplify, or review interactive teaching figures and widgets.
  Use for educational simulations, algorithm steppers, and explorable
  explanations, including their surrounding prose, and when the user says
  "make this section interactive", "this widget is boring", or "review the
  widgets in chapter N". Follow the host project's stack; an interactive
  widget is not required when a static explanation works.
---

# Explorable Widgets

Start with what the learner should understand, then choose the smallest form
that teaches it: prose or worked example → static figure/table → comparison →
interaction. A widget earns its controls when changing something reveals a
relationship, tests a conjecture, or exposes a boundary that is hard to see
statically. Do not add interaction merely to satisfy this skill.

Read the host project's notation, audience, and relevant components first.
Preserve its language, number formatting, stack, and existing user decisions.

## Design and build

1. Identify the learning objective and the likely misconception. Check whether
   the surrounding text already teaches it. For a requested fix, preserve
   useful behavior and avoid expanding the scope into a redesign.
2. Choose a representation and controls that match the task. A slider can be
   the complete interaction; dragging is useful for spatial relationships,
   not a universal upgrade. Read [design-patterns.md](references/design-patterns.md)
   when choosing among patterns. Presets, predictions, animation, and quizzes
   are optional, not a checklist to accumulate.
3. Make the example understandable: introduce its quantities and assumptions
   in the text or adjacent labels, show an informative starting state, and
   interpret what changes. A labeled diagram or invariant statement may do
   this without a changing verdict. Add state-dependent explanation when a
   change of mathematical regime needs it.
4. Implement with the host's primitives. Read [craft.md](references/craft.md)
   for input handling, numerics, accessibility, and verification. Every drag
   needs keyboard access and a non-drag pointer alternative. Keep controls
   and the plotted state consistent, including reset and invalid inputs.
5. Check the mathematical claim, boundaries, and the actual implementation.
   Use focused, reproducible checks for nontrivial numerics and state
   classification; import the production calculation where feasible and
   compare against an independent oracle or invariant. A duplicate formula
   in a separate script does not establish that the widget is correct.
6. Inspect changed widgets at narrow and desktop widths and exercise their
   important states. Run relevant project checks. Report anything not
   rendered or tested. Remove explanation repeated across caption, task,
   readout, and conclusion before handing over.

## Pedagogical constraints

- Core material stays available on the main reading path. Optional proofs,
  examples, and excursions may be expandable. An optional link into a deep
  dive is fine; silently requiring its contents to follow the main text is not.
- The section remains understandable without operating a widget. Provide a
  useful static/print equivalent when that output is in scope. A placeholder
  alone cannot carry a lesson.
- Prediction is optional and skippable. If used, keep its answer hidden until
  reveal, while making the question and starting conditions clear. Do not
  require the initial state both to reveal and conceal the same result.
- Assess reasoning and transfer, not whether the reader clicked a control or
  copied a number. A question can ask for a new case, an explanation, or a
  counterexample. No quota of quizzes, widgets, presets, or verdict branches.
- A simulation illustrates under its assumptions; it does not prove a general
  theorem. Distinguish mathematical equality, numerical tolerance, and
  conditioning. Small determinant alone is not a condition-number diagnostic.
- For stochastic lessons, expose/resample the seed deliberately, keep samples
  fixed across comparisons when appropriate, and distinguish Monte Carlo
  variation from the theoretical target. Do not select a flattering sample
  and imply it is representative evidence.

## Review

For a review request, use [review-rubric.md](references/review-rubric.md).
Review-only means findings without edits; a request to analyze and improve
also authorizes fixing confirmed issues. Check previous findings against the
current source and documented conventions before repeating them. Report
scope and evidence, rather than claiming universal acceptance from a sample.
