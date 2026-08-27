---
name: interactive-textbook
description: >
  Turn a textbook chapter, lecture notes, or paper (PDF) into an interactive
  web textbook: React app with Paradox-grand-strategy-style nested tooltips
  for prerequisite concepts, open "Interactive" widget boxes, expandable "Deep dive" blocks for optional
  material, MathJax equations with the source's numbering, built by a
  multi-agent Workflow (section writers → adversarial reviewers →
  tooltip-concept worker pool → integration). Use this whenever the user asks
  for an interactive textbook, explorable explanation, "MML-style" chapter
  adaptation, nested/hover tooltips over course material, an interactive
  version of a book chapter or slide deck, or a web companion that explains
  prerequisite concepts on hover — even if they only say "make chapter X
  interactive" or paste an interactive-textbook spec they found online.
---

# Interactive Textbook

Convert a (usually copyrighted) source chapter into a self-contained React +
TS + Vite + tailwind v4 + MathJax app. The heavy lifting is already done —
a council-reviewed component library ships in `assets/app-template/` and a
battle-tested orchestration script in `references/workflow-template.js`.
Your job is configuration, supervision, and verification, not rebuilding.

One full chapter (~35 PDF pages, 6 sections) costs roughly 1.5–2M subagent
tokens and ~45 min. Tell the user before launching.

## Phase 0 — Clarify with the user (AskUserQuestion)

Settle before any work: (1) source PDF path + which sections/chapter,
(2) target audience and the concept **exclusion list** (what gets NO tooltip
— this controls tooltip explosion), (3) language of body/tooltips,
(4) output directory, (5) whether the result is meant to be published — this
only ever becomes possible under Branch B below, so establish the licence
(Phase 0.5) before promising anything. If the user supplied a spec (they
often paste one), follow its structure but apply the copyright policy below
regardless.

## Phase 0.5 — Establish the source's licence (before any policy decision)

Do not assume. Find the actual licence statement: the PDF's copyright page
(usually p. ii or the last page), the publisher's book page, or the project
site. A freely downloadable PDF is *not* evidence of an open licence, and
this is the common case: MML (Deisenroth et al.) is © Cambridge University
Press and Heath, *Scientific Computing* is © SIAM, both free to read and both
fully copyrighted. Record what you found, and where, in CONVENTIONS.md.
If you cannot establish an open licence, the source is copyrighted. Ask the
user only if the licence page is genuinely ambiguous.

## Copyright policy (non-negotiable)

Which branch applies is decided by the licence you established above.

**Branch A — copyrighted source (the default).** "Mostly verbatim"
reproduction is not something you can do, no matter how the app is hosted.
Offer instead, and clearly say you are doing so, a **faithful close
paraphrase**: identical structure, notation, equation/theorem/example
numbering, and level of detail, but independently written prose.
Mathematical content (equations, the math of definitions/theorems, example
numbers) is reproduced exactly; sentences never are. Figures are recreated as
widgets/SVG ("after <source> Figure X.Y"), never scanned. The app stays
private/internal; never publish it.

**Branch B — open-licence source.** Creative Commons (BY, BY-SA, BY-NC,
BY-NC-SA), a free-documentation licence, or public domain: adaptation and
publication are allowed, and the paraphrase rule relaxes to a normal
attribution obligation. Then:
- Put the full attribution on the app itself, not only in a README: title,
  author(s), link to the original, link to the licence deed, and an explicit
  "changes were made / adapted" note (the app is a derivative work).
- Give the output a **compatible** licence and state it in the footer. `SA`
  propagates: a BY-SA source forces a BY-SA adaptation. `NC` forbids
  commercial use of the result. Mixing sources under incompatible licences
  (e.g. BY-SA with BY-NC-SA) is not allowed in one derivative work.
- **`ND` is a hard stop**: BY-ND / BY-NC-ND permit no *distributed*
  derivative at all. An interactive adaptation is a derivative work, so if
  the user wants it published, say the licence forbids it. Keeping it
  strictly private is still fine.
