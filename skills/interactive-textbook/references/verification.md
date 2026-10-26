# Verification

Choose checks by what changed. An agent's report is evidence to inspect, not
a guarantee. Record the revision, scope, commands, outcomes, and anything not
run. Do not force a complete textbook audit for a local prose edit.

## Template gates

The template's `npm run build` runs numbering generation/lint, TypeScript,
MDX typechecking, parser fixtures, library tests, and the Vite build.
`npm run verify:numbers` adds the committed numerical and macro checks.
After editing MDX, check the generated number table before delivery:

```bash
npm run build
npm run verify:numbers
node scripts/gen-numbers.mjs --check
```

Both build modes write `dist/`, so the last build you run is the deliverable:
finish with `npm run build:singlefile` when delivering offline HTML and test
that output with networking disabled (a normal hosted build is not
double-clickable merely because MathJax is bundled); finish with
`npm run build` for a hosted site. Commit the instantiated app's lockfile and
use its supported Node version; do not upgrade dependencies as a side effect
of editing prose.

Shared generators and builds mutate output files. Run them serially after
writers have stopped. In particular, `typecheck:mdx` creates temporary TSX
beside MDX and concurrent runs can interfere. Remove stale checker files only
when no check is running, then retry once for that identified cause.

## Mathematics and source fidelity

Check changed statements against the actual source and local notation. For
math-heavy PDFs, inspect rendered pages; text extraction is useful for finding
content but can corrupt notation. Prioritize assumptions, signs, dimensions,
regime boundaries, and claims changed by adaptation. Match source numbering
when preserving it; do not invent equation tags to meet a quota.

Exercise nontrivial widget calculations and classifiers against independent
known values or invariants. Tests should import production functions where
feasible. A script that independently recalculates an example may check the
prose, but does not check the widget's implementation. Missing test evidence
and demonstrated incorrect mathematics are different findings.

## Browser checks

The template ships the mechanical part as `npm run verify:browser`
(`scripts/browser-check.mjs`). Run it on the deliverable: `dist/index.html`
after `build:singlefile` (opened via `file://` with every request other than
that one document aborted, so a build that still reaches for the network or
for sibling files fails), or a served hosted build by URL. It needs Playwright
(resolved from the app, `PLAYWRIGHT_MODULE_PATH`, or the global npm root;
`--executable` points at a Chromium binary) and **at least one registered
section**: the bare starter registers none, because `_demo.mdx` does not match
the `S*.mdx` glob, so a check on the bare starter proves nothing. To
smoke-test the starter itself, *move* `_demo.mdx` to `S46.mdx` for the run
(copying it fails: the numbering scan sees the underscore file too and reports
id 4.6 twice). Do that on a copy outside `~/.claude` (e.g. the scratchpad):
the template lives in the auto-synced config repo, whose 5-minute sync commits
a temporary rename. Exit 2 means no browser runtime was available; report that as a
rendering gap, never as a pass.

What the script checks, so a hand-run in another harness can reproduce it:

- Identity first: the expected section anchor `#sec-<id>` is on the page, and
  for a URL target the served document references the same `assets/` files as
  the local `dist/index.html` (a single-file build served by URL must be
  identical to it). A stale localhost server otherwise gives convincing
  results for the wrong revision; when serving, pick a free port.
- Math readiness before any assertion: `MathJax.startup.promise` when the
  global is exposed, otherwise wait until the `mjx-container` count stops
  changing. Then at least one formula when the section source contains math
  outside code spans (a text-only section is legitimate; `--section` with no
  matching file expects math) and zero
  `mjx-merror, [data-mml-node="merror"]`.
  Undefined macros typeset as literal text with no error node, so
  `scripts/verify/scan-macros.mjs` stays a separate check; look at the
  visible formulas too.
- Console errors (a missing favicon is not one), failed requests, and (file
  target) any request other than the document itself.
- Layout at 390 px and 1300 px: nothing wider than the viewport (MathJax
  internals excluded), no horizontal scroll, and no plot SVG (an `svg` with a
  `viewBox` at least 100 units wide, outside `mjx-container`) rendered narrower
  than 40 px, which is what a viewBox-only SVG collapses to in a flex column.
  Icons and math glyphs are legitimately small and are not counted, nor are
  plots inside a collapsed deep dive, which are not rendered until opened.
