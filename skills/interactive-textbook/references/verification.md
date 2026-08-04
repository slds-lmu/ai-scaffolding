# Verification (run after the workflow completes)

Two layers: the workflow's integration agent already guarantees `tsc` +
`vite build` pass and concept closure. This file covers what that agent
cannot do: seeing the app.

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

1. **MathJax health**: `mjx-container` count > 0 AND `mjx-merror` count == 0
   (print the merror texts if any — they pinpoint the broken TeX string).
2. **Structure**: counts of `span.cursor-help` (concept links),
   `text=Deep dive:` (accordions), `section[id^=sec-]`.
3. **Tooltip chain**: hover a body concept link → expect 1 `div[role=tooltip]`
   after ~600 ms; wait ~1.2 s (lock); hover a `span.cursor-help` INSIDE the
   tooltip → expect 2; repeat for a 3rd level. Screenshot each stage.
4. **Teardown**: press Escape → expect 0 tooltips. Re-hover → 1; then
   `page.mouse.wheel(0, 300)` → expect 0 (scroll dismissal).
5. **Deep dive**: click the first accordion button, screenshot the opened
   widget.
6. **Console**: collect `console.error` messages; expect none.

Read the screenshots with the Read tool and actually look at them: math
typeset (no raw `\frac`), tooltips positioned near their links, widgets
drawn (not blank canvases), no double "Deep dive: Deep dive:" labels.
Also inspect widget quality (real user complaints from the pilot):
axes labeled and not cut off, vectors/curves fully inside the canvas,
the visualized object's numeric state printed next to its sliders, and
color-coded equations using each color for the same subexpression in every
line (no half-applied coloring in derivations).

## 3. Known cosmetic traps to grep for

- `grep -rn 'title="Deep dive' src/sections src/concepts` → agents sometimes
  include the prefix the component already adds; strip it.
- `grep -rhoE 'ConceptLink id="[^"]+"' src | sort -u` vs files in
  `src/concepts/` → should already be closed by the integration agent, but
  it is a 2-second re-check.

## 4. Verbatim sweep (copyright — mandatory, exhaustive)

Do NOT sample sentences — run an exhaustive sliding-window scan; it costs
the same and has twice caught leaks the per-section reviewers missed:

1. Extract all JSX prose from `src/sections/**` AND `src/concepts/**`
   (tooltip prose is where leaks hide — no reviewer covers it).
2. Normalize both sides (lowercase, collapse non-alphanumerics to spaces).
3. Slide an 8-word window (step 2–4 words) over the app prose; flag every
   window that occurs verbatim in the `pdftotext` extraction of the source
   pages.
4. Expect ZERO hits; rewrite any hit in fresh words, re-run tsc + the scan.

Frame sentences (equation lead-ins, list intros, figure captions) are the
usual culprits.

## 5. Report to the user

Include: sections built, tooltip/widget counts, chain-depth demo screenshot,
build size, open cosmetic issues, and the standing reminder that the app must
stay private (paraphrase adaptation of copyrighted material, internal
teaching use only).
