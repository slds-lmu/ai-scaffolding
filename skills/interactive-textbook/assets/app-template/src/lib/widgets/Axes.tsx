/**
 * Labeled-axes wrappers around the shared lib canvases (lib itself is frozen).
 *
 * LabeledPlot / LabeledTransformCanvas render the lib <Plot>/<TransformCanvas>
 * unchanged and add numeric tick labels + axis names in a reserved margin
 * around the canvas, so nothing is ever drawn on top of the data area and
 * labels cannot be cut off.
 *
 * Also exports small numeric helpers used by widgets to auto-scale the
 * world window so arrows / curve images always fit inside the canvas.
 */
import type { ReactNode } from "react";
import { Plot, type Series } from "./Plot";
import { TransformCanvas, type Vec2 } from "./TransformCanvas";

/** "Nice" tick positions covering [a, b]. */
export function niceTicks(a: number, b: number, target = 5): number[] {
  if (!(b > a)) return [];
  const raw = (b - a) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = mag * (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10);
  const ticks: number[] = [];
  for (let t = Math.ceil(a / step) * step; t <= b + step * 1e-6; t += step) {
    ticks.push(Math.abs(t) < step * 1e-6 ? 0 : t);
  }
  return ticks;
}

function fmtTick(t: number): string {
  const a = Math.abs(t);
  if (a >= 100 || Number.isInteger(t)) return String(Math.round(t));
  return a >= 10 ? t.toFixed(0) : a >= 1 ? t.toFixed(1).replace(/\.0$/, "") : t.toFixed(2).replace(/0$/, "");
}

/** Largest singular value of a 2x2 matrix (how far the unit circle is stretched). */
export function sigmaMax(m: [[number, number], [number, number]]): number {
  const [[a, b], [c, d]] = m;
  const T = a * a + b * b + c * c + d * d;
  const det = a * d - b * c;
  return Math.sqrt((T + Math.sqrt(Math.max(0, T * T - 4 * det * det))) / 2);
}

/** Largest |coordinate| over a list of 2-vectors. */
export function maxAbsCoord(...vs: [number, number][]): number {
  let m = 0;
  for (const [x, y] of vs) m = Math.max(m, Math.abs(x), Math.abs(y));
  return m;
}

const PAD_L = 34; // room for y tick labels
const PAD_B = 16; // room for x tick labels

/**
 * Margin frame: y ticks left of the canvas, x ticks below it, axis names
 * above-left and below-center. `tickClass` lets dark tooltip panels pass a
 * lighter text color.
 */
function LabeledFrame({
  width,
  height,
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  tickClass = "text-slate-500 dark:text-slate-400",
  children,
}: {
  width: number;
  height: number;
  xDomain: [number, number];
  yDomain: [number, number];
  xLabel: string;
  yLabel: string;
  tickClass?: string;
  children: ReactNode;
}) {
  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;
  const xt = niceTicks(x0, x1);
  const yt = niceTicks(y0, y1);
  return (
    <div className={`inline-block shrink-0 select-none text-[10px] ${tickClass}`}>
      <div className="mb-0.5 text-[11px]" style={{ paddingLeft: PAD_L }}>
        {yLabel} ↑
      </div>
      <div className="flex">
        <div className="relative shrink-0" style={{ width: PAD_L, height }}>
          {yt.map((t) => (
            <span
              key={t}
              className="absolute right-1 -translate-y-1/2 font-mono leading-none"
              style={{ top: ((y1 - t) / (y1 - y0)) * height }}
            >
              {fmtTick(t)}
            </span>
          ))}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
      <div className="flex">
        <div style={{ width: PAD_L }} className="shrink-0" />
        <div className="relative shrink-0" style={{ width, height: PAD_B }}>
          {xt.map((t) => (
            <span
              key={t}
              className="absolute top-0.5 -translate-x-1/2 font-mono leading-none"
              style={{ left: ((t - x0) / (x1 - x0)) * width }}
            >
              {fmtTick(t)}
            </span>
          ))}
        </div>
      </div>
      <div className="text-center text-[11px]" style={{ paddingLeft: PAD_L }}>
        {xLabel} →
      </div>
    </div>
  );
}

/** lib <Plot> with labeled, tick-marked axes in a reserved margin. */
export function LabeledPlot({
  xLabel,
  yLabel,
  tickClass,
  series,
  xDomain = [-3, 3],
  yDomain = [-3, 3],
  width = 320,
  height = 240,
  markers = [],
}: {
  xLabel: string;
  yLabel: string;
  tickClass?: string;
  series: Series[];
  xDomain?: [number, number];
  yDomain?: [number, number];
  width?: number;
  height?: number;
  markers?: { x: number; y: number; color?: string; label?: string }[];
}) {
  return (
    <LabeledFrame
      width={width}
      height={height}
      xDomain={xDomain}
      yDomain={yDomain}
      xLabel={xLabel}
      yLabel={yLabel}
      tickClass={tickClass}
    >
      <Plot
        series={series}
        xDomain={xDomain}
        yDomain={yDomain}
        width={width}
        height={height}
        markers={markers}
      />
    </LabeledFrame>
  );
}

/** lib <TransformCanvas> with labeled, tick-marked axes in a reserved margin. */
export function LabeledTransformCanvas({
  xLabel = "x₁",
  yLabel = "x₂",
  tickClass,
  matrix,
  vectors,
  showGrid,
  showUnitCircle,
  size = 340,
  worldHalf = 3.2,
}: {
  xLabel?: string;
  yLabel?: string;
  tickClass?: string;
  matrix: [[number, number], [number, number]];
  vectors?: Vec2[];
  showGrid?: boolean;
  showUnitCircle?: boolean;
  size?: number;
  worldHalf?: number;
}) {
  return (
    <LabeledFrame
      width={size}
      height={size}
      xDomain={[-worldHalf, worldHalf]}
      yDomain={[-worldHalf, worldHalf]}
      xLabel={xLabel}
      yLabel={yLabel}
      tickClass={tickClass}
    >
      <TransformCanvas
        matrix={matrix}
        vectors={vectors}
        showGrid={showGrid}
        showUnitCircle={showUnitCircle}
        size={size}
        worldHalf={worldHalf}
      />
    </LabeledFrame>
  );
}
