---
name: latexdiff
description: |
  Generate marked-up PDFs of LaTeX documents showing tracked changes (additions/deletions)
  between two versions. Use whenever the user wants to see what changed in a paper, prepare
  a "track changes" PDF for a journal revision or co-author, compare a .tex file against a
  git revision, or diff two versions of a Quarto/Rmd manuscript, even if they just say
  "show the reviewers what we changed" or "diff the old and new version of the paper".
  Covers git-based and arbitrary-file comparisons, Quarto/Rmd sources via keep-tex, and
  the knitr-verbatim, bookmark, and JSS-template compile failures the raw diff produces.
---

# LaTeX Diff Generation

Generate highlighted PDFs showing additions (blue/underline) and deletions (red/strikethrough) between LaTeX document versions.

## Basic Usage

```bash
latexdiff old.tex new.tex > diff.tex
xelatex diff.tex  # or pdflatex
bibtex diff       # if bibliography exists
xelatex diff.tex
xelatex diff.tex
```

## Common Workflows

### Compare current file with git HEAD
```bash
git show HEAD:document.tex > document_old.tex
latexdiff document_old.tex document.tex > document_diff.tex
# compile diff.tex
rm document_old.tex
```

### Compare two git commits
```bash
git show COMMIT1:document.tex > old.tex
git show COMMIT2:document.tex > new.tex
latexdiff old.tex new.tex > diff.tex
```

### Compare with specific revision
```bash
git show HEAD~3:document.tex > old.tex
latexdiff old.tex document.tex > diff.tex
```

### Quarto / R Markdown sources (no `.tex` to diff)

latexdiff needs `.tex`. When the source is `.qmd`/`.Rmd`, don't diff the source —
render **each version** to `.tex` and diff those. Set `keep-tex: true` (Quarto) /
`keep_tex: TRUE` (rmarkdown) so the intermediate `.tex` survives. The supporting
files (`.bib`, figures, `_extensions`, data) are usually unchanged between the two
revisions, so render in place, swapping only the source:

```bash
cd paper-dir
cp paper.qmd /tmp/paper.HEAD.qmd                 # back up the new version
quarto render paper.qmd --to <fmt> ; cp paper.tex paper-new.tex
git show <OLD>:path/to/paper.qmd > paper.qmd     # swap in the old version
quarto render paper.qmd --to <fmt> ; cp paper.tex paper-old.tex
cp /tmp/paper.HEAD.qmd paper.qmd                 # restore working tree (verify: git status)
latexdiff --type=CFONT --math-markup=0 --disable-citation-markup \
  --graphics-markup=none --no-links paper-old.tex paper-new.tex > paper-diff.tex
```

Notes:
- The render's own PDF step may **fail** while still writing the `.tex` first
  (`keep-tex` writes it before LaTeX runs). A non-zero `quarto render` exit is fine
  as long as `paper.tex` was produced — grab it and move on (`|| true`).
