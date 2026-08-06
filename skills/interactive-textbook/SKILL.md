---
name: interactive-textbook
description: >
  Turn a textbook chapter, lecture notes, or paper (PDF) into an interactive
  web textbook: React app with Paradox-grand-strategy-style nested tooltips
  for prerequisite concepts, expandable "Deep dive" blocks with interactive
  widgets, MathJax equations with the source's numbering, built by a
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
2. `npm install`, then `npm run build` — must be green before agents start.
3. **Map PDF pages to sections**: pdftotext is fine for *headings* (never for
   math). Loop pages, grep for section-heading patterns, note each section's
   page range with ±1 page overlap at boundaries:
   `for p in $(seq A B); do pdftotext -f $p -l $p file.pdf - | grep -E '^[0-9]+\.[0-9]+ [A-Z]'; done`
4. **Create all section stubs**: one `S*.mdx` per section, each beginning
   with `export const id = "4.1";` and
   `export const title = "Determinant and Trace";`, followed by a placeholder
   sentence. `src/sections/index.ts` discovers `S*.mdx` and wraps every body
   in `mdxSection(...)`, so agents only overwrite their own stub and never
   touch a shared index. Concepts also auto-register: the id comes from the
   `.mdx` filename and the tooltip title from `export const title`.

   The section/concept split matters: the plugin emits a bare fragment and
   the *adapter* supplies typography, because the same MDX renders once on a
   light page body and once inside an always-dark tooltip window. Never put
   page layout classes in the plugin.
5. Instantiate `references/conventions-template.md` → `<app-root>/CONVENTIONS.md`.
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
(TypeScript + MDX typecheck + build + concept closure + REPORT.md).

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

If the source has NO numbered equations (some books number nothing outside
displayed theorems), say so explicitly in CONVENTIONS.md and the section
prompts ("use MD, never invent tags") — otherwise agents may fabricate
plausible-looking equation numbers.

Why writers read the PDF with the Read tool (pages parameter), not pdftotext:
text extraction mangles math; the rendered page images are the only reliable
equation source. Reviewers re-read the same pages and check ≥8 equations
symbol-by-symbol, completeness of numbered items, and no-verbatim (frame
sentences especially — equation lead-ins get copied 1:1 unnoticed).

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
cosmetic traps, and run the verbatim spot-check. Send the user the chain and
deep-dive screenshots with the final report.

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
| `::::quiz` / `:::question{true}` or `{false}` | `::::quiz` / `:::frage{wahr}` or `{falsch}` | `<Quiz>` / `<Frage>` |
| `:::deepdive[Title]` | `:::vertiefung[Title]` | `<ExpandedReading>` |
| `::source[…]` | `::quelle[…]` | small source line |
| `:c[text]{#id}` | `:k[text]{#id}` | `<ConceptLink>` |
| `::::proof{no-qed}` | `::::beweis{ohne-qed}` | `<Proof qed={false}>` |

Math is `$…$`, `$$…$$`, or numbered `$$ {#eq-2.3}`. A heading such as
`### 2.2.1 Title` receives `id="sec-2.2.1"`; an unnumbered heading receives
none. English is the default, so lead with the English directives in new
material. Projects may add TeX macros in `src/mathjax-setup.ts`; until then,
use plain TeX such as `\mathbf{A}^\top\mathbf{A}`.

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

Run `npm run typecheck:mdx && npm run test:mdx` after authoring MDX. Plain
`tsc --noEmit` cannot see generated JSX inside `.mdx`. After touching
anything in `mdx/`, the 72 fixtures pin
both the accepted forms and every rejection rule across MDX/remark upgrades.

## Component library contract (what agents build against)

- `<ConceptLink id>` — hover opens an interactive preview window; clicking
  the link (or 📌 in the preview) pins it: pinned windows are draggable by
  their title bar, have a × button, and survive page scrolling. Nesting,
  circular-ref greying, Esc, grace timers and click-away dismissal are all
  engine-handled. `<TooltipProvider labels={{pin, close, pinned}}>` localizes
  the three UI strings (English defaults).
- `<ExpandedReading title>` — "Deep dive" accordion (prefix added by the
  component — a `title` starting with "Deep dive:" doubles the label).
- `$…$`, `$$…$$`, numbered `$$ {#eq-…}`, and environment directives lower
  to `<M>/<MD>/<Eq>/<EnvBlock>`. MDX math uses normal single TeX backslashes.
  Only a companion TSX widget that directly passes a JavaScript string to a
  math component needs doubled backslashes. Use `\boldsymbol`, not
  `\mathbf`, for bold Greek.
- Widgets: `Slider`, `MatrixInput`, `TransformCanvas` (2D linear map on
  grid + unit circle), `Plot`, and their labeled-axes wrappers `LabeledPlot`
  / `LabeledTransformCanvas` (prefer these) with auto-scaling helpers
  `sigmaMax` / `maxAbsCoord`. Import a companion widget into MDX as JSX and
  compose these primitives there before writing a custom canvas.
- Quality bar (in the CONVENTIONS template; reviewers enforce it): labeled
  axes, nothing drawn outside the canvas, the visualized object's numeric
  state printed beside its controls, and color-coded math where each color
  tracks the same subexpression through every line of a derivation.

## Scaling notes

- Pilot benchmarks (6 sections, 37 concepts, 23 deep dives): 19 agents,
  ~1.8M tokens, ~45 min, zero failed agents.
- For a quick demo, run ONE short section: same workflow, `sections` array of
  length 1 — everything else scales down automatically.
- Subsequent chapters can reuse the same app (append sections) or get sibling
  apps; concept modules are reusable across chapters — copy `src/concepts/`
  forward and the closure loop only fills the gaps.
