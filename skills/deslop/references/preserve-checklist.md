# Preserve checklist — what a deslop pass must NOT do

This merges the technical-term firewall with over-correction risks and the positive
signs of good writing that a naive "AI-detector" pass would wrongly flag. If a proposed
edit conflicts with anything here, don't make it.

## Over-correction risks
- **No folksiness** — no "let's dive in", rhetorical questions, chatty asides, in a
  research-paper or peer-review profile. Plain ≠ casual. (Teaching-material and email
  profiles relax this — see SKILL.md §Step 1.)
- **Don't strip necessary hedges** — scope conditions and calibrated verbs ("is
  consistent with", "suggests") encode real uncertainty. Only kill stacked/reflexive
  hedging (see structural-tells.md).
- **Never touch equations, notation, defined symbols, numbers, citations, cross-refs,
  code chunks.** These are not prose and this skill has no business near them.
- **Don't break comprehension-aiding parallelism** — enumerated assumptions, matched
  conditions readers compare at a glance, are supposed to look parallel.
- **Don't flatten precise terms** ("confidence interval" ≠ "range we're confident
  about"; "asymptotically normal" ≠ "roughly bell-shaped").
- **Keep "significant/significantly" where it means statistical significance;** don't
  add it as an intensifier elsewhere either.
- **Don't over-shorten into staccato** — vary, don't uniformly truncate; a run of
  manufactured short punchy sentences is its own tell.
- **Don't abolish the passive reflexively** — some passives are correct (unknown or
  irrelevant agent, object-as-topic: "the data were collected in 2019" needs no actor).
- **Don't homogenize domain vocabulary** — repeating the exact technical term is
  correct, not repetition to "fix" (DO principle 9).

## False positives — do not flag these on their own
- Perfect grammar and a consistent style, by themselves.
- Mixed casual/formal registers within one document (a person, not a template, wrote
  this).
- Formal or academic vocabulary that happens to overlap the word lists but is used
  precisely (see the firewall).
- A single em-dash, a short sentence, or a curly quote in isolation — density and
  clustering are the signal, not one instance.
- Unsourced claims that are actually fine in context (the author's own prior result,
  a well-known fact in the sub-field).
- Text inside direct quotations, code, or titles — never edit quoted material to
  "de-slop" it.

## Signs of good human/academic writing to preserve
- A specific, hard-to-fabricate number, effect size, or citation.
- Calibrated hedges tied to an actual scope limit ("in our simulations", "for G ≥ 40").
- A defensible stylistic choice that breaks the "expected" pattern (an intentional
  short sentence after a long one, a genuine rhetorical aside in a discussion section).
- Genuine self-correction or qualification mid-argument ("a first look suggested X; on
  closer inspection this was an artifact of...").
- Repetition of an exact defined term across a document — this is precision, not a
  style problem.

## Rewrite, don't just delete
When a phrase carries real information wrapped in puffery, rewrite it down to the
information rather than deleting the sentence outright — the goal is a leaner true
claim, not a shorter false one. "This finding underscores the critical importance of
grid resolution" → "grid resolution matters" (or, better, the actual number: "coverage
rises from 60% to 90% between the coarse and medium grids").