- If the pass is prose-only / content-frozen, `--math-markup=0` plus the flags above
  keep markup out of unchanged code/math/verbatim, sidestepping the knitr-verbatim
  breakage entirely (nothing in those blocks changed, so latexdiff won't touch them).
- Compile `paper-diff.tex` in the paper directory (relative paths to `.cls`, `.bib`,
  and the render-generated `*_files/` figures must resolve).

## Useful Options

| Option | Effect |
|--------|--------|
| `--type=UNDERLINE` | Default markup style |
| `--type=CFONT` | Use color+font changes |
| `--type=CTRADITIONAL` | Traditional red/blue |
| `--flatten` | Expand `\input{}` commands |
| `--exclude-textcmd=cmd` | Ignore specific commands |
| `--math-markup=0` | Disable math diffing; useful when equations break |
| `--disable-citation-markup` | Avoid fragile citation command diffs |
| `--graphics-markup=none` | Avoid wrapping graphics commands |
| `--no-links` | Avoid hyperlink markup conflicts |

## Compilation Notes

- Use same compiler as original document (xelatex/pdflatex/lualatex)
- Run bibtex if document has bibliography
- Multiple passes needed to resolve references
- The diff.tex file can be large; compilation may be slower

## Troubleshooting

- **Missing packages**: The diff uses `ulem`, `color`, `hyperref` - ensure available
- **Math mode errors**: Try `--math-markup=0` to disable math diffing
- **Complex documents**: Use `--flatten` for multi-file projects

### Knitr/Rnw and Verbatim-Like Blocks

For Sweave/knitr documents with `knitrout`, `alltt`, `verbatim`,
`lstlisting`, or latexdiff-created `DIFverbatim` blocks, raw deletion markup can
make TeX fail with errors like `Missing $ inserted`, `Extra }, or forgotten $`,
`Paragraph ended before \lst@GLI was complete`, or `\end occurred inside a
group`. Switching from `pdflatex` to `xelatex`/`lualatex` usually does not fix
this because the generated TeX is structurally broken.

Prefer keeping deletions in normal prose and filtering only deleted literal/code
blocks:

```bash
latexdiff \
  --type=CFONT \
  --math-markup=0 \
  --disable-citation-markup \
  --graphics-markup=none \
  --no-links \
  old.tex new.tex > diff.tex
```

Then post-process `diff.tex` before compiling:

- remove whole `\DIFdelbegin...\DIFdelend` blocks if they contain
  `knitrout`, `alltt`, `verbatim`, `lstlisting`, `DIFverbatim`, or knitr
  highlight macros such as `\hldef`, `\hlkwd`, `\hlcom`;
- strip inline `\DIFdel{...}` only inside remaining literal environments;
- do not use global `--no-del` unless the user explicitly does not need
  deletions.

If `\section{\DIFadd{...}}` or similar headings break `hyperref` bookmarks, strip
diff markup from heading commands or add `\pdfstringdefDisableCommands` for the
`DIF*` macros.

After ANY failed compile of the diff (especially the heading/bookmark case
above), clean stale aux files before recompiling: `latexmk -C diff.tex` or at
least `rm diff.out`. The broken `\DIFadd` markup gets baked into the `.out`
bookmark file, so even a corrected `diff.tex` then fails with misleading errors
like `Argument of \@@BOOKMARK has an extra }` — these come from the stale
`.out`, not from the current source.

### `! LaTeX Error: Lonely \item` at a `\DIFdelend`

When an edit converts a `list` (`itemize`/`enumerate`) into flowing prose, latexdiff
comments out the deleted `\begin{enumerate}`/`\end{enumerate}` as `%DIFDELCMD` but
keeps the items as `\item%DIFAUXCMD` marker lines — now orphaned outside any list.
Delete those marker lines from `diff.tex` (their text content survives in the
surrounding `\DIFadd`/`\DIFdel`):

```bash
perl -ni -e 'print unless /^\\item%DIFAUXCMD\s*$/' diff.tex
```

### JSS / `textcase` proof PDFs

Rendered `.tex` from JSS-template Quarto docs can hit two things unrelated to your
edits — for a **proof** diff PDF (bookmarks/outline don't matter), inject a fix right
before `\begin{document}` and recompile:

- `! Use of \bookmark doesn't match its definition` at a `\subsection{\texorpdfstring
  {... \texttt{...} ...}}` heading (code-in-heading + `textcase` running-head
  uppercasing colliding with `bookmark`). No-op the bookmark writer:
  `\AddToHook{begindocument/end}{\renewcommand\bookmark[2][]{}}`.
- `! \mathbf allowed only in math mode` / `! Extra \else` at `\begin{document}` when
  the **abstract** contains inline math (jss.cls runs `\maketitle` before
  `unicode-math` finalizes alphabets). Force alphabet init first:
  `\AddToHook{begindocument}[mi]{\sbox\z@{$\mathbf{x}$}}\DeclareHookRule{begindocument}{mi}{before}{maketitle}`.

(These are proof-PDF workarounds. The real fix belongs in the source — strip code/math
from JSS headings, add the hook-rule to the doc's `include-in-header`.)
