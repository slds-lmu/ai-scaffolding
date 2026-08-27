# Verification (run after the workflow completes)

Two layers: the workflow's integration agent already guarantees TypeScript,
the MDX typecheck, `vite build`, and concept closure. This file covers what
that agent cannot do: seeing the app.

## 1. Serve the built app

```bash
cd <app-root> && npm run build
# pick a FREE port first — a leftover preview server from an earlier build
# will happily serve the WRONG app and your checks will "pass" convincingly
# (this has happened twice):
ss -tln | grep <port> || npx vite preview --port <port> --strictPort  # via run_in_background
```

**Identity assertion before anything else**: `curl -s localhost:<port> |
grep '<title>'` must show THIS app's title. In the Playwright script, assert
the expected `<title>` and that `section[id^=sec-]` ids match the sections
you actually built — only then trust any counts.

## 2. Playwright functional + visual check

Playwright needs a venv on PEP-668 systems (Ubuntu 24.04+/Mint 22+):

```bash
python3 -m venv <scratch>/venv
<scratch>/venv/bin/pip install playwright --quiet
<scratch>/venv/bin/python -m playwright install chromium
```

Script skeleton (headless chromium, viewport ~1400×900). Wait
`networkidle` + ~4 s for MathJax before asserting. Check, in order:

