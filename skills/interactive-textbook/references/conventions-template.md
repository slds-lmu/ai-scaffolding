# CONVENTIONS-template

Instantiate as `CONVENTIONS.md` in the app root before launching agents.
Replace every `{{...}}`. This is the ONE living file every agent must read
before working; the orchestrator/agents append lessons at the bottom.

---

# CONVENTIONS — interactive {{SOURCE_SHORT}} (READ FULLY BEFORE ANY WORK)

Living lessons file. Check the **Lessons** section at the bottom before
starting — it overrides everything above it.

## Mission

Interactive-textbook adaptation of {{SOURCE_CITATION}}, {{SECTION_RANGE}}
(PDF: `{{PDF_PATH}}`). React + TS + tailwind v4 + MathJax, Paradox-style
nested tooltips, interactive widgets in expandable "Deep dive" blocks.

## Copyright policy (HARD REQUIREMENT)

The source is copyrighted. **Do NOT copy the source's prose.** Write an
independent close paraphrase: same section structure, same order of ideas,
same level of detail, same notation. Mathematical content is reproduced
exactly: equations, definitions' mathematical statements, theorem statements
(re-worded framing text), examples with the same numbers. Keep the source's
numbering (equations, definitions, examples) so students can cross-reference
the original. Footnote/margin-note content is carried over as paraphrase.
Figures are never copied as scans — recreate as widgets/SVG (cite: "after
{{SOURCE_SHORT}} Figure X.Y"). NEVER copy sentences verbatim.
When source and adaptation share a language, write each paragraph **from your
own understanding** (read → close the mental "copy buffer" → explain), never
by editing the source's sentences.
Verbatim risk hides in short FRAME sentences, not just paragraphs: equation
lead-ins and list intros tend to get copied 1:1 — reviewers must diff those
against the PDF too.

## Language

{{LANGUAGE_RULES}}
(default: everything in English — body, tooltips, readings, widget labels,
UI, code; math notation exactly as in the source)

## Target audience & tooltips

{{AUDIENCE_DESCRIPTION}}
Exclusion list (concepts that get NO tooltip because the audience knows them):
{{EXCLUSION_LIST}}

## Library API (import from `../lib`)

- `<ConceptLink id="kebab-id">visible text</ConceptLink>` — inline concept
  link (nested-tooltip trigger). Works in body text, Deep dives AND inside
  tooltip bodies (nesting is automatic; circular refs handled by the engine).
- `registerConcept({ id, title, body })` — one call per concept module.
- `<ExpandedReading title="…">…</ExpandedReading>` — accordion after key
  paragraphs/figures; put widgets here so the happy path stays clean.
  The component prepends "Deep dive:" itself — do NOT include it in `title`.
- `<M>{"\\lambda"}</M>` inline math, `<MD>{"…"}</MD>` display math,
  `<Eq tag="4.12">{"…"}</Eq>` numbered equation,
  `<EnvBlock kind="Definition|Theorem|Example|Remark" label="4.6">…</EnvBlock>`
  (label is required — pass `label=""` for unnumbered Remarks).
- Widgets: `<Slider>`, `<MatrixInput>`, `<TransformCanvas matrix={[[a,b],[c,d]]}
  vectors={[{v:[1,0], color, label}]}>` (grid/unit-circle image under x↦Ax),
  `<Plot series={[{f}]}>`. **Prefer `<LabeledPlot>` / `<LabeledTransformCanvas>`**
  — same props plus named, tick-labeled axes in a reserved margin (use
  `tickClass` on dark tooltip backgrounds). Auto-scale world windows with the
  helpers `sigmaMax(A)` (largest singular value; ellipse images fit at
  `1.2*sigmaMax`) and `maxAbsCoord(...vectors)`. Compose these; write custom
  canvas/SVG widgets only when primitives don't fit (put them in
  `src/sections/widgets/` or `src/concepts/widgets/`).

## Widget & colored-math quality bar (user-tested — real complaints)

A widget that hides information is worse than a static figure. Every widget:

- **Axes labeled and never cut off** — leave margin for labels/ticks; if a
  plot has meaningful axes, name them.
- **Content stays inside the canvas**: vectors/curves must not poke outside
  the plotted area. Either clamp the parameter ranges to what fits, or
  auto-scale the view (e.g. grow `worldHalf` with the largest vector norm).
- **Print the state being visualized.** A slider that morphs a matrix must
  SHOW the current matrix numerically (via `<M>` next to the canvas);
  same for any derived quantities (det, eigenvalues, condition number …).
  The user should never have to guess what object the picture depicts.
- **Color-coding in math must be consistent and complete**: a color denotes
  the SAME subexpression in every line of a derivation (the orange factor in
  line n is the orange term of line n+1 after simplification), and once a
  statement/result uses color-coding, the intermediate steps carry it too —
  otherwise drop the coloring entirely. Half-applied coloring is worse than
  none.

## Gotchas (verified in a previous full build)

- **LaTeX in TSX strings: escape backslashes** — `<M>{"\\mathbf{A}"}</M>`,
  never single `\`. Math ONLY via `M`/`MD`/`Eq`, never in plain JSX text.
- Bold Greek: `\\mathbf{\\Sigma}` renders wrongly in MathJax — use
  `\\boldsymbol{\\Sigma}`.
- Multi-line numbered equations: one `<Eq>` with
  `\\begin{aligned}...\\end{aligned}` (double-escaped) works; so do
  vmatrix/bmatrix/operatorname/overset/phantom.
- **No shared index files.** Concept modules in `src/concepts/*.tsx` are
  auto-loaded via `import.meta.glob` — creating the file IS the registration.
  Sections are pre-registered in `src/sections/index.ts` (do NOT touch it);
  overwrite only your own stub `S*.tsx`.
- The Write tool refuses to overwrite your section stub until you have opened
  it with the Read tool in-session (a `cat` via Bash does not count) — Read
  the stub first, saves a failed call.
- After writing your files run `npx tsc --noEmit` from the app root and fix
  every error you introduced.
- Read the source PDF pages with the Read tool (`pages` parameter) — do NOT
  pdftotext math (it mangles it); transcribe equations from the rendered
  page images.
- Concept ids: kebab-case ({{ID_LANGUAGE}}). File name = id:
  `src/concepts/<id>.tsx`. **Before inventing an id, `ls src/concepts/` and
  use the canonical list below** — sibling agents must converge on identical
  ids for shared concepts.
- Concepts the converted chapter itself introduces get NO tooltip —
  cross-reference the section instead:
  `<a className="underline" href="#sec-4.2">…</a>`.
- **Git: NEVER run git stash / checkout / reset / commit. No git commands at
  all.** Undo your own mistakes by editing files.
- Template/reference implementation: `src/concepts/_demo.tsx`.

## Canonical concept ids (use exactly these when the concept comes up)

{{CANONICAL_CONCEPT_IDS}}

## Section files

`src/sections/S*.tsx` files, each exporting one section component — already
registered in `src/sections/index.ts` (do NOT edit the index). Keep
components small: one exported section component per file, internal
sub-components fine. Subsection headings as `<h3>` with the source's
numbering.

## Reports (section agents)

Return JSON matching the workflow's SECTION_SCHEMA: `{ sectionId,
prereqConcepts: [{id, name, context}], notes }` — `prereqConcepts` = every
concept you wrapped in a ConceptLink that has no module in `src/concepts/`
yet. Lessons for later agents go into the Lessons section below (append), not
into the report.

## Lessons (append one-liners here; newest last)

- (none yet)
