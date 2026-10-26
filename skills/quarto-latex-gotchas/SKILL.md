---
name: quarto-latex-gotchas
description: Verified failure modes and fixes for Quarto and LaTeX builds. Load BEFORE editing or rendering any Quarto/LaTeX source - revealjs decks (slide links, print/handout overflow, PDF figures, MathJax macro includes), JSS Quarto template (keywords, headings, abstract math), kableExtra tables in Quarto PDF, citation keys / .bib, missing include or macro files, German babel shorthands, fancyhdr, unicode-math/amssymb, MathJax macros reused in LaTeX, TinyTeX/tlmgr install failures, headless-Chrome PDF printing. Also load when a render fails or output silently loses content.
---

# Quarto / LaTeX gotchas

General rule: always render and visually verify changes (pdftoppm + image check).
Every item below was hit and verified in a real session.

- **Never write a citation key from memory — `grep` the `.bib` first.** Plausible
  keys are easy to invent (`@Cui2022FUI` for a paper whose real keys were
  `@CuiLerouxSmirnovaCrainiceanu2022` + `@Rpkg_fastFMM`). After rendering, confirm
  no `(?)` appears in the PDF text (`pdftotext ... | grep -F "(?)"`; note `grep "(\?)"`
  does NOT work — `\?` is a GNU BRE quantifier, so use `-F`).
- **Quarto revealjs: in-deck slide links `[text](#/slide-id)` are MANGLED by the
  pandoc postprocessor to `href="#//id"`** (double slash) — reveal.js then silently
  stays on the title slide. Write `[text](#id)` WITHOUT the slash (Quarto adds it)
  or raw HTML `<a href="#/id">`. Verify: `grep 'href="#//'` on the rendered HTML
  must be empty; also check every `href="#/…"` has a matching `<section id>`.
  Give link targets explicit ASCII `{#id}`s — auto-slugs keep umlauts and change
  with titles.
- **Quarto revealjs print/handout: a few px of overflow DELETES the whole block**
  instead of clipping it. Chrome pushes the overflowing element into the next page
  box, which reveal's print CSS suppresses — so the live deck looks perfect while the
  handout silently loses an entire list/paragraph (seen: title + one line, rest gone,
  at 2 px over). Any overflow > 0 is a defect. Detect by loading `<deck>.html?print-pdf`
  in headless Chrome and comparing, per `.pdf-page`, the deepest visible descendant's
  bottom against the page height. **Exclude MathJax internals when measuring**: `MJX-C`
  character elements carry bogus rects and report ~1000 px of phantom overflow on
  perfectly fine slides (skip any tag matching `MJX-*` except `MJX-CONTAINER`). Fix by
  shrinking content (`{.smaller}`) or splitting the slide; note lists render as
  `display: inline-block` and are therefore all-or-nothing. For a text-heavy deck,
  shrink once deck-wide (`/*-- scss:defaults --*/ $presentation-font-size-root: 34px;`)
  instead of `{.smaller}` per slide; give pipe tables explicit column widths via
  longer dash runs in the separator line (`|------|--------------|`), else
  auto-widths wrap cells and push rows off the page.
- **Never reconstruct a referenced include/macro file from usage — `find` the
  original first.** A deck's `\input{../custom_commands.tex}` pointed to a file one
  `find ~ -name custom_commands.tex` away; declaring it lost and guessing 232
  macros from their names produced ~1000 silently wrong formula positions (`\emb`
  guessed as `\operatorname{emb}`, actually bold *e*; `\tr` means transpose in one
  course and trace in a sibling course). Macro names lie about semantics, and a QA
  check for "is it defined?" cannot catch "defined wrongly" — verify against the
  original definitions or the old compiled PDF's rendered symbols.
