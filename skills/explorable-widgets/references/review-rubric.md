# Widget review

Review the requested scope. Read-only requests produce findings; analyze-and-
fix requests permit confirmed fixes in the same task. Do not expand a single
widget repair into a chapter audit.

## Procedure

1. Identify the affected widgets, their callers, surrounding text, and host
   conventions. For a whole chapter/app, inventory the scope from source.
   Check previous findings against the current revision, including rejected
   findings and accepted design decisions.
2. Read the source and its mathematical claim. Inspect rendering and operate
   relevant states at narrow and desktop widths. For large scopes, state
   exactly what was sampled and why; an unrendered item remains unverified.
3. Apply the applicable criteria below. Mark others N/A. A missing preferred
   component, header, animation, or verdict is not by itself a learning defect.
4. Decide KEEP / REVISE / STATIC / REMOVE. Report file:line, evidence,
   consequence for the learner, and a concrete repair. Severity follows the
   consequence, not the number of checklist items absent.
5. After fixes, check the affected behavior and dependencies; remove redundant
   prose. Broaden the review only when a shared defect or regression warrants it.

## Criteria

| Area | Questions |
|---|---|
| Purpose | What does acting on this teach beyond the static form? Does it duplicate another explanation? |
| Context | Are the example, quantities, symbols, units, and assumptions introduced where needed? |
| Mathematics | Are theorem conditions and boundary cases correct? Are numerical tolerance, exact equality, and conditioning distinguished? |
| Representation | Does the picture represent the actual computed state? Are comparison scales honest? Is an illustrative sample mistaken for a general result? |
| Feedback | Can the reader interpret the result? Are changing regimes explained where needed, and invariant explanations allowed to stay constant? |
| Controls | Are tasks reachable, state changes coherent, reset reliable, and traces reversible where useful? |
| Access | Can the task be completed by keyboard and without dragging? Is focus visible? Are symbols and color supplemented by text? |
| Layout | Do graphics, labels, controls, and pop-ups remain usable on a phone and desktop, in all surfaces actually used? |
| Learning | Is guidance proportionate to prior knowledge? Are predictions skippable and follow-ups about reasoning rather than clicks? |
| Robustness | Do checks exercise production calculations against independent values/invariants? Are invalid inputs, stochastic seeds, and relevant edge cases covered? |
| Reading path | Is core material available without hidden prerequisites? Is a requested print/static equivalent informative? |
| Cost | Are expensive calculations or mounted hidden widgets doing unnecessary work? Does a new dependency or abstraction earn its maintenance cost? |

CRITICAL: teaches a false mathematical result or silently produces materially
wrong outputs. MAJOR: prevents the learning task or excludes a supported input
method/device. MINOR: a local usability or clarity defect. NOTE: an optional
improvement. Missing evidence is reported as a verification gap; it is not
proof of a mathematical error.

A useful final report leads with confirmed problems and changes, then states
the inspected revision/scope, checks run, and remaining limitations. Do not
claim screenshots establish numeric correctness or greps establish usability.
