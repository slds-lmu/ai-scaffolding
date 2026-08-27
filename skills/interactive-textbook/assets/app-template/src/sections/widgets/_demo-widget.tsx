/**
 * Demo widget: a horizontal scaling map A = diag(s, 1) acting on a draggable
 * vector x.
 *
 * Insight: A stretches only the first coordinate, so ‖Ax‖ ≤ σ_max(A)·‖x‖ with
 * σ_max = max(|s|, 1); at s = 0 the map collapses the plane onto the x₂-axis
 * and is no longer invertible.
 * Colours: blue = the input x, red = its image Ax (FMM_COLORS, one role each).
 * Verified numbers: s = 1.5, x = (1, 1) gives ‖Ax‖ = √3.25 ≈ 1.803 and the
 * bound σ_max·‖x‖ = 1.5·√2 ≈ 2.121 — scripts/verify/demo-scaling.mjs.
 *
 * Shows the mandatory shape of a widget: ONE task line (Task), the figure,
 * a state-dependent Verdict; and the dual-path rule: every draggable point
 * also has a Slider on the same state.
 */
import { useState } from "react";
import {
  DragHandle,
  FMM_COLORS,
  Slider,
  Task,
  Verdict,
  clamp,
  fmtEn,
  sigmaMax,
  useDrag,
} from "../../lib";

const SIZE = 260;
const FIELD = { x0: 0, y0: 0, w: SIZE, h: SIZE };
const WORLD = { x0: -3, x1: 3, y0: -3, y1: 3 };
const px = (x: number) => FIELD.x0 + ((x - WORLD.x0) / (WORLD.x1 - WORLD.x0)) * FIELD.w;
const py = (y: number) => FIELD.y0 + ((WORLD.y1 - y) / (WORLD.y1 - WORLD.y0)) * FIELD.h;

export function DemoScalingWidget() {
  const [scale, setScale] = useState(1.5);
  const [x, setX] = useState<[number, number]>([1, 1]);
  const matrix: [[number, number], [number, number]] = [
    [scale, 0],
    [0, 1],
  ];
  const ax: [number, number] = [scale * x[0], x[1]];
  const normX = Math.hypot(x[0], x[1]);
  const normAx = Math.hypot(ax[0], ax[1]);
  const sMax = sigmaMax(matrix);

  const drag = useDrag<"x">({
    feld: FIELD,
    welt: WORLD,
    clamp: ([a, b]) => [clamp(a, -2.5, 2.5), clamp(b, -2.5, 2.5)],
    snap: 0.1,
    greifPosition: () => x,
    onDrag: (p) => setX(p),
  });

  const kind = scale === 0 ? "fail" : Math.abs(scale) < 0.5 ? "warn" : "ok";

  return (
    <div className="my-3">
      <Task>Drag the blue point x (or use the sliders) and watch how A stretches it.</Task>
      <Slider label="scale s" value={scale} onChange={setScale} min={-2} max={2} step={0.1} fmt={fmtEn} marks={[-1, 0, 1]} />
      <Slider label="x₁" value={x[0]} onChange={(v) => setX([v, x[1]])} min={-2.5} max={2.5} step={0.1} fmt={fmtEn} accent={FMM_COLORS.blau} />
      <Slider label="x₂" value={x[1]} onChange={(v) => setX([x[0], v])} min={-2.5} max={2.5} step={0.1} fmt={fmtEn} accent={FMM_COLORS.blau} />
      {/* svgProps already sets style (touch-action), so the frame styling lives on the wrapper */}
      <div className="mx-auto my-2 w-full max-w-[260px] rounded border" style={{ background: "var(--w-bg)", borderColor: "var(--w-border)" }}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Input vector x = (${fmtEn(x[0], 1)}, ${fmtEn(x[1], 1)}), image Ax = (${fmtEn(ax[0], 2)}, ${fmtEn(ax[1], 2)})`}
        {...drag.svgProps}
      >
        {[-2, -1, 1, 2].map((t) => (
          <g key={t} stroke="var(--w-grid)">
            <line x1={px(t)} y1={0} x2={px(t)} y2={SIZE} />
            <line x1={0} y1={py(t)} x2={SIZE} y2={py(t)} />
          </g>
        ))}
        <line x1={px(0)} y1={0} x2={px(0)} y2={SIZE} stroke="var(--w-axis)" />
        <line x1={0} y1={py(0)} x2={SIZE} y2={py(0)} stroke="var(--w-axis)" />
        <line x1={px(0)} y1={py(0)} x2={px(ax[0])} y2={py(ax[1])} stroke={FMM_COLORS.rot} strokeWidth={2} strokeDasharray="4 3" />
        <circle cx={px(ax[0])} cy={py(ax[1])} r={4} fill={FMM_COLORS.rot} />
        <text x={px(ax[0]) + 8} y={py(ax[1]) + 14} fontSize={12} fill={FMM_COLORS.rot}>Ax</text>
        <line x1={px(0)} y1={py(0)} x2={px(x[0])} y2={py(x[1])} stroke={FMM_COLORS.blau} strokeWidth={2} />
        <DragHandle x={px(x[0])} y={py(x[1])} farbe={FMM_COLORS.blau} label="x" aktiv={drag.dragging === "x"} {...drag.handleProps("x")} />
      </svg>
      </div>
      <Verdict kind={kind} titel={kind === "fail" ? "Singular:" : kind === "warn" ? "Nearly singular:" : "Invertible:"}>
        ‖Ax‖ = {fmtEn(normAx, 3)} ≤ σ<sub>max</sub>·‖x‖ = {fmtEn(sMax, 2)} · {fmtEn(normX, 3)} = {fmtEn(sMax * normX, 3)}.
        {kind === "fail" && " Every x lands on the x₂-axis, so x cannot be recovered from Ax."}
      </Verdict>
    </div>
  );
}
