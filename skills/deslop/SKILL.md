---
name: deslop
description: Edit prose to remove LLM/AI-writing tells (inflated vocabulary, formulaic phrases, vague authority, chatbot scaffolding, mechanical triads, and formatting tics) without changing content, numbers, citations, or technical meaning. Use when asked to de-slop, humanize, remove AI tells, or check a draft for chatbot phrasing, and proactively before finalizing a paper section, peer review, Gutachten, grant, teaching material, or email. For scientific manuscripts, also audit claim–evidence alignment, uncertainty, causal scope, reproducibility detail, and reporting completeness without inventing missing science. Preserve load-bearing domain terms such as robust, sandwich, leverage, penalized, coverage, efficient, significant, and power.
---

# Deslop

Make prose read like careful human scholarship, not chatbot output — **without changing
any content, number, citation, or technical meaning.** This skill edits for the *reader*,
not for an AI-detector: no single marker proves a sentence is AI-written, and the goal is
better prose, not a lower detector score. Don't mangle a good sentence (an elegant
em-dash, a deliberate triad) just to look human.

Companion reference: `references/jargon-glossing.md` for a lighter, separate check
(undefined abbreviations), not the focus of this skill.

## Step 0 — the technical-term firewall (read this before cutting anything)

Every list below has false positives in technical writing. Statistics/FDA prose uses
words that look like AI puffery but are precise, load-bearing terms:

| Term | Technical meaning — do not strip or "simplify" |
|---|---|
| robust | robust standard errors / robust (sandwich) covariance |
| sandwich | the sandwich (Huber–White) variance estimator |
| leverage | leverage / hat values; leverage adjustment |
| penalized | penalized likelihood / splines |
| coverage | confidence-interval coverage probability |
| efficient/efficiency | estimator efficiency |
| significant/significance | statistical significance — not an intensifier, don't add it as one either |
| consistent | statistical consistency of an estimator |
| power | statistical power |
| basis, spline, smoothing, shrinkage, kernel | core method vocabulary |

Rules: (1) never remove a term used in its technical sense; (2) never swap
`significant`→`important`, `efficient`→`fast`, `power`→`strength`, `bias`→`slant`,
`consistent`→`reliable`, `robust`→`strong` when the technical sense is meant; (3) a word
is a cut candidate **only** in a decorative, non-technical sense ("a *robust* discussion",
"*leverage* our findings", "a rich *tapestry* of methods") — judge by sense, not spelling;
(4) when in doubt, keep it. This isn't specific to statistics — any domain has its own
load-bearing vocabulary (legal "consideration", ML "bias", medical "significant"); the
same judge-by-sense rule applies outside academic writing too.

It is density and pattern, not any single word, that reads as AI. Flag when several
markers cluster in a short span; don't hunt lone instances across a whole document.

## Step 1 — pick a document-type profile

The same phrase can be a tell in one register and normal in another. Pick (or ask):

| Profile | What changes |
|---|---|
| **Research paper** (JSS/JCGS, thesis chapter) | Full firewall + style checklist + `references/scientific-writing-checklist.md`. Sentence-case headings. Never touch equations, notation, citations, cross-refs, code chunks. |
| **Peer review / Gutachten (referee report)** | Same firewall. Direct evaluative judgments ("this claim is unsupported", "the simulation is underpowered") are the genre, not overclaiming — don't soften them looking for "hedge-then-pivot". Vague-authority and citation rules still apply. |
| **Teaching material** | Didactic tone, rhetorical questions, and simpler vocabulary are appropriate for students — don't flag as "folksiness". German is fine. Bullet lists for genuinely enumerable items are fine. |
| **Email / informal note** | Relaxed. Skip formatting-tell scrubbing (bold, headings) unless egregious. Focus on P0 only (§Step 2) plus obvious chatbot scaffolding. |

Default to **research paper** if the context is a manuscript, paper section, or anything
headed for a journal — that's the strictest profile and the safest default.

## Step 2 — severity triage

On a long document, don't flag everything with equal weight. Work top-down:

- **P0 — credibility killers, fix always:** vague authority ("studies suggest", "experts
  agree", "it is widely believed", "research shows" with no citation) → cite the specific
  work or drop the claim; inflated significance/overclaiming beyond what the evidence
  shows (calibrate to the evidence, state assumptions); any leftover chatbot scaffolding
  ("Certainly!", "Here's a breakdown", sign-offs) — should not exist in submitted prose,
  delete on sight.
- **P1 — obvious AI smell, fix in a normal pass:** vocabulary hits from
  `references/vocabulary.md` (checked against the firewall first); formulaic phrases
  (negative parallelism "not just X, it's Y", vacuous openers, "plays a pivotal role in");
  structural tells (rule-of-three overuse, persistent claim→three-supports→summary
  paragraph shape, self-narrating signposting "First… Second… Third…", hedge-then-pivot
  stacking).
- **P2 — polish, fix last:** formatting (bold lead-ins, title-case headings, em-dash
  density, emoji), DO-principle nits (buried verbs, nominalizations, sentence-length
  monotony).

Details and full word/phrase lists for P1/P2 are in `references/vocabulary.md` and
`references/structural-tells.md` — read those before a full pass on a real document;
this file gives you the workflow and judgment calls, not the exhaustive lists.

For a research paper, abstract, thesis chapter, or grant, also read
`references/scientific-writing-checklist.md`. Treat unsupported claims, causal
overreach, hidden uncertainty, and selective reporting as P0 scientific-writing
findings. Treat missing reproducibility or reporting detail as **content queries**, not
copyediting opportunities: flag what the author must supply and never fabricate a
citation, method, result, limitation, or rationale.

## Step 3 — quick pass, in order

1. Strip chatbot scaffolding / emoji (P0).
2. Fix vague authority and inflated-significance claims (P0).
3. Thin connector crutches and decorative vocabulary — **re-check the firewall on every
   robust/leverage/sandwich/penalized/efficient/significant/consistent/power** before
   cutting (P1).
4. Break formulaic phrases: negative parallelism, vacuous openers, "It is important to
   note that…" framing — delete the frame, keep the fact (P1).
5. Break mechanical triads, persistent parallelism, uniform paragraph shapes; apply the
   DO principles below (P1).
6. Sentence-case headings; reduce em-dash/bold density without over-correcting;
   straighten curly quotes if the surrounding doc uses straight ones (P2).
7. Optional: run `references/jargon-glossing.md` if the document uses codenames or
   non-standard abbreviations.
8. For scientific prose, run the scientific-writing checklist and separate findings
   into (a) edits supported by the existing text and (b) author queries requiring
   evidence, decisions, or missing information.

## DO principles (so the edit improves prose, not just removes words)

1. **Concrete actor in the subject, real action in the verb.** "We estimate θ by
   maximizing the penalized likelihood," not "Estimation of θ was carried out through
   maximization…".
2. **Un-bury verbs — cut nominalizations** (-tion/-ment/-ance): "we investigate how the
   estimator behaves", not "our investigation of the behavior of the estimator".
3. **Cut throat-clearing; open on the claim.** ("In order to", "the fact that" → gone.)
4. **Old/known info first, new info last** — the main cohesion lever; it's what makes
   paragraphs flow.
5. **Vary sentence length and end on the strong word.** Let a key finding land in a short
   sentence after a longer setup.
6. **One main idea per sentence;** subordinate the secondary.
7. **State findings plainly; hedge only where warranted.** Keep scope limits ("in our
   simulations", "for large G") — those are legitimate, not filler.
8. **Signpost sparingly** — keep load-bearing pointers ("Appendix C proves…"), cut ritual
   ones ("this section will…").
9. **One name per concept, kept exact** — never trade a precise term for a "friendlier"
   vaguer one, and don't synonym-cycle a defined term just to avoid repeating it.
10. **Restraint — let the results carry the weight.** Report the number and stop.

## Preserve — what NOT to touch

Read `references/preserve-checklist.md` before finishing any pass — it merges the
firewall above with over-correction risks and the positive signs of good human/academic
writing (specific numbers, calibrated hedges, defensible stylistic choices, genuine
asides). In short: no folksiness, don't strip necessary hedges or scope conditions,
never touch equations/notation/citations/cross-refs/code chunks, don't break
comprehension-aiding parallelism (e.g. enumerated assumptions readers compare at a
glance), don't flatten precise terms, don't abolish the passive reflexively, don't treat
perfect grammar or a single em-dash/short-sentence as proof of anything.

## Operating modes

- **Detect** — list the P0/P1/P2 findings with quotes and locations; let the user decide
  what to fix. For scientific prose, label content-dependent findings **AUTHOR QUERY**.
  Use this first on a long or sensitive document.
- **Rewrite** — apply the fixes and return the edited text (or edit the file in place
  with the editing tool for an existing document). Always show what changed, briefly.
  Do not resolve an AUTHOR QUERY by guessing; leave a comment or report it separately.
- **Iterate** — after a rewrite, do one more detect pass over the result; if it's clean,
  stop. Real prose does not need more than two passes — a third pass is a sign the
  approach isn't working, not that more scrubbing is needed.

## Optional final gate

For a short high-stakes passage (abstract, cover letter, key paragraph), score the
result with the style rubric in `references/scoring-rubric.md`. For scientific prose,
use the separate pass/fail scientific gate in that file as well. Skip scoring for
routine edits; neither tool is a validated measure of manuscript quality.
