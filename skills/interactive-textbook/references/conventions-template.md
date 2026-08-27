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
nested tooltips, interactive widgets in open "Interactive" boxes, optional material in expandable "Deep dive" blocks.

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
the original — as a LABEL, never as a number typed into a sentence (see
"Numbers and references" below). Footnote/margin-note content is carried over as paraphrase.
Figures are never copied as scans — recreate as widgets/SVG (cite: "after
{{SOURCE_SHORT}} Figure X.Y"). NEVER copy sentences verbatim.
When source and adaptation share a language, write each paragraph **from your
own understanding** (read → close the mental "copy buffer" → explain), never
by editing the source's sentences.
Verbatim risk hides in short FRAME sentences, not just paragraphs: equation
lead-ins and list intros tend to get copied 1:1 — reviewers must diff those
against the PDF too. Widget captions, status texts and verdicts are prose in
this sense: when porting a widget from another app, take the code and
rewrite every string from your own understanding.
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
  can cross-reference the original — as a LABEL, never as a number typed into
  a sentence (see "Numbers and references" below).
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
| `::::quiz` / `:::question{true}` or `{false}` | `::::quiz` / `:::frage{wahr}` or `{falsch}` | `<Quiz>` / `<Frage>` (alias `<Question>`) |
| `:::interactive[Title]` | `:::interaktiv[Title]` | `<Interaktiv>` (alias `<Interactive>`) — the box around a widget, its task and its readout; core material, always open |
| `:::deepdive[Title]` | `:::vertiefung[Title]` | `<ExpandedReading>` — optional extra material (proofs the lecture only cites, excursions); collapsed; may contain a nested `::::interactive` |
| `::source[…]` | `::quelle[…]` | small grey source line |
| `:c[text]{#id}` | `:k[text]{#id}` | `<ConceptLink>` |
| `::::proof{no-qed}` | `::::beweis{ohne-qed}` | `<Proof qed={false}>` |
| `@theorem:4.6`, `@definition:…`, `@lemma:…`, `@corollary:…`, `@example:…`, `@remark:…`, `@algorithm:…` | `@satz:…`, `@korollar:…`, `@beispiel:…`, `@bemerkung:…`, `@algorithmus:…` | a link reading "Theorem 4.6" |
| `@eq:5.107` | — | a link reading "(5.107)" |
| `@sec:4.3` | — | a link reading "Section 4.3" |
| `@num:4.6` / `@ref:4.6` | — | the bare number / the number with its kind |
| `\@theorem:4.6` | — | the literal text, no link |

English is the default output language, so prefer the English forms in new
files. The aliases are normalized onto the same parser rules; mixing the two
languages does not create a different component.

Math uses `$…$` inline and `$$…$$` for display. Put an equation id immediately
after the opening display fence — the SOURCE's number when the source numbers
the equation, otherwise a slug that the counter numbers:

```mdx
The matrix product $\mathbf{A}^\top\mathbf{A}$ is symmetric, as in @eq:4.12.

$$ {#eq-4.12}
\mathbf{A}^\top\mathbf{A} = \mathbf{V}\mathbf{D}^2\mathbf{V}^\top
$$
```

A project may register additional TeX macros in `src/mathjax-setup.ts`; do
not use project-specific shorthand until it has been defined there, or
MathJax will report an undefined control sequence at runtime.

Numbered headings such as `### 4.6.1 Title` receive `id="sec-4.6.1"`, so a
sub-heading that the source numbers keeps that number. A sub-heading the
adaptation adds gets `### Title :id[slug]` instead and is numbered by the
counter. An unnumbered heading receives no id. Reference a section with
`@sec:4.6`, never with a hand-written Markdown link.

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

Errors carry a line number. After editing MDX, run `npm run test:mdx` (and
`npm run build:agent` before handing over). `npm run typecheck:mdx` is the
orchestrator's single post-parallel check, see below; plain `tsc --noEmit`
only sees the `.mdx` import shim and cannot validate the JSX generated from
an MDX file.

### Widgets in MDX

Stateful behavior lives in a companion `.tsx` component. Import that
component into MDX and render it as ordinary JSX:

```mdx
import { ScalingWidget } from "./widgets/ScalingWidget";

:::interactive[Explore the scaling]

<ScalingWidget />

:::
```

Choose the wrapper by whether the MATERIAL is optional, not by whether it is
interactive:

- `:::interactive[…]` is the default for a widget. It stays open, and the
  prose that sets the task and reads the result off the widget ("at $h=0.3$
  the error stops falling …") belongs inside the box (after the widget),
  not outside it.
- `:::deepdive[…]` is for material a reader may skip: a proof the source only
  cites, an appendix excursion, a side note. It is collapsed. A widget inside
  it needs one more colon (`::::interactive` nested in `:::deepdive`) —
  optional is the material, not the widget.

Using deep dives as the default widget wrapper hides the most central content
and leaves genuinely optional material unmarked. That is what happened in the
sibling fmm-skript, where 96 of 99 deep-dive blocks were just widget frames
and the label carried no signal at all.

Visible text never depends on collapsed text: no `@`-reference from the
main text, from a widget verdict or from a visible quiz into a deep dive; a
self-test about deep-dive material goes inside the deep dive. Keep the
SOURCE's own core/optional distinction: appendix or "uncounted" material
stays optional here too, it does not become a numbered main-text theorem.

Companion widgets import these building blocks from `../../lib` (adjust the
relative path for their location). The library is SVG-based; the code is
shared with a German reference project, so reader-facing components carry
a German name and, where listed below, an English alias (use the
project-language name where an alias exists, otherwise the documented
export; `src/lib/index.ts` is authoritative); UI strings default to English and are overridden via
`labels` props / providers:

- `Slider` (labeled range input), `MatrixInput` / `MatrixDisplay`,
  `Plot` (series, domains, markers), `TransformCanvas` (grid + unit circle
  + vectors under a 2D map, draggable input vector), and the labeled-axes
  wrappers `LabeledPlot` / `LabeledTransformCanvas` (prefer these; they
  reserve room so labels are not clipped) with `sigmaMax(A)` /
  `maxAbsCoord(...vectors)` to size the view.
- `useDrag` + `DragHandle`: pointer capture, clamping during drag, grab
  offset, `touch-action`; pair every handle with a `Slider` on the same
  state (dual path).
- `Aufgabe`/`Task` (the one-line task), `Verdikt`/`Verdict` (state-classed
  verdict: symbol + colour + `aria-live`), `Schaetzfrage`/`GuessFirst` and
  `SchaetzfrageAuswahl`/`GuessFirstChoice` (predict-then-reveal: number,
  choice, range or click-in-figure),
  `Stepper` (scrubbable, optional play, never autostarts),
  `useAnimatedValue` / `useAnimatedMatrix` (transitions for discrete jumps
  only), `Surface3D` + `ViewControls` (companion to a 2D contour plot,
  never the primary view).
- `util`: `fmtDe` / `fmtEn` / `makeFmt(locale)` (locale formatting that
  separates NaN from ∞),
  `clamp`, `mulberry32`, `useSeed`; `surface.ts`: `W_PANEL`, `W_TEXT`,
  `W_BUTTON`, … (class strings that work on the light page, in `dark:`
  and inside the dark pop-up); SVG internals use the `--w-*` CSS variables.

The English aliases rename the component only; prop names stay as in the
reference library (`frage`, `loesung`, `toleranz`, …), see
`src/lib/widgets/README-widgets.md`. Read it and `__examples__.tsx` before
writing a widget; compose these primitives before writing a custom SVG.

## Numbers and references (HARD RULE)

**Never write a number.** Not "Theorem 4.6", not "(5.107)", not "Section 4.3"
— not in prose, not in an environment label you retype, not in a widget's
TSX. Label the target once, then reference the label; the printed number is
filled in from `src/sections/numbers.generated.json` at compile time, and a
reference to something that does not exist fails the build instead of ageing
into a wrong cross-reference.

### Labelling

A label carries either the SOURCE's number or a slug:

| what | the source numbers it | the source does not |
|---|---|---|
| environment | `:::theorem[4.6 (Scaling map)]` | `:::example[#scaling-twice]` |
| equation | `$$ {#eq-5.107}` | `$$ {#eq-two-step}` |
| sub-heading | `### 4.6.1 Title` | `### Title :id[why-counted]` |
| section | `export const id = "4.6";` | — (sections always mirror the source) |
| no number at all | — | `:::remark[(A convention)]` |

A source number is its own id, so nothing re-derives it and
{{SOURCE_SHORT}}'s numbering is preserved exactly. A slug is numbered
`<section-id>.<n>` in document order, skipping numbers a source-numbered
object in the same file already claimed. Slugs are `a-z`, `0-9`, `-`, never
purely numeric, and unique across the whole app.

Label only what is referenced or might be. An unlabelled `$$…$$` prints no
number, which is right for most displayed math.

### Referencing

```mdx
By @theorem:4.6 the map is linear, which is what @eq:5.107 states.
The construction was introduced in @sec:4.3; see also @example:scaling-twice.
```

`@num:4.6` prints the bare number (for "Examples @num:a to @num:b"), `@ref:4.6`
picks the kind from the table, and `\@theorem:4.6` writes the literal text.
The kind is checked: `@definition:4.6` pointing at a theorem is a build error.
References belong in prose only — not inside an environment label, not inside
a Markdown link, and nothing may follow the id directly except punctuation.

### Numbers in widget TSX

```tsx
import { num, ref } from "../numbers.generated";
`… follows from ${ref("theorem:4.6")}`   // "… follows from Theorem 4.6"
num("eq:5.107")                          // "5.107"
```

An unknown key is a TypeScript error. Never assemble a number as a string.

### Tooling

- `npm run gen:numbers` after any MDX change; `npm run dev` and
  `npm run build` run it first, and the dev server recomputes the table on
  every save. If a counter shifts, the page does a full reload — that is the
  intended behaviour, not a bug.
- `npm run lint:numbers` fails the build on a hand-written number. If it
  flags something legitimate, restructure the sentence rather than silencing
  it.
- `src/sections/numbers.generated.{json,ts}` are generated. Never edit them.
- `node scripts/gen-numbers.mjs --check` verifies the checked-in table is
  current (useful in CI).

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
- **Three mandatory parts**: one task line (`<Aufgabe>`/`<Task>`), the
  graphic, a state-classed `<Verdikt>`/`<Verdict>` that names the
  mathematical reason. The prose before the box introduces every quantity
  the widget uses; the prose inside the box after the widget states the
  insight in 2–4 sentences (the print export shows only that prose).
- **Tolerance is not equality.** Verdicts distinguish exactly degenerate
  (defined by the controlled parameter or a symbolic condition, e.g. the
  slider on 0 or the singular preset, never by `=== 0` on a derived
  float), nearly degenerate ("ill-conditioned", never "singular"/"parallel")
  and regular.
- **Numbers are verified by a script in `scripts/verify/`** (run by
  `npm run verify:numbers`), cited by path in the widget header. Never cite
  a scratchpad; assertions must be able to fail.
- **Every drag has a slider or number field on the same state** (dual
  path); no unseeded `Math.random`; SVG with `viewBox` also gets
  `width`/`height` when it is not the flex item itself (otherwise Chromium
  can collapse it to ~2 px inside a flex column, and the build stays green).
- **One verify script per widget**, `scripts/verify/<Widget>.mjs`
  (auto-discovered by `npm run verify:numbers`), so parallel authors never
  overwrite each other's checks; it drives every preset and asserts the
  verdict branch it lands in. A number quoted in more than one place
  (prose, quiz feedback, verdict) comes from one constant or `num()`.
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
  cross-reference the section instead: `@sec:4.2`. Concept modules carry no
  numbers of their own and should stay reference-free so they can be copied
  forward to the next chapter.
- **Git: NEVER run git stash / checkout / reset / commit. No git commands at
  all.** Undo your own mistakes by editing files.
- **`npm run typecheck:mdx` is not parallel-safe** (it compiles every MDX
  file to a temp `.mdx-check.tsx` inside `src/`, which sibling agents' runs
  then pick up and which may vanish mid-run: `ENOENT`). Section agents run
  `npm run test:mdx` and the build's other checks; the orchestrator runs
  `typecheck:mdx` once after all agents finish.
- **Environment labels are plain text**: no `$…$`, no backticks in
  `:::theorem[…]` labels, because the failure message names no file.
- **Errors in the source** (a slide, a book) are written correctly here,
  never discussed ("the lecture is wrong about…") and never reproduced.
  Record them in `{{ERRATA_FILE}}` (one line: source, location, finding,
  what this text does instead) so the author can review the correction and
  fix the source upstream.
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

`id` is the SOURCE's section number; it is also the anchor `#sec-4.1` and the
target of `@sec:4.1`, and the counter uses it as the prefix for every number
it assigns inside the file. An optional `export const key = "determinant";`
adds a second anchor `#sec-determinant` and lets `@sec:determinant` survive a
renumbering — worth it only for sections you expect to move.

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