- **Quarto revealjs: PDF figures render BLANK.** `![](fig.pdf)` becomes
  `<embed data-src=...>`, and reveal's lazy loader promotes `data-src` only for
  `img`/`video`/`audio`/`iframe` — the embed never loads, silently, in live deck and
  print alike. Convert PDFs to PNG. Corollary: a headless screenshot that "looks
  fine" is not evidence a suspected rendering defect is absent — only the mechanism
  is; two agents wrongly dismissed this one as a headless artefact.
- **Quarto revealjs + MathJax macro includes: keep them INSIDE a slide.** A top-level
  `::: {.hidden}` block with `\newcommand`s placed before the first heading becomes its
  own blank slide (pandoc makes preamble content a slide). Put the
  `{{< include _macros.qmd >}}` right after the first `###` heading instead — macros are
  registered in DOM order, so anything later in the deck still sees them.
  `visibility="hidden"` on that slide is NOT a fix: reveal removes the section from the
  DOM before MathJax registers the macros, and every custom macro then renders as
  literal `\bX`, `\bbeta` text throughout the deck.
- **Quarto revealjs: HTML comments (`<!-- ... -->`) before the first `##` heading also
  create an EMPTY slide 2** (same pandoc preamble-section mechanism). It shows up live
  during a talk/exam and shifts every slide number. Put such notes as R comments inside
  the setup chunk. Verify: no `<section>` in the HTML without visible content.
- **knitr cache drops side effects of a cached setup chunk**: `theme_set()`, `options()`
  etc. are not replayed when the chunk is loaded from cache, so a re-render silently
  switches ggplots back to `theme_grey`. Give the setup chunk `cache = FALSE`.
- **JSS Quarto `keywords:` must be PLAIN TEXT** — no `\pkg{}`/`\proglang{}` markup.
  Quarto copies keywords verbatim into `pdfkeywords={...}` (hyperref metadata) and
  `\Plainkeywords{...}`, both of which take plain text only; the `\pkg{...}` braces
  cause a LaTeX "Argument of \reserved@a has an extra }" error near
  `\begin{document}`. `\pkg`/`\proglang` are fine in the `abstract:` body.
- **JSS Quarto VISIBLE keywords need a separate `keywords-formatted:` YAML field.**
  The JSS extension's title partial sets `\Keywords{}` (the *visible* line) only from
  `keywords-formatted`; the plain `keywords:` field feeds only `\Plainkeywords{}` /
  `pdfkeywords`. Without `keywords-formatted:`, `jss.cls`'s placeholder prints on the
  title page: "Keywords: ---!!!---at least one keyword is required---!!!---". Set both
  fields (plain text; verify in the rendered PDF, not the YAML).
