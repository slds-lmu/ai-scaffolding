---
name: interactive-textbook
description: >
  Create, extend, or simplify an interactive textbook or web course companion
  from lecture notes, chapters, or papers. Use for chapter structure, readable
  mathematical prose, prerequisite explanations that open on hover (nested
  concept pop-ups), hover previews of the text's own definitions, and
  integrated widgets; also when the user says "make
  chapter X interactive" or asks for an MML-style chapter adaptation.
  Reuse an existing project's stack; the bundled React/MDX app is an optional
  starter for a new textbook, not a required migration or agent workflow.
---

# Interactive Textbook

Build a coherent reading path with useful interaction. Preserve the intended
curriculum, mathematical correctness, and the user's existing conventions.
More widgets, tooltips, prose, or agents are not measures of success.

## Start with the scope

Read the source and inspect the target project before scaffolding. Establish
what is being taught, the audience's prerequisites, language/notation, and
whether the task is a new app, an extension, or a review. Infer these from the
request and existing files; ask only when a missing choice materially blocks
progress. Do not ask again for decisions already supplied.

For a narrow edit, work in place and check its dependencies. For a new chapter,
map the learning objectives and source coverage before writing. Distinguish
core material, necessary bridges, and optional depth. Follow the requested
scope: a summary need not reproduce every subsection; a complete adaptation
must preserve the specified content. Record substantive source errors with
locations and corrections for the author in an errata file; the student-facing
text is simply correct and never says the source is wrong (students should not
see two competing sources), nor does it reproduce the error.

Establish the rights situation before promising anything, and record it in
CONVENTIONS.md with where you found it:

- **User-owned material** (the user's own notes, slides, scripts): no
  restriction beyond what the user states; publication is their call.
- **Open licence** (Creative Commons, free documentation, public domain):
  find the licence statement, put the attribution on the app itself (title,
  authors, link, licence link, "adapted" note), and honour its terms: `SA`
  propagates to the adaptation, `NC` forbids commercial use, `ND` permits no
  distributed derivative at all, and sources under incompatible licences are
  not mixed in one work.
- **Third-party copyrighted source**, the default when no open licence is
  documented (a freely downloadable PDF is not a licence; MML and Heath are
  both free to read and both fully copyrighted): write an independent
  explanation of the same structure and level of detail in your own words;
  reproduce the mathematics exactly (theorems, equations, algorithms, example
  numbers are not copyrightable); recreate figures as widgets or SVG, never
  scans. Neither the paraphrase nor a redrawn figure grants permission to
  publish or distribute the result; that needs the rights holder, so the app
  stays within the use the user is entitled to unless they say otherwise. Run
  the overlap scan in verification.md as a leak detector before delivery and
  triage its hits.

## Choose the implementation

| Situation | Approach |
|---|---|
| Existing textbook or lecture site | Extend its authoring format, renderer, components, and checks |
| One small explorable explanation | Use the host page or a small standalone page; no textbook framework required |
| New React textbook needing math, references, and prerequisite pop-ups | Consider `assets/app-template/` |
| Content-first course requiring other outputs | Prefer the existing document/site system where it meets the needs |

The template contains substantial custom MDX grammar, automatic numbering,
MathJax, and nested concept windows. These solve real problems in fmm-skript,
but add maintenance cost. Keep them in existing consumers; do not introduce
all of them merely to host one slider. Do not switch math engines, rewrite
the parser, or extract a package without checking macro/API requirements and
consumer differences.

For the template's setup and supported syntax, read
[conventions-template.md](references/conventions-template.md). Retain its
numbering/typechecking gates when using that template. For a hosted site,
normal multi-file output is the default; use `build:singlefile` when an offline,
double-clickable HTML file is needed. This build option does not itself add
chapter lazy loading: the starter's section and concept registries are eager.
A large book needs deliberate routing/loading and chapter-aware cross-links.

Fragment links (`#sec-…`, `#eq-…`, `#env-…`) go through
`useFragmentNavigation` (template `src/lib/`, shared with fmm-skript). It opens
enclosing deep dives, aligns tall targets such as whole sections at their start
(not centred, which lands mid-section), and re-aligns while lazy math and
`content-visibility` settle, until the reader scrolls. A host app with its own
router or lazy chapters calls it with a `ready` value and an optional id
resolver. Keep that behaviour when adapting it, and never delete the hook in
favour of the browser's native anchor jump.

## Author and integrate

1. **Pilot a representative section.** Confirm notation, scope, reading length,
   and authoring/build behavior before expanding a chapter. Reuse existing
   definitions and examples; give each substantial result one canonical home.
2. **Write the explanation first.** Introduce the problem, assumptions, and
   notation close to where needed. Use worked examples and annotations for
   unfamiliar procedures. Keep user-selected proof defaults and a way to read
   the full argument. Avoid a compulsory question/definition/widget/quiz mold.
3. **Add only useful interaction.** Apply `explorable-widgets` when available;
   otherwise choose the smallest effective form, keep controls accessible,
   verify numerical claims, and interpret the result. Static diagrams and
   zero-widget sections are legitimate. A widget's caption/readout and prose
   should complement each other, not repeat the same caveat.
4. **Bound prerequisite support.** Reuse IDs and existing section links. Add a
   pop-up only for a prerequisite this audience actually needs here. Make it
   useful without another pop-up. Resolve links against a finite concept list;
   do not recursively generate a second textbook or fill gaps with unreviewed
   stubs just to obtain a green build.
   Terms the text itself defines are a second kind: don't write pop-up prose for
   them. Label the definition and let its own wording serve as the preview
   (template: `:d[term]{#def-id}`, grey underline, footer link to the source;
   `@definition:`/`@theorem:` refs preview on hover too). Link the first real
   mention per later section, and only where the word means exactly the defined
   concept: a misleading link is worse than none. Keep a hand-written
   prerequisite pop-up for a course term where it teaches better than the bare
   definition, or where the term is used before its defining chapter.
5. **Keep the reading path usable.** Core material is visible; optional depth
   may collapse. Links into optional material are fine when explicit and
   functional, but essential reasoning must not silently depend on it.
   If print/export is requested, provide representative figures or worked
   conclusions rather than empty widget placeholders.
6. **Check learning, not interaction counts.** Use selective retrieval,
   explanation, counterexample, or transfer questions. Predictions are
   skippable; quizzes and the number of pop-ups are not completion quotas.
7. **Validate and trim.** Use [verification.md](references/verification.md)
   for the affected scope. After structural edits, check cross-links,
   duplicate explanations, hidden prerequisites, and redundancy introduced
   by fixes. Report what was actually checked and what remains uncertain.

## Execution size

Work sequentially by default for one section or a local edit. Use parallel
agents only when available and authorized, for independently owned sections
with settled conventions. Estimate from a pilot rather than promising fixed
runtime or token costs. Cap the scope and concurrency, share a finite concept
list, and run shared generation/build checks once after writers stop.

[workflow-template.js](references/workflow-template.js) is an optional adapter
for a runtime exposing `agent`, `parallel`, `phase`, and `log`. It is not a
Node CLI. Read it only when using that runtime. It writes sections in bounded
batches, then runs an independent read-only review per section by default
(`review: false` opts out, and the opt-out is recorded in the result), then one
capped wave of planned plus proposed prerequisite pop-ups, then a single
integrator that fixes confirmed findings and runs the serial checks. Without
it, use the authoring steps above; do not imitate a large worker pool
sequentially.

## Maintaining the template

The library is a copied starter, not a published package. Last recorded broad
sync from fmm-skript: 2026-08-27; individual later changes may diverge. Compare
actual implementations before porting fixes. Preserve language defaults and
consumer APIs, identify affected callers, and test changed behavior. Historical
review does not guarantee correctness of a modified library.
