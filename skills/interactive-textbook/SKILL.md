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
(4) output directory. If the user supplied a spec (they often paste one),
follow its structure but apply the copyright policy below regardless.

## Copyright policy (non-negotiable)

Textbooks are copyrighted; "mostly verbatim" reproduction is not something
you can do, no matter how the app is hosted. Offer instead — and clearly say
you're doing so — a **faithful close paraphrase**: identical structure,
notation, equation/theorem/example numbering, and level of detail, but
independently written prose. Mathematical content (equations, the math of
definitions/theorems, example numbers) is reproduced exactly; sentences never
are. Figures are recreated as widgets/SVG ("after <source> Figure X.Y"),
never scanned. The app stays private/internal; never publish it. These rules
are embedded in the CONVENTIONS template so every agent inherits them.

## Phase 1 — Scaffold (do this yourself, ~10 min)

1. Copy `assets/app-template/` to the target directory. Replace the
   `{{...}}` placeholders in `index.html` (title) and `src/App.tsx`
   (kicker/title/attribution — cite the source fully, note the independent
   rewriting, "internal use only"). The template builds to ONE self-contained
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
4. **Pre-register all sections**: create one 3-line stub component per
   section (`S41.tsx` …) and fill `src/sections/index.ts` with all entries.
   Agents then only overwrite their own stub — concurrent agents must never
   edit a shared index (concepts auto-register via `import.meta.glob`, so
   creating a concept file is registration enough).
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
(tsc + build + concept-closure + REPORT.md).

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

## Component library contract (what agents build against)

- `<ConceptLink id>` — hover 300 ms spawns tooltip; auto-locks (📌) making
  inner links hoverable; nesting, circular-ref greying, Esc-chain-close,
  scroll/click-away dismissal are all engine-handled.
- `<ExpandedReading title>` — "Deep dive" accordion (prefix added by the
  component — a `title` starting with "Deep dive:" doubles the label).
- `<M>/<MD>/<Eq tag>/<EnvBlock kind label>` — MathJax wrappers; LaTeX in TSX
  strings needs `\\` escaping; `\\boldsymbol` not `\\mathbf` for bold Greek.
- Widgets: `Slider`, `MatrixInput`, `TransformCanvas` (2D linear map on
  grid + unit circle), `Plot`, and their labeled-axes wrappers `LabeledPlot`
  / `LabeledTransformCanvas` (prefer these) with auto-scaling helpers
  `sigmaMax` / `maxAbsCoord` — compose these before writing custom canvases.
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
