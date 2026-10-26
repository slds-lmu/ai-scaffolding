# Widget building blocks (`src/lib/widgets/`) — quick guide

Everything is imported from `src/lib`: `import { Verdikt, useDrag } from "../../lib";`
Component names are German (the lib originated in FMM-Skript; copies may differ);
`src/lib/index.ts` adds English aliases: `Verdict`, `Task`, `GuessFirst`,
`GuessFirstChoice`, `NumericQuestion`, `Question`, `Interactive`. Default UI
labels are English; pass `labels={…}` (or the `*LabelsProvider`s) to localise.
Typed examples to copy from: `__examples__.tsx` (imported nowhere).

## Optional task and feedback helpers

```tsx
<Task>Drag x onto the antidiagonal.</Task>            {/* ONE line */}
<svg viewBox={…} className="max-w-full h-auto" {...drag.svgProps}> … </svg>
<Verdict kind="fail">This pair violates the convexity inequality.</Verdict>
```

Use these helpers when the task and changing result need explanation. A static
annotation or invariant statement may suffice; avoid repeating the same prose.
For an optional prediction, keep its resolution behind reveal. `kind`: `neutral | ok |
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

Provide keyboard access and a non-drag pointer alternative for each drag.
A native input, click-to-position, or increment buttons may provide the needed
paths on the same state; keyboard access alone is not a pointer alternative.

## Steps (`Stepper`) and transitions (`useAnimatedValue`)

`<Stepper step={k} setStep={setK} max={6} playable narration={…} />` — slider,
◀ ▶ ⏮, optional ⏵/⏸ (never auto-starts, stops at the end). The caller owns
the state and derives everything deterministically from `k` (`useMemo`).
`useAnimatedValue(target, 250)` / `useAnimatedMatrix(M)` only for DISCRETE
jumps (preset changes); no rAF runs while idle.

## Guess first, then reveal (`GuessFirst` = `Schaetzfrage`)

```tsx
<GuessFirst frage="What is the mean of 1 and 3?" loesung={2} toleranz={0.01} fmt={fmtEn} verdeckt={<Marker />}>
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

Use 3D when depth matters to the lesson. A 2D contour view is often easier to
read precisely; combine the views only when their correspondence helps.
Do not add a second panel merely to satisfy this example.

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