- Concept windows (selectors `[data-concept-link]`, `[data-tt-key]`,
  `[data-tt-pinned="true"]`): hover opens one preview after the 120 ms dwell;
  moving the pointer into it keeps it; a link inside it opens a second window;
  a pointer that comes to rest in the corridor between link and window (on
  the segment joining their centres) closes the preview within 1.5 s; a hover
  shorter than the dwell followed by leaving
  opens nothing (0 windows after 900 ms); click pins; a pinned window survives
  wheel scroll and click-away, moves when dragged by its title bar, and Escape
  closes it. The two timing checks are the failure modes (1) and (2) recorded
  at the top of `src/lib/tooltip/TooltipEngine.tsx`.
- Fragment links: a `#sec-` link lands with the heading at the top, not
  mid-section; scrolling right after the jump is not undone; a link to an id
  inside a collapsed deep dive opens it (the demo carries `#eq-guess-length`
  for this). Both regressions shipped once in fmm-skript.
- Deep dives (`[data-deep]`, `[data-deep-label]`): the body is hidden before
  the button is clicked and shown after.

The script cannot judge what it draws. Look at the screenshots it writes
(initial state at both widths, an open preview, a pinned window, an opened deep
dive): math typeset rather than raw TeX, windows next to their links, widgets
drawn rather than blank, no "Deep dive: Deep dive:" double labels. For changed
widgets also exercise defaults, boundaries, invalid input, reset, and the
important regimes by hand, with keyboard focus and a non-drag pointer path. If
predictions exist, check that reveal works and the pre-reveal view does not
spoil the result. Check links into collapsed content and across lazy chapter
routes. Requested print/export output needs its own inspection; the starter
does not supply fmm-skript's PDF pipeline. For broad audits, inventory the
source tree and report the subset actually inspected.

## Structural changes and migrations

Check orphan concepts, synonyms, duplicate derivations, and hidden core content
when restructuring a chapter. Account for glossary/search/route entry points
before calling an unlinked concept unused. Resolve missing concept links by
reusing a canonical explanation, adding reviewed necessary content, or
removing an unnecessary link; do not silently generate filler stubs.

For a length review, classify every block against the source as CORE (in the
source or lecture), BRIDGE (needed to read the core) or EXTRA (beyond it), with
word counts, and compare the total with what the course can carry; agents
promote appendix material into numbered main-text results and write the same
summary three times, so keep the source's own core/optional distinction. When
two concept ids mean the same thing, keep the one with more inbound links and
migrate the rest, but check stable anchors and navigation entries before
deleting either. Fix rounds inflate (a caveat lands in prose, task line,
verdict and closing at once): take a word-count baseline before the round
(`git show HEAD:<file> | wc -w`) and run a shortening pass after it.

When changing the MDX compiler, run its fixtures and compare the ordered
semantic inventory (`mdx/inventory.mjs`) against the previous revision.
`mdx/compare.mjs old.tsx new.mdx` supports section-format migrations. For a
corpus snapshot use `scripts/verify/inventory-snapshot.mjs` with `--write`
and `--compare`; inspect every intentional difference. Inventories detect
many losses but cannot prove arbitrary React equivalence. Do not replace
semantic comparison with an `innerText` snapshot of lazily rendered content.

For reused prose/assets, verify attribution and the applicable permissions.
For an adaptation of a third-party copyrighted source, run the leak detector
before delivery: extract all authored prose from `src/sections/**` and
`src/concepts/**` (pop-up prose is where leaks hide), normalize both sides
(lowercase, non-alphanumerics to spaces), slide an 8-word window over the
app prose and flag every window that occurs verbatim in the `pdftotext`
extraction of the source pages. It is exhaustive because it costs the same as
sampling and has caught leaks that per-section reviewers missed; frame
sentences (equation lead-ins, list intros, captions) are the usual culprits.
Triage the hits rather than treating the count as a gate: a marked quotation,
a conventional phrase ("let A be an n by n matrix"), or licensed and
user-owned text is fine; a copied sentence is rewritten in fresh words, then
the typecheck, build and scan are re-run. The scan locates passages; it is not
a permission test, and a clean scan does not by itself make an adaptation
publishable.
