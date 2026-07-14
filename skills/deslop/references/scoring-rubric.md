# Optional scoring rubric and scientific gate

Use only for a short, high-stakes passage (an abstract, a cover letter, a key
paragraph) where it's worth a final quantitative gut-check. Skip it for routine edits —
it does not replace the workflow in `SKILL.md`, and a low score with no obvious P0/P1
finding is not itself a reason to keep cutting.

## Style score

Rate each dimension 1–10 after the rewrite:

| Dimension | What it measures | Low score looks like |
|---|---|---|
| **Directness** | Claims stated plainly vs. announced/hedged | "It is worth noting that the method may offer some improvement" instead of the actual number |
| **Rhythm** | Sentence and paragraph length variation | Every sentence 15–25 words, every paragraph the same shape |
| **Trust** | Respects the reader's intelligence | Over-explains, restates the previous sentence, hand-holds |
| **Authenticity** | Reads like a specific person made specific choices | Uniform register, no defensible stylistic quirks, could have been written about any topic |
| **Density** | No unnecessary words | Nominalizations, throat-clearing, filler connectors survive |

Total out of 50. Below 35 suggests another pass is warranted — but check *which*
dimension is dragging the score down before cutting more; a low Rhythm score is fixed by
varying sentence length, not by removing more vocabulary.

This rubric is a synthesis convenience borrowed from a couple of public "de-slop"
Claude-Code skills (stephenturner/skill-deslop, hardikpandya/stop-slop) — it is a
sanity-check heuristic, not a validated instrument. Don't over-index on hitting a
number; the workflow in SKILL.md is the actual method.

## Scientific-writing gate

For an abstract, key results paragraph, or conclusion, apply these pass/fail checks
after the style score. Do not average them into the score: elegant prose cannot offset
an unsupported scientific claim. Read `scientific-writing-checklist.md` for the full
audit.

- [ ] **Question:** The passage makes clear what question is answered and for whom or
  under what conditions.
- [ ] **Support:** Every main claim is traceable to a reported result or an exact,
  relevant citation.
- [ ] **Calibration:** Magnitude, uncertainty, limitations, and causal scope match the
  design and evidence.
- [ ] **Transparency:** The passage does not hide missing data, exclusions, analytic
  flexibility, exploratory status, or relevant null/negative findings.
- [ ] **Consistency:** Numbers, terminology, and claims agree with the Methods, Results,
  tables, figures, and abstract/body as applicable.
- [ ] **No invention:** Every edit is supported by the source text; missing scientific
  content is an AUTHOR QUERY, not a guessed repair.

Any failure blocks a “scientifically clean” verdict. Fix text-supported failures and
return content-dependent failures as AUTHOR QUERY items.