- Public domain / CC0: no obligations, but still cite the source.
- Verbatim reuse is *permitted* here, yet usually still not what you want:
  the point of the exercise is text restructured for hovering and expanding.
  Paraphrase by default, quote where the original wording is the point.

Mathematics itself is not copyrightable in either branch: theorems,
equations, algorithms, and numerical values are always reproduced exactly.
Both branches are embedded in the CONVENTIONS template (pick one when
instantiating) so every agent inherits the one that applies.

## Phase 1 — Scaffold (do this yourself, ~10 min)

1. Copy `assets/app-template/` to the target directory. Replace the
   `{{...}}` placeholders in `index.html` (title) and `src/App.tsx`
   (kicker/title/attribution — cite the source fully; under Branch A add the
   independent-rewriting note and "internal use only", under Branch B the
   licence link, the "adapted, changes were made" note and the output
   licence). The template builds to ONE self-contained
   `dist/index.html` (~2.5 MB): MathJax is bundled (tex-svg-full, no CDN) and
   `vite-plugin-singlefile` inlines everything, so the file works offline via
   double-click and can be shared as-is (privately — copyright). Don't
   reintroduce CDN MathJax; keep the `mjx-container > svg { display: inline }`
   rule (Tailwind preflight otherwise block-displays inline math).
2. `npm install`, then `npm run build`, `npm run verify:numbers` and
   `npm run test:lib`: all green on the pristine template before agents
   start (the workflow prompts rely on those scripts existing).
3. **Map PDF pages to sections**: pdftotext is fine for *headings* (never for
   math). Loop pages, grep for section-heading patterns, note each section's
   page range with ±1 page overlap at boundaries:
   `for p in $(seq A B); do pdftotext -f $p -l $p file.pdf - | grep -E '^[0-9]+\.[0-9]+ [A-Z]'; done`
4. **Create all section stubs**: one `S*.mdx` per section, each beginning
   with `export const id = "4.1";` and
   `export const title = "Determinant and Trace";`, followed by a placeholder
   sentence. `id` is the SOURCE's section number: it is the anchor `#sec-4.1`,
   the target of `@sec:4.1`, and the prefix the counter uses for everything
   numbered inside that file. Run `npm run gen:numbers` once the stubs exist. `src/sections/index.ts` discovers `S*.mdx` and wraps every body
   in `mdxSection(...)`, so agents only overwrite their own stub and never
   touch a shared index. Concepts also auto-register: the id comes from the
   `.mdx` filename and the tooltip title from `export const title`.

   The section/concept split matters: the plugin emits a bare fragment and
   the *adapter* supplies typography, because the same MDX renders once on a
   light page body and once inside an always-dark tooltip window. Never put
   page layout classes in the plugin.
5. Instantiate `references/conventions-template.md` → `<app-root>/CONVENTIONS.md`
   (all `{{…}}` placeholders, including `{{ERRATA_FILE}}`, the file where
   agents log errors they find in the *source*, e.g. `ERRATA.md`).
   Spend real thought on the **canonical concept-id list**: brainstorm the
   ~30 prerequisite concepts this domain will need and fix their kebab-case
   ids, so six independent agents converge on `orthogonal-matrix` instead of
   inventing three spellings. Rebuild once more to confirm green.

## Phase 2 — Launch the Workflow

Use `references/workflow-template.js` (pass via `script`, or copy and edit).
It implements: pipeline over sections (writer agent → adversarial reviewer
queued per section, no barrier), then a barrier to union prerequisite
concepts, then the tooltip worker pool (4 workers × ≤8 concepts, iterating
new discoveries to closure, wave cap 4), then one integration agent
(TypeScript + MDX typecheck + build + verify:numbers + structural greps +
concept closure + REPORT.md).

`args` must provide: `root` (absolute app path), `pdf` (absolute PDF path),
`sourceShort` (e.g. "MML"), and `sections`:
`[{id, comp, title, pages, extra?}, ...]` — `pages` is the Read-tool page
range; use `extra` to fold in chapter intro text before the first section.