- **No math (`$...$`) or code (backticks) in Quarto section headings under the JSS
  template** — it breaks the build. Keep headings plain text; put the math/code in the
  body. Two distinct failure modes seen: (a) "Undefined control sequence" + truncated
  PDF; (b) `! Use of \bookmark doesn't match its definition` at the heading (Quarto wraps
  the code as `\subsection{\texorpdfstring{... \texttt{foo} ...}{...}}`, and `textcase`'s
  running-head uppercasing of that collides with `bookmark`/`hyperref`). Level-dependent:
  a top-level `#` may render the code as a plain body paragraph and survive, but `##`/`###`
  get the `\texorpdfstring` wrapper and break. Fix = strip the backticks/`$…$` from the
  heading (e.g. `` ### The `pffr` fit `` → `### The pffr fit`).
- **Quarto PDF + styled kableExtra tables (cell colors/bold): Quarto's table
  processing MANGLES them.** With a `tbl-`-prefixed chunk label or `tbl-cap`,
  Quarto parses the LaTeX table into its AST and re-emits it: kableExtra cell
  styling gets escaped to literal `\textbackslash cellcolor...`, and plain-kable
  column widths get recomputed from raw string lengths (absurdly wide colored
  columns, clipped label columns). Bypass: `#| output: asis` chunk, NO `tbl-`
  label / `tbl-cap`, emit raw LaTeX — a manual `\begin{table}...\caption{}\label{tbl-x}`
  keeps `@tbl-x` crossrefs working in PDF (HTML formats degrade: emit a plain
  kable fallback via `knitr::is_latex_output()`). Sub-gotchas, all verified:
  (a) the raw-caption parser TRUNCATES the caption at any braced command after
  the leading `\label` (incl. `\ref{}`) — keep captions command-free ($math$ is
  fine); (b) two floats from one asis chunk get merged into subcaptions — one
  float per chunk; (c) set `options(kableExtra.latex.load_packages = FALSE)`
  before kableExtra loads and add `\usepackage{colortbl}` yourself — its auto
  block pulls in the broken `tabu`; (d) under jss.cls + xelatex/unicode-math,
  colortbl's `\CT@*` state is wiped before `\begin{document}` and EVERY
  longtable dies with undefined `\CT@cell@color`; fix with an `\AtBeginDocument`
  hook restoring `\global\let\CT@cell@color\relax` etc. if undefined; (e) an
  oversized `\begin{table}` float (≳45 rows) is DROPPED SILENTLY — after any
  table change, verify the rendered numbering is gap-free (`pdftotext | grep "Table [0-9]:"`).
- **JSS Quarto: inline math in the `abstract:` breaks the PDF build** with
  `! \mathbf allowed only in math mode` / `! Extra \else` at `\begin{document}`.
  Cause: `jss.cls` typesets the abstract from its `begindocument`-hook `\maketitle`,
  which fires *before* `unicode-math` finalizes its math alphabets (jss.cls is loaded
  before the `unicode-math` package, so its hook is registered first). Papers without
  abstract math dodge it. Fix in the format's `include-in-header: text: |` — force the
  alphabets to initialize before `\maketitle`:
  ```latex
  \makeatletter
  \AddToHook{begindocument}[mathinit]{\sbox\z@{$\mathbf{x}$}}
  \DeclareHookRule{begindocument}{mathinit}{before}{maketitle}
  \makeatother
  ```
  (Deferring `\maketitle` to `begindocument/end` also fixes the math but shoves the title
  onto page 2 — use the hook-rule above instead.) Note: a very long JSS title+abstract can
  still land on page 2 on its own — the title block is an unbreakable `\vbox`; that's a
  content-length issue, not this bug.
- **German LaTeX: always load babel as `[ngerman,shorthands=off]`.**
  babel-german makes `"` an ACTIVE character (`"a`→ä, `"s`/`"z`→ß, `"-`→
  discretionary hyphen). Text authored for HTML/MathJax routinely closes a
  `„…"` quote with a straight ASCII `"`, and then `„Krümmung" ist` silently
  becomes `„Krümmungïst` and `glatt" zu` becomes `glattßu` — a text-eater in
  mid-sentence that no error message mentions. Detect with
  `pdftotext … | grep -E 'ïst|ßu'`. Convert paired `„…"` to `„…"` at the
  source-conversion step; leave `"` inside code/verbatim alone.
- **Never redefine `plain` via `\fancypagestyle{plain}{\fancyhf{}…}`.**
  `\fancyhf{}` and `\renewcommand{\headrulewidth}` are GLOBAL: the first page
  that uses `plain` (every `\chapter` opener, every `\tableofcontents`) wipes
  the fields of `fancy` too, and the running head is then empty for the whole
  rest of the book — silently, no warning. `book.cls`'s built-in `plain`
  already gives an empty head plus a centred page number and never touches
  fancyhdr; just use it.
- **Quarto PDF with the default font (Latin Modern) drops Unicode Greek letters and
  ≤/≥ in body text without any error.** Text with literal β, γ, δ, ≤ comes out as
  blanks in the PDF: "the surface (s,t)", "CE  2 pp". This is natural in
  HTML-first Quarto documents and in inline-r `sprintf` output. The render log shows
  no missing-character warning.
  - Detect: `pdftotext doc.pdf - | grep -c "�"` must be 0; also look at a page image.
  - Fix, in the `pdf:` format: `pdf-engine: xelatex` plus a font with Greek
    coverage, e.g. `mainfont: Libertinus Serif` and `mathfont: Libertinus Math`.
    Check what's installed with `fc-list : family`.
  - Afterwards, check again for blank pages: the font change shifts the floats.
- **`amssymb` must not be loaded alongside `unicode-math`** (`! LaTeX Error:
  Command \eth already defined`). unicode-math supplies the symbols — but
  coverage depends on the math FONT: Libertinus Math has no `\square` /
  `\blacksquare`, so build them from rules (`\fbox{\rule…}`) rather than
  hunting a package. To find every undefined macro in one shot instead of one
  xelatex error at a time: `grep -ohE '\\[a-zA-Z]+' doc.tex | sort -u`, then
  emit `\ifcsname <name>\endcsname\else\typeout{UNDEF:<name>}\fi` per name and
  compile that probe. Do the same over any `\input`ed macro file — a macro can
  be defined while its BODY calls something undefined (`\notimplies` →
  `\centernot`, `\tagqed` → `\qedhere`).
- **Macros written for MathJax can be text-mode-only and die in LaTeX math.**
  `\newcommand{\cbred}[1]{{\bfseries\textcolor{red}{#1}}}` renders fine in the
  browser (MathJax ignores the switch) and aborts under LaTeX with
  `\bfseries invalid in math mode`. Redefine to `\symbf` when reusing a
  slide-macro file for print.
- **TinyTeX/TeX Live cross-release: installs fail when local TL is older than
  the remote repo.** Symptom: `tlmgr: Local TeX Live (2025) is older than remote
  repository (2026)` and `tlmgr_install()` silently does nothing (a render then
  dies on `File 'foo.sty' not found`). Don't `reinstall_tinytex()` (slow). Point
  tlmgr at the frozen archive of the local year, then install:
  ```r
  tinytex::tlmgr(c("option", "repository",
    "https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2025/tlnet-final"))
  tinytex::tlmgr_install("draftwatermark")  # then re-render
  ```
  (Bump `2025` to whatever `tlmgr --version` reports as the local release.)

- **`%` in a `kable(format = "latex", caption = ...)` caption is not escaped**: LaTeX reads
  the rest as a comment and dies with `File ended while scanning use of \caption@xdblarg`.
  Escape it (`gsub("(?<!\\\\)%", "\\\\%", cap, perl = TRUE)`) in any table helper.
- **knitr's default `pdf()` device silently drops Greek letters (β, λ, γ) in ggplot labels.**
  Set `knitr: opts_chunk: dev: cairo_pdf` (or use plain-text labels); check `pdftotext` for
  missing glyphs, not just `�`.
- **`knitr::purl()` called inside a running knit fails** (`Duplicate chunk label 'setup'`).
  To reuse another document's code, purl it in a separate process:
  `xfun::Rscript_call(knitr::purl, list(input, output = f, quiet = TRUE, documentation = 0))`,
  then `sys.source(f)` with output-writing helpers stubbed.

## Headless Chrome printing

- **Headless-Chrome batch printing needs a unique `--user-data-dir` per run.**
  Parallel instances sharing the default profile produce blank 1-page PDFs that look
  exactly like a broken document — four agents in one session each misdiagnosed it as
  their own file's fault. Add `--run-all-compositor-stages-before-draw` so Chrome prints
  only after layout settles (with it even a 150 ms `--virtual-time-budget` suffices;
  without it, 12 s was not enough under load). Always assert the resulting page count:
  `[[ -s "$out" ]]` happily passes an empty single-page PDF.
  **And never compute the assertion threshold from the same possibly-missing
  input**: `want=$(grep -c ... "$html" || echo 0)` + `pages >= want` is
  self-disarming — a missing `$html` sets want=0 and 21 blank PDFs sail through
  (verified). Assert input existence separately, before deriving thresholds.
