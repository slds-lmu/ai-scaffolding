# Widget building blocks (`src/lib/widgets/`) — quick guide

Everything is imported from `src/lib`: `import { Verdikt, useDrag } from "../../lib";`
Component names are German (the lib is shared byte-for-byte with the FMM-Skript);
`src/lib/index.ts` adds English aliases: `Verdict`, `Task`, `GuessFirst`,
`GuessFirstChoice`, `NumericQuestion`, `Question`, `Interactive`. Default UI
labels are English; pass `labels={…}` (or the `*LabelsProvider`s) to localise.
Typed examples to copy from: `__examples__.tsx` (imported nowhere).

## The three mandatory parts of every widget

```tsx
<Task>Drag x onto the antidiagonal.</Task>            {/* ONE line */}
<svg viewBox={…} className="max-w-full h-auto" {...drag.svgProps}> … </svg>
<Verdict kind="fail">Here (12.3) fails: f is not convex.</Verdict>
```

No further prose inside the widget: motivation goes in the paragraph before,
the resolution in the paragraph after (spoiler split). `kind`: `neutral | ok |
warn | fail`; each kind carries a symbol (→ ✓ ! ✗), never colour alone.

## Dragging (`useDrag`, `DragHandle`)

```tsx
const drag = useDrag<"a" | "b">({
  feld: { x0: PAD_L, y0: 0, w: SIZE, h: SIZE },     // SVG user coordinates
  welt: { x0: -3, x1: 3, y0: -2, y1: 2 },           // data window, y grows UP
  clamp: ([x, y], id) => [clamp(x, -3, 3), clamp(y, -2, 2)],
  snap: 0.05,                                       // only if the lesson is discrete
  greifPosition: (id) => (id === "a" ? a : b),      // no jump under the cursor
  onDrag: (p, id) => (id === "a" ? setA(p) : setB(p)),
});
<DragHandle x={px(a[0])} y={py(a[1])} farbe={FMM_COLORS.blau}
            aktiv={drag.dragging === "a"} {...drag.handleProps("a")} />
```

`svgProps` always goes on the `<svg>` (pointer move/up/leave/cancel,
touch-action). If the whole area is the handle (click places a point), add
`{...drag.surfaceProps("p")}` to the `<svg>` as well. Custom mapping instead
of `feld/welt`: `toWorld: (cx, cy, svg) => …` or `svgWorldMapper(svg, feld, welt)`.

**Dual-path rule (hard):** every draggable object also needs a `<Slider>` or a
number field on the same state. No drag-only widgets.

## Steps (`Stepper`) and transitions (`useAnimatedValue`)

`<Stepper step={k} setStep={setK} max={6} playable narration={…} />` — slider,
◀ ▶ ⏮, optional ⏵/⏸ (never auto-starts, stops at the end). The caller owns
the state and derives everything deterministically from `k` (`useMemo`).
`useAnimatedValue(target, 250)` / `useAnimatedMatrix(M)` only for DISCRETE
jumps (preset changes); no rAF runs while idle.

## Guess first, then reveal (`GuessFirst` = `Schaetzfrage`)

```tsx
<GuessFirst frage="At which γ does it diverge?" loesung={2} toleranz={0.2}
            einheit="γ" fmt={fmtEn} verdeckt={<Marker />}>
  <MyWidget />
</GuessFirst>
```

Variants `zahl` (default, number field) · `auswahl` (`optionen={[{id,text},…]}`)
· `bereich` (slider) · `klick`. For `klick` the `children` are a function
receiving `{ phase, aufgeloest, guess, setGuess }`. `verdeckt` appears only
after revealing; `auswertung(guess, loesung)` replaces the default verdict.

## Surfaces: light, dark, tooltip panel

SVG internals draw with the CSS variables `--w-bg`, `--w-grid`,
`--w-grid-strong`, `--w-axis`, `--w-text`, `--w-muted`, `--w-border`
(`src/index.css`; the tooltip panel carries `.w-dark` and swaps them).
DOM controls use the class chains from `surface.ts` (`W_PANEL`, `W_TEXT`,
`W_MUTED`, `W_BUTTON`, `W_BUTTON_AKTIV`, `W_INPUT`) — they cover light,
`dark:` and `.w-dark`. No fixed pixel widths, no hex colours outside
`FMM_COLORS`. Randomness only via `useSeed`/`mulberry32`; numbers only via
`fmtEn`/`fmtDe`/`fmtInt`/`fmtTick` (`makeFmt(locale)` builds either).

## Surfaces in space (`Surface3D`, `ViewControls`)

Rule: the 2D contour panel remains the primary, fully readable figure; the 3D
surface sits **next to it** and shows the same point, arrow, curve. All numbers
stay in the 2D panel's verdict; the 3D panel claims nothing of its own.

```tsx
const [view, setView] = useState<Sicht3D>({ azimuth: 38, elevation: 26 });
const surface = useMemo(() => ({ f, nx: 28, ny: 28, color: FMM_COLORS.blau,
                                 opacity: 0.85, wire: true }), [f]);
<Surface3D size={280} xDomain={[-2.4, 2.4]} yDomain={[-2.4, 2.4]} zDomain={[zLo, zHi]}
  surface={surface} contours={levels} contourColor={FMM_COLORS.blau}
  points={pts} arrows={arrows} dropLines labels={{ x: "x₁", y: "x₂", z: "f" }}
  azimuth={view.azimuth} elevation={view.elevation} onViewChange={setView}
  ariaLabel={`… in the current state ${shape}.`} />
<ViewControls value={view} onChange={setView} />
```

Overlays in WORLD coordinates, all depth-sorted: `points` (`{p, color, r,
label, onTop}`), `arrows` (`{from, to, color, label, onTop}`), `curves`
(`{pts, color, dash, width, onTop}`), `planes` (`{p0, u, v, su, sv, color,
opacity}`), `dropLines`. Three traps: (1) `onTop: true` for anything lying on
the floor — an opaque surface hides it from every viewpoint; (2) memoise
`surface`/`points`/`arrows`, or the grid is recomputed on every render;
(3) set `zDomain` yourself when overlays sit on the floor (`z = zDomain[0]`).
Dragging in the figure rotates the camera (dual path: `<ViewControls>`). Grid
at most 40 × 40, no animation loop.
