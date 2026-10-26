# Project conventions for the bundled React/MDX starter

Read this reference when using the starter's authoring syntax. For an existing
project, use its conventions instead. Do not copy this entire reference into
every app; the one part every section writer must have is the "Authoring
syntax (MDX)" section below, because each of its rules marks a form that once
compiled green while losing content. Instantiate that section as
`<app-root>/AUTHORING.md` and point writers at it (the workflow template does).

## Setup

Copy `assets/app-template/` to the new app, then replace the title/kicker/source
attribution placeholders in `index.html` and `src/App.tsx`. Add required source
and license links as JSX links, not escaped HTML inside a string. The starter
uses English UI defaults; localize visible and accessible labels together.

Use Node 22.18+ (type stripping is on by default from that release, and the
verify scripts import plain `.ts` modules without a flag), install dependencies,
retain the generated lockfile, and run `npm run build` and
`npm run verify:numbers` before adding content. `npm run build` emits a normal
hosted site; `npm run build:singlefile` emits the offline single-HTML variant.
Both write `dist/`, so the last build you run is the deliverable. MathJax is
bundled in both. `--mode singlefile` also selects `.env.singlefile` files if
you add any; the starter has none. The starter does not include a PDF exporter
or chapter router. `npm run verify:browser` renders a built app headlessly
(needs Playwright and at least one registered section; see verification.md).

Create only the necessary `src/sections/S*.mdx` files with exported `id` and
`title`; the registry discovers them automatically. Concepts use
`src/concepts/<id>.mdx` and `export const title = "…"`. Existing legacy TSX
concepts are supported; do not register the same ID in both formats.
Run `npm run gen:numbers` after changing labels.

For a new app, write a short `CONVENTIONS.md` containing project decisions:
source/scope and reuse permissions; audience and prerequisite boundary;
language/notation/number formatting; core vs optional material; existing or
needed canonical concept IDs; output mode; relevant checks; and an errata file
if needed. Do not invent a large concept list before seeing its uses. Follow
the user's prose style rather than importing fmm-skript's punctuation quotas.

## Authoring syntax (MDX)

Sections and concept bodies are `.mdx`. Write maths the way the source
writes it — single backslashes — and let the compiler do the escaping:

| English authoring form | German alias | result |
|---|---|---|
| `:::definition[…]`, `:::theorem[…]`, `:::lemma[…]`, `:::corollary[…]`, `:::example[…]`, `:::remark[…]`, `:::algorithm[…]` | `:::satz[…]`, `:::korollar[…]`, `:::beispiel[…]`, `:::bemerkung[…]`, `:::algorithmus[…]` | `<EnvBlock kind label>`; `kind` is also the printed English or German label |
| `::::proof` / `:::step` / `::why[…]` | `::::beweis` / `:::schritt` / `::why[…]` | `<Proof>` / `<PStep why>` |
| `::::quiz` / `:::question{true}` or `{false}` | `::::quiz` / `:::frage{wahr}` or `{falsch}` | `<Quiz>` / `<Frage>` (alias `<Question>`) |
| `:::interactive[Title]` | `:::interaktiv[Title]` | `<Interaktiv>` (alias `<Interactive>`) — the box around a widget, its task and its readout; core material, always open |
| `:::deepdive[Title]` | `:::vertiefung[Title]` | `<ExpandedReading>` — optional extra material (proofs the lecture only cites, excursions); collapsed; to nest a widget box, write `::::deepdive` around `:::interactive` (the outer fence is longer) |
| `::source[…]` | `::quelle[…]` | small grey source line |
| `:c[text]{#id}` | `:k[text]{#id}` | `<ConceptLink>` |
| `:d[text]{#slug}`, `:d[text]{id=4.6}` | — | `<ConceptLink id="env:…">`: grey underline, previews the wording of that labelled definition/theorem (see "Definition previews") |
| `::::proof{no-qed}` | `::::beweis{ohne-qed}` | `<Proof qed={false}>` |
| `@theorem:4.6`, `@definition:…`, `@lemma:…`, `@corollary:…`, `@example:…`, `@remark:…`, `@algorithm:…` | `@satz:…`, `@korollar:…`, `@beispiel:…`, `@bemerkung:…`, `@algorithmus:…` | a link reading "Theorem 4.6"; for definitions, theorems, lemmas and corollaries it also previews the wording on hover |
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
- An unmatched `[` inside a directive label (`::why[…]`, `:::deepdive[…]`),
  even inside its math, breaks the directive silently: the whole
  `::why[…]` is printed as literal text. Write a half-open interval there as
  `$\lbrack 0, 1)$`.
- In `{#…}` a dot starts a class, so `:d[term]{#4.6}` means id `4`. A source
  number needs `{id=4.6}`; the compiler rejects the `#` form.