1. **MathJax health**: `mjx-container` count > 0 AND zero errors. CAUTION:
   with SVG output, errors are NOT `mjx-merror` elements — count BOTH
   selectors: `mjx-merror, [data-mml-node="merror"]`, and print
   `data-mjx-error` attributes (they pinpoint the broken TeX string).
   Checking only `mjx-merror` silently passes broken math.
   **Second trap: an undefined macro is not an error at all.** The
   `noundefined` package of `input/tex-full` typesets `\cbblue` as red
   literal text in an `mtext`, no merror anywhere. A widget coloured its
   only content with a macro that did not exist and passed every gate for
   months. Scan for it: collect every `\name` used in `src/**` (exclude
   `.mdx-check.tsx` temp files, where `\n` escapes look like macros, and
   skip delimiter macros such as `\left`/`\Big` which false-alarm with dummy
   arguments), typeset each headlessly (mathjax `node-main.js`,
   `input/tex-full` + the project's macro set) and fail if the macro name
   comes back as literal text (with SVG output there are no text nodes:
   decode the `data-c` glyph codes of the emitted `<mtext>`). The template
   ships this as `scripts/verify/scan-macros.mjs` (part of
   `npm run verify:numbers`, reads `texMacros` from `src/mathjax-setup.ts`);
   if a project changed its macro setup, point the scanner at the new
   export.
   **Layout health at two widths** (~390 px and ~1300 px), in the same
   script: fail if any `svg` has a rendered width < 40 px (viewBox-only
   SVGs collapse inside flex columns), if any element is wider than the
   viewport (tooltip panels with `max-w-md`, tables), if an open tooltip's
   bounding box leaves the viewport, or if a deep-dive body is visible
   before its button was clicked. Then eyeball the screenshots for clipped
   tick labels and legends over data. Type checks and the MDX oracle cannot
   see any of these.
2. **Structure**: counts of `[data-concept-link]` (concept links),
   `[data-deep-label]` (accordions; do not match on the label text, a
   project may localize it), `section[id^=sec-]`.
3. **Window chain**: hover a body concept link → expect 1 `[data-tt-key]`
   after ~400 ms; move the pointer INTO it and wait ~700 ms → still 1 (it
   must survive the pointer entering it); hover a `[data-concept-link]`
   inside it → 2; repeat for a 3rd level. Screenshot each stage.
4. **Pin, drag, teardown**: click a concept link → expect
   `[data-tt-pinned="true"]`; `page.mouse.wheel(0, 700)` → the pinned window
   is still there (only previews die on scroll); drag its title bar by
   (160, 90) and check the bounding box moved by that much; click far away →
   pinned survives; Escape → 0 windows. Also check the two regressions this
   engine was built to kill: an 80 ms hover followed by moving away leaves 0
   windows after 900 ms, and a pointer that comes to rest in the gap between
   link and window (then does not move at all) leaves 0 windows after 1.5 s.
5. **Deep dive**: click the first accordion button, screenshot the opened
   widget.
6. **Console**: collect `console.error` messages; expect none.

Read the screenshots with the Read tool and actually look at them: math
typeset (no raw `\frac`), tooltips positioned near their links, widgets
drawn (not blank canvases), no double "Deep dive: Deep dive:" labels.
Looking is one half; the other half is a source audit of the same widgets
(headers, verify scripts, verdict branches); the two passes catch disjoint
defect classes, and the denominator ("all N widgets checked") is counted
from `ls src/**/widgets`, not from what was on screen.
Also inspect widget quality (real user complaints from the pilot):
axes labeled and not cut off, vectors/curves fully inside the canvas,
the visualized object's numeric state printed next to its sliders, and
color-coded equations using each color for the same subexpression in every
line (no half-applied coloring in derivations).

## 3. Known cosmetic traps to grep for

- `rg -n ':::(deepdive|vertiefung)\[Deep dive:?|<ExpandedReading[^>]*title="Deep dive' src/sections src/concepts`
  finds titles that repeat the prefix the component already adds; strip the
  prefix from the directive label. The JSX branch covers legacy modules.
- Extract concept ids from both MDX directives and legacy JSX with
  `rg -o --no-filename ':[kc]\[[^]]*\]\{#[A-Za-z0-9._-]+\}|<ConceptLink[[:space:]][^>]*id="[^"]+"' src`.
  Normalize the text after `#` or inside `id="…"`, sort uniquely, and compare
  it with both `src/concepts/<id>.mdx` and `<id>.tsx`. This should already be
  closed by integration, but it is a quick independent check.

## 3a. Structural greps (cheap, run every time; first pass, not proof)

These greps are deliberately simple and miss escaped labels, links built in
TSX expressions and unusual syntax. Treat an empty result as "nothing
obvious", and use the MDX inventory (`mdx/inventory.mjs`) when a project
needs an authoritative list.

- **Orphan concepts**: every `src/concepts/<id>.mdx` must be linked from at
  least one section or concept (`rg -l ':[kc]\[[^]]*\]\{#<id>\}'`). An
  orphan is unreviewed by construction; delete or link it.
- **Near-duplicate concept ids**: sort ids, eyeball adjacent pairs and
  hyphen permutations (`matrix-inverse` / `inverse-matrix`); merge into the
  id with more inbound links.
- **Visible → collapsed dependencies**: for every `@`-reference and quiz
  outside a `:::deepdive`/`:::vertiefung` block, check the target is not
  inside one (a numbering table with block membership makes this a
  one-liner; otherwise a small remark walk). Also grep widget TSX for
  `ref("…")` keys whose targets sit in a deep dive.
- **Verify-script provenance**: every widget header that cites a check
  script must cite a path that exists under `scripts/verify/`; `npm run
  verify:numbers` must be green.
- **Style budget** (if CONVENTIONS sets one): dash count per file vs word
  count, `&mdash;` entities included; a plain `grep '—'` misses them.

## 3b. Numbering gate

```bash
npm run gen:numbers && npm run lint:numbers && node scripts/gen-numbers.mjs --check
```

All three must be clean: no hand-written number anywhere in `src/sections`
or `src/concepts`, and the committed `numbers.generated.*` current. Then
spot-check the rendered page: click one `@theorem:` and one `@eq:` link and
confirm it jumps to the right block, and compare three numbers against the
source PDF — an equation the source numbers must still print the source's
number, not a counted one. If a printed number disagrees with the PDF, the
label was mistyped, not the counter.

When the authoring toolchain itself changed (a remark upgrade, a plugin
edit), record an oracle first and compare afterwards:

```bash
git worktree add /tmp/ref <pre-change-commit>
node scripts/verify/inventory-snapshot.mjs --write /tmp/ref.json --root /tmp/ref
node scripts/verify/inventory-snapshot.mjs --compare /tmp/ref.json
```

Only whitelist an expected class of difference (`--allow link-wrap`,
`--allow heading-id`, `--allow eq-math`), never an individual entry.

## 4. Verbatim sweep (copyright — mandatory, exhaustive)

Do NOT sample sentences — run an exhaustive sliding-window scan; it costs
the same and has twice caught leaks the per-section reviewers missed:

1. Extract all authored prose from `src/sections/**` AND `src/concepts/**`
   (tooltip prose is where leaks hide — no reviewer covers it).
2. Normalize both sides (lowercase, collapse non-alphanumerics to spaces).
3. Slide an 8-word window (step 2–4 words) over the app prose; flag every
   window that occurs verbatim in the `pdftotext` extraction of the source
   pages.
4. Expect ZERO hits; rewrite any hit in fresh words, then re-run the MDX
   typecheck, the build, and the scan.

Frame sentences (equation lead-ins, list intros, figure captions) are the
usual culprits.

## 4b. MDX gate (only when converting an existing TSX section)

`node mdx/compare.mjs old.tsx new.mdx` compares an ordered semantic
inventory of both files — every TeX string, environment kind and label,
concept id, heading, equation tag, quiz truth value, widget prop, plus
prose — and fails on any difference in content, order or nesting.

Do not reach for a rendered-text diff instead. `innerText` is
layout-dependent and the sections carry `content-visibility: auto`, so
skipped subtrees contribute nothing to it: such a check silently compares
only what happens to be on screen. Use `textContent` if you write your own.

Expect the gate to report the deliberate changes and require a human to sign
each off. It is not meant to reach zero automatically. The recurring ones:

- **Extracted widgets.** Preformatted text with inline formatting, SVG and
  anything stateful must move into a companion `.tsx`; the gate sees text
  becoming a widget entry. Check the widget renders the same thing.
- **Unnumbered headings lose their id.** Ids come from the heading's number
  or from `:id[slug]`, so a hand-written `id="sec-2.5-quiz"` disappears. Before signing off,
  grep the whole app for inbound links to that id — if any exist, keep the
  anchor by numbering the heading or adding an explicit anchor element.
- **Quiz widget → directives.** The old hoisted `QUIZ` array plus
  `<QuizWidget/>` becomes `::::quiz`; the gate normalises the questions but
  reports the widget entry as gone.

Known blind spots, so you do not over-trust it: it inventories the component's
main returned tree, so a second `return` behind an early `if` is not compared;
and it models the components it knows plus links, images and prose — it does
not compare arbitrary HTML attributes or inline emphasis structure. It is a
loss detector, not a proof of equivalence.

## 5. Report to the user

Include: sections built, tooltip/widget counts, chain-depth demo screenshot,
build size, open cosmetic issues, and the distribution status that follows
from the licence branch in CONVENTIONS.md: under Branch A the standing
reminder that the app must stay private (paraphrase adaptation of
copyrighted material, internal teaching use only); under Branch B a check
that the footer really carries the attribution, the source and licence links,
the "adapted" note, and the output licence.

The verbatim scan (§4) also changes with the branch: under Branch B verbatim
overlap is permitted, so report hits as *style* findings (text that was
copied rather than restructured for this format) instead of as violations,
and check that anything deliberately quoted is marked as a quote.
