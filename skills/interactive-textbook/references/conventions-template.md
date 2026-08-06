# CONVENTIONS-template

Instantiate as `CONVENTIONS.md` in the app root before launching agents.
Replace every `{{...}}`. This is the ONE living file every agent must read
before working; the orchestrator/agents append lessons at the bottom.

---

# CONVENTIONS — interactive {{SOURCE_SHORT}} (READ FULLY BEFORE ANY WORK)

Living lessons file. Check the **Lessons** section at the bottom before
starting. Lessons may refine project-specific choices, but they cannot
override the MDX grammar or verification commands documented here.

## Mission

Interactive-textbook adaptation of {{SOURCE_CITATION}}, {{SECTION_RANGE}}
(PDF: `{{PDF_PATH}}`). React + TS + tailwind v4 + MathJax, Paradox-style
nested tooltips, interactive widgets in expandable "Deep dive" blocks.

## Copyright policy (HARD REQUIREMENT)

> When instantiating: keep exactly ONE of the two branches below, delete the
> other, and record the licence you established plus where you found it
> ("© SIAM, copyright page p. ii" / "CC BY-SA 4.0, stated at <url>"). A free
> download is not a licence. If no open licence is documented here, Branch A
> applies.

### Branch A — copyrighted source

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
The app is internal only. It is never published, and no build artifact is
shared outside the group.

### Branch B — open-licence source ({{LICENCE}})

The source is licensed {{LICENCE}} ({{LICENCE_URL}}), so this adaptation may
be published. Obligations every agent must respect:

- **Attribution stays intact.** The app footer names {{SOURCE_CITATION}},
  links the original and the licence, and states that the text was adapted.
  Never remove or weaken it, and never present the material as original.
- **Output licence: {{OUTPUT_LICENCE}}.** Do not introduce material from a
  differently licensed source into this app.
- Keep the source's numbering (equations, definitions, examples) so students
  can cross-reference the original.
- Verbatim reuse is permitted, but the point of this format is text
  restructured for hovering and expanding. Paraphrase by default; quote only
  where the exact original wording is what matters, and mark it as a quote.
- Figures: recreate as widgets/SVG. A licensed figure may be reproduced with
  attribution, but a recreated one is interactive and matches the app's look.
- Mathematics (equations, theorem statements, algorithms, numbers) is
  reproduced exactly, as in every branch.

## Language

{{LANGUAGE_RULES}}
(default: everything in English — body, tooltips, readings, widget labels,
UI, code; math notation exactly as in the source)

## Prose style (enforced by reviewers, measured before sign-off)

Explanatory, plain, unmannered. The specific tics below were reported by real
readers of earlier builds, so they are checked mechanically, not by taste:

- **Dash budget: at most one dash per ~300 words**, and never two in one
  sentence. The em dash is the single loudest LLM tell, and unconstrained
  agents land near one per 70 words (once per paragraph). Reach first for a
  comma, a colon, a full stop, a parenthesis, or a subordinate clause, and
  vary which. Only keep the dash where the interruption is the point.
  In languages that use spaced en dashes (German, French), write ` – `, not
  `—`. Verify per file: `grep -o '—' file | wc -l` against its word count.
- **No formula phrases on repeat.** "Exactly this …", "That is precisely
  why …", "It's not just X, it's Y", three-item lists written by reflex,
  paragraphs opening with "Importantly:" or "The key point is:". Twice in a
  chapter is voice; seven times is a tic. Count before you cut.
- **No throat-clearing.** Say the thing; the sentence "Let's dive in" costs
  a line and adds nothing.
- Sentence length varies. Uniform 18-word sentences read like generated text
  even when every one of them is correct.

Reviewer agents report the dash count per file and the top repeated phrases
with their frequencies, alongside the math checks.

## Target audience & tooltips

{{AUDIENCE_DESCRIPTION}}
Exclusion list (concepts that get NO tooltip because the audience knows them):
{{EXCLUSION_LIST}}

## Authoring syntax (MDX)

Sections and concept bodies are `.mdx`. Write maths the way the source
writes it — single backslashes — and let the compiler do the escaping:

| English authoring form | German alias | result |
|---|---|---|
| `:::definition[…]`, `:::theorem[…]`, `:::lemma[…]`, `:::corollary[…]`, `:::example[…]`, `:::remark[…]`, `:::algorithm[…]` | `:::satz[…]`, `:::korollar[…]`, `:::beispiel[…]`, `:::bemerkung[…]`, `:::algorithmus[…]` | `<EnvBlock kind label>`; `kind` is also the printed English or German label |
| `::::proof` / `:::step` / `::why[…]` | `::::beweis` / `:::schritt` / `::why[…]` | `<Proof>` / `<PStep why>` |
| `::::quiz` / `:::question{true}` or `{false}` | `::::quiz` / `:::frage{wahr}` or `{falsch}` | `<Quiz>` / `<Frage>` |
| `:::deepdive[Title]` | `:::vertiefung[Title]` | `<ExpandedReading>` |
| `::source[…]` | `::quelle[…]` | small grey source line |
| `:c[text]{#id}` | `:k[text]{#id}` | `<ConceptLink>` |
| `::::proof{no-qed}` | `::::beweis{ohne-qed}` | `<Proof qed={false}>` |

English is the default output language, so prefer the English forms in new
files. The aliases are normalized onto the same parser rules; mixing the two
languages does not create a different component.

Math uses `$…$` inline and `$$…$$` for display. Put an equation id immediately
after the opening display fence, for example:

```mdx
The matrix product $\mathbf{A}^\top\mathbf{A}$ is symmetric.

$$ {#eq-4.12}
\mathbf{A}^\top\mathbf{A} = \mathbf{V}\mathbf{D}^2\mathbf{V}^\top
$$
```

A project may register additional TeX macros in `src/mathjax-setup.ts`; do
not use project-specific shorthand until it has been defined there, or
MathJax will report an undefined control sequence at runtime.

Numbered headings such as `### 4.6 Title` receive `id="sec-4.6"`. The id is
derived from the number only. An unnumbered heading receives no id. Link to a
section with ordinary Markdown, for example `[the rank section](#sec-4.6)`.

### Complete directive shapes

A block that contains another block needs a longer fence than its children.
The outer proof and quiz therefore use four colons around three-colon steps
or questions:

```mdx
::::proof

:::step
From $x=0$, the claim follows.

::why[Substitution removes every remaining term.]
:::

::::

::::quiz

:::question{true}
The statement to assess is the first block.

This separate block explains the answer.
:::

::::
```

Equal fence lengths let `remark-directive` close the outer block at the
inner fence. The final fence is then plain visible text, so the compiler
reports a stray-fence error instead of shipping a damaged proof or quiz.

### Rules that prevent silent corruption or parser ambiguity

- Braces are normal TeX inside math: `$\frac{a}{b}$` is correct. The
  `\{` / `\}` rule applies only to prose. Writing `$\frac\{a\}\{b\}$`
  compiles but produces the wrong formula.
- Escape literal braces in prose as `\{` and `\}`. MDX treats unescaped
  prose braces as JavaScript; `the set {1,2,3}` otherwise evaluates the
  comma expression and silently renders only `3`. Free expressions are
  rejected because the syntax tree cannot distinguish this accident from
  intentional JavaScript.
- Put spaces around a prose comparison: `n < 10`, or write it as math,
  `$n<10$`. The text `n<10` makes MDX read `<10` as the start of JSX and is a
  raw parser error.
- There is no YAML frontmatter. A concept gets its tooltip title from a
  module export at the top of its `.mdx` file:
  `export const title = "Singular value";`.
- Use `{/* comment */}` for author comments. HTML comments such as
  `<!-- comment -->` are not MDX comment syntax and fail parsing.
- **Preformatted text goes in a fenced code block, never in `<pre>`.** MDX
  re-parses the children of a `<pre>` element as Markdown, so the indentation
  of an ASCII diagram is silently dropped and the content is wrapped in a
  paragraph — a green build and a flattened figure. The compiler now rejects
  a multi-line `<pre>`, but reach for ``` first anyway. If parts of the
  diagram must be coloured, that is a companion `.tsx` widget; writing
  `<pre>{"…"}</pre>` inline would reopen the silent-expression problem.
- A literal `\$` inside math is rejected because the Markdown math parser
  ends the formula there and used to ship corrupted math. Use `\mathdollar`
  or `\text{\textdollar}` in TeX.
- A colon glued to the next character can start a directive. This bites on
  ratios and times as often as on words: `3:4`, `12:30`, `Statistiker:innen`
  and `Note:Text` all fail the build. Write `Statistiker/innen`, `Note: Text`,
  `$3:4$`, or escape the colon as `\:`.
- Directive flags are bare: `{true}`, not `{true=false}`.

Errors carry a line number. After editing MDX, run
`npm run typecheck:mdx && npm run test:mdx`. Plain `tsc --noEmit` only sees
the `.mdx` import shim and therefore cannot validate the JSX generated from
an MDX file.

### Widgets in MDX

Stateful behavior lives in a companion `.tsx` component. Import that
component into MDX and render it as ordinary JSX:

```mdx
import { ScalingWidget } from "./widgets/ScalingWidget";