Known trap (already handled in the template, don't remove it): the Workflow
runtime may deliver `args` JSON-stringified — the script starts with
`const A = typeof args === 'string' ? JSON.parse(args) : args`.

**No Workflow tool available** (e.g. running as a subagent)? Execute the same
stages sequentially yourself with the template's prompts verbatim: per
section, writer then adversarial reviewer; barrier; concept-union; tooltip
workers (parallel Agent calls if you can spawn agents, otherwise batched
yourself); integration pass last. Both test runs of this skill did exactly
this successfully — the prompts port over unchanged.

**Numbering: never let an agent type a number.** The app ships a counter
(`scripts/gen-numbers.mjs`), so the rule in every prompt is: label the target,
reference the label. How a source's own numbering is preserved:

- The source numbers it → the number IS the label's id: `$$ {#eq-5.107}`,
  `:::theorem[4.6 (KKT)]`, `### 4.6.1 Title`, `export const id = "4.6"`.
  Nothing is re-derived, so MML's "(5.107)" stays "(5.107)", and the prose
  says `@eq:5.107` rather than typing "(5.107)". (The alternative — a slug
  plus a display override — was rejected: it adds syntax and a second place
  for the number to be wrong, for no gain when the number is already stable.)
- The source does not number it, but the adaptation needs to point at it →
  give it a slug and let the counter number it: `$$ {#eq-two-step}`,
  `:::example[#scaling-twice]`, `### Title :id[why-counted]`. These come out
  as `<section-id>.<n>`, skipping numbers the source already claimed.
- Nothing points at it → no label at all; a bare `$$…$$` prints no number.

If the source has NO numbered equations (some books number nothing outside
displayed theorems), say so explicitly in CONVENTIONS.md and the section
prompts ("bare `$$…$$` unless a later reference needs a slug") — otherwise
agents fabricate plausible-looking equation numbers. `npm run lint:numbers`
runs in `npm run build` and fails on any number typed into prose or TSX.

Why writers read the PDF with the Read tool (pages parameter), not pdftotext:
text extraction mangles math; the rendered page images are the only reliable
equation source. Reviewers re-read the same pages and check ≥8 equations
symbol-by-symbol, completeness of numbered items, and no-verbatim (frame
sentences especially — equation lead-ins get copied 1:1 unnoticed).

Two toolchain traps for parallel agents (14 chapter agents hit both in one
day). `npm run typecheck:mdx` is not parallel-safe: it writes a temp
`.<file>.<pid>.mdx-check.tsx` next to each MDX file inside `src/`, which
`tsconfig.mdx.json` globs, so concurrent runs see each other's temp files
appear and vanish (sporadic `ENOENT`). Agents skip it; you run it once after
all agents finish, then remove leftovers with
`find src -name '.*.mdx-check.tsx' -delete` (the pattern matches nothing
else). And environment labels may not contain math or backticks
(`:::remark[13.2 ($x$)]`); the typecheck then fails *without a file name*,
so `git diff` for new labels.

While it runs: if the user's setup has a council/review skill and the
component library was modified this session, review those modifications in
parallel. The bundled library itself is already council-reviewed (3
independent reviewers; scroll/resize dismissal, ResizeObserver re-measure,
silhouette safe-corridors, depth-cap re-anchoring, keyboard/touch support all
fixed) — don't re-review it, and don't let agents "improve" `src/lib/`.

## Phase 3 — Verify (never skip)

Follow `references/verification.md`: serve the build, run the Playwright
check (MathJax error count, tooltip chain to depth 3, Esc/scroll teardown,
console errors), READ the screenshots and look at them, grep the known
cosmetic traps, and run the exhaustive sliding-window verbatim scan. Send the user the chain and
deep-dive screenshots with the final report.

## Phase 4 — Post-build passes (a chapter is not done after Phase 3)

Agent-written textbooks fail in ways a per-section reviewer cannot see,
because each defect is only visible across sections. Run these as
read-only review passes with file:line findings, then commission the fixes:

- **Length and optionality.** Classify every block against the source as
  CORE (in the source/lecture), BRIDGE (needed to read the core) or EXTRA
  (beyond it), with word counts, and compare the total against what the
  course can carry (one project reached ~540 print pages for a
  one-lecture-a-week course; a sixth of it was EXTRA or duplicated).
  Material the *source* marked optional (appendix slides) tends to come
  back as numbered main-text theorems with proofs: keep the source's own
  optional/core distinction, because agents promote everything.
  Recurring bloat: summaries written three times (table, "Fazit", "what we
  take away"), self-tests repeating earlier questions verbatim, widget
  narrations retelling every state (2–4 sentences suffice, but never zero:
  the print export replaces widgets with placeholders and that prose is
  the only carrier).
- **Cross-section duplicates.** The same theorem proved twice, the same
  derivation in two chapters, the same example computed twice with
  different numbers. Grep labels and theorem names across all sections.
- **Concept dedup.** Near-synonym concept ids appear despite the canonical
  list (`inverse-matrix`/`matrix-inverse`, `inner-product`/`dot-product`).
  Confirm the two really mean the same thing, then keep the id with more
  *incoming links* and migrate the rest to it, rather than keeping the
  nicer module (the winner had 25 inbound links, the loser 3). Also list
  concepts with zero inbound
  links: an orphan is unreviewed by construction, delete or link it.
- **Collapsed-content dependencies.** After any restructuring pass, grep
  every `@`-reference and every quiz in *visible* text for targets inside
  `:::deepdive` blocks (a shortening round produced a dozen). Self-tests on
  optional material live inside the deep dive.
- **Fix rounds inflate; cut afterwards.** A fix swarm adds each caveat to
  prose, task line, verdict and closing at once (+19 % words in one round).
  Take word-count baselines (`git show HEAD:<file> | wc -w`) and run a
  shortening pass with them; it also catches the regressions the fixes
  introduced. Second review rounds get the triage table of round one and
  are told not to re-report rejected or accepted-as-design items.
- **Two-pass acceptance for widgets.** Source audit *and* rendered
  screenshots at ~390 px and ~1300 px; each pass misses what the other
  catches (details in the `explorable-widgets` skill). A "no defects" claim
  needs the denominator counted from the source tree.

## Authoring format: MDX, not hand-written TSX

Sections are `.mdx`. The maths in your source then looks exactly like the
maths in the PDF or slides you are transcribing —
`$\|\mathbf{A}\|_2$` — instead of a TeX string inside a React component.
That matters more than it sounds: the TSX form
made every backslash a decision (double it or not?), and a corpus this size
carries roughly 12000 of them. In MDX the escaping is done by the compiler,
so an entire error class disappears rather than becoming rarer. Sections
also come out about 40% shorter, which is what makes a human willing to edit
the prose afterwards — the original point of the exercise.

`mdx/remark-fmm.mjs` lowers the authoring syntax onto the same components:

| English authoring form | German alias | result |
|---|---|---|
| `:::definition[…]`, `:::theorem[…]`, `:::lemma[…]`, `:::corollary[…]`, `:::example[…]`, `:::remark[…]`, `:::algorithm[…]` | `:::satz[…]`, `:::korollar[…]`, `:::beispiel[…]`, `:::bemerkung[…]`, `:::algorithmus[…]` | `<EnvBlock kind label>`; `kind` is the printed label |
| `::::proof` / `:::step` / `::why[…]` | `::::beweis` / `:::schritt` / `::why[…]` | `<Proof>` / `<PStep why>` |
| `::::quiz` / `:::question{true}` or `{false}` | `::::quiz` / `:::frage{wahr}` or `{falsch}` | `<Quiz>` / `<Frage>` (alias `<Question>`) |
| `:::interactive[Title]` | `:::interaktiv[Title]` | `<Interaktiv>` (alias `<Interactive>`) — the box around a widget, its task and its readout; core material, always open |
| `:::deepdive[Title]` | `:::vertiefung[Title]` | `<ExpandedReading>` — optional extra material (proofs the lecture only cites, excursions); collapsed; may contain a nested `::::interactive` |
| `::source[…]` | `::quelle[…]` | small source line |
| `:c[text]{#id}` | `:k[text]{#id}` | `<ConceptLink>` |
| `::::proof{no-qed}` | `::::beweis{ohne-qed}` | `<Proof qed={false}>` |
| `@theorem:4.6`, `@definition:…`, `@eq:5.107`, `@sec:4.3`, `@num:…`, `@ref:…` | `@satz:…`, `@korollar:…`, … | a checked link reading "Theorem 4.6", "(5.107)", "Section 4.3" |

Math is `$…$`, `$$…$$`, or labelled `$$ {#eq-5.107}` (the source's number) /
`$$ {#eq-two-step}` (a slug the counter numbers). A heading such as
`### 2.2.1 Title` receives `id="sec-2.2.1"`; `### Title :id[slug]` asks the
counter for a number; an unnumbered heading receives none. English is the
default, so lead with the English directives in new material.

Projects may add TeX macros in `src/mathjax-setup.ts` (`texMacros`); until
then, use plain TeX such as `\mathbf{A}^\top\mathbf{A}`.

The compiler is deliberately strict, and every rule exists because the
permissive version compiled green while losing content. Read the full rules
and worked examples in `CONVENTIONS.md` before authoring. The first-attempt
traps are:

- An outer block needs more colons than its inner blocks: `::::proof` around
  `:::step`, and `::::quiz` around `:::question`. Equal lengths close the
  wrong block and leave a visible stray fence.
- Escape braces only in prose. `$\frac{a}{b}$` is correct; the
  `\{` / `\}` spelling prevents prose braces from becoming silent JavaScript
  expressions, but inside math it changes the formula.
- Write prose comparisons as `n < 10` or `$n<10$`; `n<10` is parsed as a
  malformed JSX tag.
- Concepts have no YAML frontmatter. Their title is
  `export const title = "…";`. Comments use `{/* … */}`, because HTML
  `<!-- … -->` comments are invalid MDX.
- Preformatted text belongs in a fenced code block. `<pre>` is a trap: MDX
  re-parses its children as Markdown and drops the indentation, so an ASCII
  diagram comes out flattened with a green build (the compiler rejects the
  multi-line case now). Anything dynamic, stateful, SVG, canvas, or with
  inline formatting inside preformatted text needs a companion `.tsx` widget.

Also: a literal `\$` inside maths is rejected (the Markdown parser ends the
formula there, which used to corrupt maths while the build stayed green),
and a colon directly followed by a word is read as a directive — so avoid
`Statistiker:innen`, unspaced `Hinweis:Text`, and ratios or times like `3:4`
and `12:30` — escape the colon as `\:` or space it out.

Run `npm run test:mdx` after authoring MDX and `npm run typecheck:mdx` once
after all parallel agents are done (it is not parallel-safe, see Phase 2).
Plain `tsc --noEmit` cannot see generated JSX inside `.mdx`. After touching
anything in `mdx/`, the fixture suite (`npm run test:mdx`) pins
both the accepted forms and every rejection rule across MDX/remark upgrades.

## Component library contract (what agents build against)

- `<ConceptLink id>` — hover opens an interactive preview window; clicking
  the link (or 📌 in the preview) pins it: pinned windows are draggable by
  their title bar, have a × button, and survive page scrolling. Nesting,
  circular-ref greying, Esc, grace timers and click-away dismissal are all
  engine-handled. `<TooltipProvider labels={{pin, close, pinned}}>` localizes
  the three UI strings (English defaults).
- `<Interaktiv title>` — open "Interactive" box for a widget + task + readout
  (core material). `<ExpandedReading title>` — collapsed "Deep dive" accordion
  for OPTIONAL material only (prefix added by the component — a `title`
  starting with "Deep dive:" doubles the label). Do not use deep dives as the
  default widget wrapper: that hides the most central content and leaves
  genuinely optional material unmarked (lesson from fmm-skript, 96 of 99 blocks).
- `$…$`, `$$…$$`, labelled `$$ {#eq-…}`, and environment directives lower
  to `<M>/<MD>/<Eq>/<EnvBlock>`; `<Eq id>` / `<EnvBlock id>` carry the jump
  anchor that `@eq:` / `@theorem:` link to. Widgets get their numbers from
  `num()` / `ref()` in `src/sections/numbers.generated`, never as strings. MDX math uses normal single TeX backslashes.
  Only a companion TSX widget that directly passes a JavaScript string to a
  math component needs doubled backslashes. Use `\boldsymbol`, not
  `\mathbf`, for bold Greek.
- Widgets: an SVG-based library (plot, linear-map canvas, labeled-axes
  wrappers, `useDrag`, `Stepper`, predict-then-reveal `GuessFirst`, `Task`
  + `Verdict`, seeded RNG, locale formatters, light/dark surface tokens),
  inventoried in the CONVENTIONS template and documented in
  `src/lib/widgets/README-widgets.md`. Reader-facing components carry a
  German name and, where exported, an English alias (`src/lib/index.ts` is
  authoritative); UI strings default to English. The `explorable-widgets`
  skill governs the didactics.
- Quality bar (in the CONVENTIONS template; reviewers enforce it): labeled
  axes, nothing drawn outside the canvas, the visualized object's numeric
  state printed beside its controls, color-coded math where each color
  tracks the same subexpression through every line of a derivation, verify
  scripts in `scripts/verify/` (run by `npm run verify:numbers`) instead of
  scratchpad claims, and three-state verdicts for degeneracy (exact / near /
  regular; tolerance is not equality).

## Scaling notes

- Pilot benchmarks (6 sections, 37 concepts, 23 deep dives): 19 agents,
  ~1.8M tokens, ~45 min, zero failed agents.
- For a quick demo, run ONE short section: same workflow, `sections` array of
  length 1 — everything else scales down automatically.
- Subsequent chapters can reuse the same app (append sections) or get sibling
  apps; concept modules are reusable across chapters — copy `src/concepts/`
  forward and the closure loop only fills the gaps.

## Lessons carried into the template

- **The library has copies, and copies drift.** The reference `src/lib` is
  the fmm-skript working copy; this template is its English-default twin
  (only default labels, the colour-bootstrap hook and English aliases
  differ), and every app built from the template is a third copy. There is
  no package registry for it, so when `src/lib` changes, propagate the
  change to the template and note the date in this section; eight copies
  were byte-identical once and a full generation apart three weeks later,
  with the skill prescribing patterns the template could not build.
  (Library synced to the fmm-skript lib v2 on 2026-08-27.)
- **The adaptation never editorializes about the source's mistakes.** Agents
  transcribing lecture slides find real errors (dozens in one course). The
  student-facing text must not say "the slides are wrong here" (students
  should not see two competing sources) and must not silently reproduce
  the error either. Write it correctly, record the finding with its source
  location in the errata file (`{{ERRATA_FILE}}` in CONVENTIONS) so the
  author can review the correction and fix the source; neutral provenance
  ("as in the wrap-up slide") is fine.
- **Plan for the print fallback.** The same MDX can be lowered to LaTeX
  (widgets become placeholders); the fmm-skript ships `npm run pdf`. It
  only works if the prose around each widget already carries the insight
  and if directive labels stay plain text. Both are rules above, and the
  PDF is the cheapest audit of whether they were followed.
- **Lazy-loaded chapters need chapter-aware links** (not in the template;
  the fmm-skript implements it). With one chapter per
  lazy route, a bare `#sec-…` into another chapter is a dead link; links
  carry the chapter (`?k=<chapter>#sec-…`) and the app scrolls to the
  fragment after the chunk loads, and opens a collapsed deep dive when the
  target sits inside one.
- **Start with the counter, never retrofit it.** The sibling fmm-skript
  project (13 chapters, 72 section files) was built with numbers typed by
  hand. Adding automatic numbering afterwards meant migrating ~3300 reference
  sites under an oracle diff, plus a staged migration plan, a snapshot gate
  and a lint pass — several days of work that buying `gen-numbers.mjs` on day
  one would have cost nothing. The template now ships it wired up, and
  `npm run build` fails on a hand-written number. Do not remove that step
  "for now"; a chapter's worth of typed numbers is exactly how the debt
  starts.