Errors carry a line number. A writer working in parallel with others has two
read-only checks for their own file: `node scripts/gen-numbers.mjs --check`
parses every MDX file without writing anything (a "table is out of date"
message, or an error inside somebody else's unfinished file, is not the
writer's problem), and `npm run lint:numbers` finds hand-typed numbers.
`npm run test:mdx` runs the parser fixtures, not your file. The full build and
`npm run typecheck:mdx` are the serial checks after writers have stopped, and
nothing before them is a substitute; plain `tsc --noEmit` only sees the `.mdx`
import shim and cannot validate the JSX generated from an MDX file.

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
  it uses a shorter fence (`:::interactive` nested in `::::deepdive`) —
  optional is the material, not the widget.

Keep core material visible. Optional links into a deep dive are allowed when
navigation opens the target; main-text reasoning must not silently require it.

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
  offset, `touch-action`; provide keyboard and non-drag pointer operation
  of the same state (a suitable native control is often sufficient).
- `Aufgabe`/`Task` (the one-line task), `Verdikt`/`Verdict` (state-classed
  verdict: symbol + colour + `aria-live`), `Schaetzfrage`/`GuessFirst` and
  `SchaetzfrageAuswahl`/`GuessFirstChoice` (predict-then-reveal: number,
  choice, range or click-in-figure),
  `Stepper` (scrubbable, optional play, never autostarts),
  `useAnimatedValue` / `useAnimatedMatrix` (transitions for discrete jumps
  only), `Surface3D` + `ViewControls` (a 3D view for when depth is the
  lesson; a 2D contour panel is usually easier to read precisely, so pair
  them only when the correspondence helps).
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

**Do not hand-type cross-reference numbers.** Not "Theorem 4.6", not "(5.107)", not "Section 4.3"
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
| section | `export const id = "4.6";` | Choose an ID following the project's numbering |
| no number at all | — | `:::remark[(A convention)]` |

A source number is its own id, so nothing re-derives it and
the source's numbering is preserved exactly. A slug is numbered
`<section-id>.<n>` in document order, skipping numbers a source-numbered
object in the same file already claimed. Slugs are `a-z`, `0-9`, `-`, never
purely numeric, and unique across the whole app.

Preserve source labels when required; otherwise label what is referenced. An unlabelled `$$…$$` prints no
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

### Definition previews (`:d`)

A term the text defines itself links to its definition with
`:d[scaling map]{id=4.6}` (source number) or `:d[KKT conditions]{#kkt}`
(slug). The target must be a labelled `:::definition`, `:::theorem`,
`:::lemma` or `:::corollary`; anything else is a build error. Hovering shows
the environment's exact wording, with a footer link "→ Definition 4.6 in
Section 4.6"; references to those four kinds (`@definition:4.6`, …) preview
the same window and still navigate on click. Examples, remarks and algorithms
stay plain links. `:d` is allowed inside `::why[…]`.

- The windows are generated copies: `npm run gen:definitions`
  (`scripts/gen-definitions.mjs`, run by `dev`, `build` and the dev server)
  writes one `src/definitions/<id>.mdx` per environment. Never edit them, and
  put `src/definitions/` in the app's `.gitignore`. A body with a heading, a
  nested block, a relative path or `import`/`export` cannot be copied and
  fails the generator.
- Use `:d` at the first real mention in a LATER section's prose, not in the
  defining section, headings, labels or formulas, and not at every mention.
  `:c` stays the form for prerequisites from outside the text.
- Link only where the word means exactly the defined concept. If the text
  uses it more loosely than the definition (e.g. "residual" for something
  other than the defined residual), write no `:d`: a misleading preview is
  worse than none.

### Tooling

- `npm run gen:numbers` after any MDX change; `npm run dev` and
  `npm run build` run it first, and the dev server recomputes the table on
  every save. If a counter shifts, the page does a full reload — that is the
  intended behaviour, not a bug.
- `npm run lint:numbers` fails the build on a hand-written number. Investigate false positives against the actual syntax; do not distort
  correct prose merely to satisfy a heuristic.
- `src/sections/numbers.generated.{json,ts}` are generated. Never edit them.
- `node scripts/gen-numbers.mjs --check` verifies the checked-in table is
  current (useful in CI).

## Operational constraints

Use the actual macro definitions in `src/mathjax-setup.ts`; do not guess macro
meanings. Keep `mjx-container > svg { display: inline }` in the stylesheet.
Environment labels are plain text (no math or backticks). Section metadata and
number tables drive anchors; source numbers are explicit IDs and generated
slug numbers serve added material. Preserve stable aliases when moving content.

Source-specific facts to record in `CONVENTIONS.md` before writers start:

- **Unnumbered sources.** If the source numbers no equations (some books number
  nothing outside displayed theorems), say so explicitly and instruct writers
  to use bare `$$…$$` unless a later reference needs a slug. Without that
  sentence, writers fabricate plausible-looking equation numbers.
- **Concepts the chapter itself introduces** are referenced with
  `@definition:…`/`@sec:…` or `:d[…]` (a preview of the text's own
  definition), not with `:c` pop-ups; `:c` is for prerequisites from outside
  the chapter.
- **Errors in the source** (a slide, a book) are written correctly here, never
  discussed in the student-facing text ("the lecture is wrong about…") and
  never reproduced. Record each in the errata file (source, location, finding,
  what this text does instead) so the author can fix the source upstream.
- **Bold Greek** is `\boldsymbol{\Sigma}`; MathJax's `\mathbf` does not bold
  Greek letters. Standard environments (`bmatrix`, `aligned`) and commands
  (`\operatorname`, `\overset`, `\phantom`) work with single backslashes in MDX.

The project may choose a proof/stepper default. The starter initially shows
the first proof step and offers the full proof; this is a configurable teaching
choice, not evidence that all readers learn better by clicking through proofs.

Widget implementation guidance is in `src/lib/widgets/README-widgets.md` and
`__examples__.tsx`; available exports in `src/lib/index.ts` are authoritative.
Read only the component code needed for the task. The explorable-widgets skill,
when available, provides design guidance. At minimum: informative labels and
initial state, accessible controls, coherent numerical/visual state, correct
assumptions and boundaries, and concise interpretation. No required widget,
preset, verdict, prediction, or quiz counts.

Run shared generators, MDX typechecking, and full builds serially after writers
stop. Parallel section writers own disjoint section/widget files; one integrator
owns registries, generated files, shared components, and shared documentation.
The MDX checker writes temporary `.*.mdx-check.tsx` files under src; do not run
multiple instances or delete their files while one is active. A component or
parser change needs its relevant tests and rendered verification, even if the
library passed a historical review.