:::deepdive[Explore the scaling]

<ScalingWidget />

:::
```

Companion widgets import these building blocks from `../../lib` (adjust the
relative path for their location):

- `Slider`: labeled numeric slider with `label`, `value`, `onChange`, `min`,
  `max`, and optional `step` / `fmt`.
- `MatrixInput`: editable small matrix with `value`, `onChange`, and optional
  numeric `step`.
- `Plot`: canvas function plot with `series`, optional `xDomain`, `yDomain`,
  dimensions, and markers.
- `TransformCanvas`: image of the grid, unit circle, and optional vectors
  under a 2D map, supplied through `matrix`, `vectors`, `worldHalf`, and
  display flags.
- Prefer `LabeledPlot` and `LabeledTransformCanvas` when axes are meaningful.
  They accept the underlying canvas props plus `xLabel`, `yLabel`, and an
  optional `tickClass`, while reserving room so labels are not clipped.
- `sigmaMax(A)` and `maxAbsCoord(...vectors)` help choose a view large enough
  for transformed circles and arrows. Compose these primitives before
  writing a custom canvas or SVG.

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

## Format-independent gotchas from previous full builds

- For bold Greek, use `\boldsymbol{\Sigma}` rather than
  `\mathbf{\Sigma}`. MathJax does not bold Greek with `\mathbf`.
- Multi-line numbered equations belong in one numbered `$$` block with
  `\begin{aligned}...\end{aligned}`. Standard TeX environments such as
  `vmatrix` and `bmatrix`, and commands such as `\operatorname`, `\overset`,
  and `\phantom`, work with single backslashes in MDX.
- Section modules are `src/sections/S*.mdx`. The registry discovers them
  automatically; agents edit only their assigned section and companion
  widgets, not `src/sections/index.ts`.
- Read the source PDF pages with the Read tool (`pages` parameter) — do NOT
  pdftotext math (it mangles it); transcribe equations from the rendered
  page images.
- Concept ids: kebab-case ({{ID_LANGUAGE}}). File name = id:
  `src/concepts/<id>.mdx`. Before inventing an id, list `src/concepts/` and
  use the canonical list below so sibling agents converge on one spelling.
  The MDX typecheck rejects an id duplicated across `.mdx` and legacy `.tsx`.
- Concepts the converted chapter itself introduces get NO tooltip —
  cross-reference the section instead:
  `[the section explanation](#sec-4.2)`.
- **Git: NEVER run git stash / checkout / reset / commit. No git commands at
  all.** Undo your own mistakes by editing files.
- Worked references: `src/sections/_demo.mdx`, its companion widget, and
  `src/concepts/_demo-concept.mdx`.

## Canonical concept ids (use exactly these when the concept comes up)

{{CANONICAL_CONCEPT_IDS}}

## Section files

Each `src/sections/S*.mdx` file exports its section metadata and then contains
the body. The registry discovers the file and wraps its default MDX component
with the page adapter:

```mdx
export const id = "4.1";
export const title = "Determinant and Trace";

Placeholder sentence for the assigned writer to replace.
```

Use numbered Markdown headings such as `### 4.1.1 Geometric meaning` for
subsections. Put stateful or visually complex helpers in
`src/sections/widgets/`, then import them into the MDX file.

## Reports (section agents)

Return JSON matching the workflow's SECTION_SCHEMA: `{ sectionId,
prereqConcepts: [{id, name, context}], notes }` — `prereqConcepts` = every
concept you linked with `:c` / `:k` that has neither a `.mdx` nor legacy
`.tsx` module in `src/concepts/`. Lessons for later agents go into the Lessons
section below (append), not into the report.

## Lessons (append one-liners here; newest last)

- (none yet)
