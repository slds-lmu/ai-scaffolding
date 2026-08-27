/**
 * Shared SVG function plot.
 *
 * Insight: Curves become useful teaching figures only with a readable scale,
 * a legend, and optional values at the inspected position.
 * Colors: series use the FMM palette (blue first); neutral SVG parts use the
 * widget theme variables, so the same plot works in the dark tooltip panel.
 * Provenance: replaces the former local canvas Plot; its 400 samples and
 * NaN/out-of-window pen-up rule are retained. Numerical verdict values: none
 * (therefore none need a scratchpad verification; 2026-08-19).
 */
import { useId, useMemo, useState, type PointerEvent } from "react";
import { FMM_COLORS, fmtDe, fmtTick, labelPlacement, niceTicks } from "./util";

export interface Series {
  /** Function to sample at 400 equally spaced x-values. */
  f: (x: number) => number;
  /** Stroke colour; defaults cycle through the FMM palette. */
  color?: string;
  /** SVG dash lengths in design pixels. */
  dash?: number[];
  /** Legend and readout label. */
  label?: string;
  /** Fill to y=0, or to this explicit baseline, at low opacity. */
  fill?: boolean | { to: number };
}

export interface PlotPoint {
  x: number;
  y: number;
  color?: string;
  r?: number;
  label?: string;
}

export interface PlotLine {
  at: number;
  color?: string;
  dash?: number[];
  label?: string;
}

export interface PlotPolyline {
  pts: [number, number][];
  color?: string;
  dash?: number[];
  label?: string;
}

export interface PlotProps {
  series: Series[];
  xDomain?: [number, number];
  yDomain?: [number, number];
  /** SVG design width; CSS scales down from this cap. */
  width?: number;
  /** SVG design height; CSS keeps this aspect ratio. */
  height?: number;
  /** Backwards-compatible point markers. */
  markers?: PlotPoint[];
  /** Alias for markers, with optional point radius. */
  points?: PlotPoint[];
  /** Precomputed paths, for example iteration histories. */
  polylines?: PlotPolyline[];
  /** Horizontal reference lines. */
  hlines?: PlotLine[];
  /** Vertical reference lines. */
  vlines?: PlotLine[];
  /** Draw x and y values under the pointer or tap. */
  readout?: boolean;
  /** Axis labels, drawn inside the SVG reserved margin. */
  xLabel?: string;
  yLabel?: string;
  /** Accessible German description of this graphic. */
  ariaLabel?: string;
}

const PALETTE = [FMM_COLORS.blau, FMM_COLORS.gruen, FMM_COLORS.rot, FMM_COLORS.orange, FMM_COLORS.violett];
const SAMPLE_COUNT = 400;

function dashArray(dash?: number[]) {
  return dash?.length ? dash.join(" ") : undefined;
}

function pathForSegments(
  samples: [number, number][],
  toPx: (x: number, y: number) => [number, number],
): string {
  return samples.map(([x, y], i) => {
    const [px, py] = toPx(x, y);
    return `${i === 0 ? "M" : "L"}${px.toFixed(2)},${py.toFixed(2)}`;
  }).join(" ");
}

/** Responsive SVG plot with axes, ticks, legend, optional readout, and fills. */
export function Plot({
  series,
  xDomain = [-3, 3],
  yDomain = [-3, 3],
  width = 320,
  height = 240,
  markers = [],
  points = [],
  polylines = [],
  hlines = [],
  vlines = [],
  readout = false,
  xLabel,
  yLabel,
  ariaLabel = "Funktionsgraph",
}: PlotProps) {
  const clipId = useId().replace(/:/g, "");
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const validDomain = x1 > x0 && y1 > y0;
  const xTicks = validDomain ? niceTicks(x0, x1) : [];
  const yTicks = validDomain ? niceTicks(y0, y1) : [];
  const xStep = xTicks.length > 1 ? xTicks[1] - xTicks[0] : undefined;
  const yStep = yTicks.length > 1 ? yTicks[1] - yTicks[0] : undefined;
  // Reserve room for the actual tick labels: the last x label is centred on the
  // right edge, the y labels are right-aligned against `left`. Too small a
  // margin silently CLIPS them (SVG clips to its viewBox).
  const labelPx = (t: string) => t.length * 6.2;
  const lastX = xTicks.length ? fmtTick(xTicks[xTicks.length - 1], xStep) : "";
  const widestY = yTicks.reduce((w, t) => Math.max(w, labelPx(fmtTick(t, yStep))), 0);
  // Die gedrehte y-Achsenbeschriftung braucht links neben den Tick-Texten
  // eigenen Platz; sonst überlappt sie lange deutsche Dezimalzahlen.
  const left = Math.max(34, Math.ceil(widestY) + 8 + (yLabel ? 14 : 0));
  const right = Math.max(8, Math.ceil(labelPx(lastX) / 2) + 3);
  const top = 10;
  const legendItems = [
    ...series.flatMap((s, index) => s.label ? [{ label: s.label, color: s.color ?? PALETTE[index % PALETTE.length], dash: s.dash }] : []),
    ...polylines.flatMap((line, index) => line.label ? [{ label: line.label, color: line.color ?? PALETTE[(series.length + index) % PALETTE.length], dash: line.dash }] : []),
    ...hlines.flatMap((line) => line.label ? [{ label: line.label, color: line.color ?? FMM_COLORS.grau, dash: line.dash }] : []),
    ...vlines.flatMap((line) => line.label ? [{ label: line.label, color: line.color ?? FMM_COLORS.grau, dash: line.dash }] : []),
  ];
  const estimatedLegendWidth = Math.max(0, ...legendItems.map((item) => 22 + item.label.length * 6));
  const legendBelow = legendItems.length > 2 || estimatedLegendWidth > (safeWidth - left - right) * 0.52;
  const legendExtra = legendBelow ? legendItems.length * 13 + 3 : 0;
  const bottom = (xLabel ? 28 : 18) + (legendBelow ? legendExtra + 10 : 0);
  const plotRight = Math.max(left + 1, safeWidth - right);
  const plotBottom = Math.max(top + 1, safeHeight - bottom);
  const plotWidth = plotRight - left;
  const plotHeight = plotBottom - top;
  const toPx = (x: number, y: number): [number, number] => [
    left + ((x - x0) / (x1 - x0)) * plotWidth,
    plotBottom - ((y - y0) / (y1 - y0)) * plotHeight,
  ];

  const curveSegments = useMemo(() => series.map((s) => {
    const segments: [number, number][][] = [];
    let segment: [number, number][] = [];
    const yPadding = y1 - y0;
    for (let i = 0; i <= SAMPLE_COUNT; i += 1) {
      const x = x0 + ((x1 - x0) * i) / SAMPLE_COUNT;
      const y = s.f(x);
      if (!Number.isFinite(y) || y < y0 - yPadding || y > y1 + yPadding) {
        if (segment.length) segments.push(segment);
        segment = [];
      } else {
        segment.push([x, y]);
      }
    }
    if (segment.length) segments.push(segment);
    return segments;
  // `f` functions are intentionally sampled on every parent update, as in the canvas predecessor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [series, x0, x1, y0, y1]);

  const allPoints = [...markers, ...points];
  const readoutRows = hoverX === null ? [] : series.map((s, i) => ({
    label: s.label ?? `f${i + 1}`,
    color: s.color ?? PALETTE[i % PALETTE.length],
    value: s.f(hoverX),
  }));
  const readoutHeight = 16 + (readoutRows.length + 1) * 13;
  const readoutAtRight = !legendBelow && legendItems.length > 0;
  const readoutX = readoutAtRight ? left + 4 : plotRight - 104;
  const readoutY = top + 4;

  const setPointerReadout = (event: PointerEvent<SVGSVGElement>) => {
    if (!readout || !validDomain) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * safeWidth;
    const x = x0 + ((svgX - left) / plotWidth) * (x1 - x0);
    setHoverX(Math.max(x0, Math.min(x1, x)));
  };

  return (
    <svg
      viewBox={`0 0 ${safeWidth} ${safeHeight}`}
      width={safeWidth}
      height={safeHeight}
      className="max-w-full h-auto rounded border border-slate-300 dark:border-slate-600 [.w-dark_&]:border-slate-600"
      role="img"
      aria-label={ariaLabel}
      onPointerMove={setPointerReadout}
      onPointerDown={setPointerReadout}
      onPointerLeave={() => readout && setHoverX(null)}
      onPointerCancel={() => readout && setHoverX(null)}
    >
      <rect width={safeWidth} height={safeHeight} fill="var(--w-bg)" />
      {validDomain && <>
        <defs>
          <clipPath id={clipId}>
            <rect x={left} y={top} width={plotWidth} height={plotHeight} />
          </clipPath>
        </defs>
        <g aria-hidden="true">
          {xTicks.filter((t) => t !== 0).map((t) => {
            const [x] = toPx(t, y0);
            return <line key={`x-grid-${t}`} x1={x} x2={x} y1={top} y2={plotBottom} stroke="var(--w-grid)" strokeWidth="1" />;
          })}
          {yTicks.filter((t) => t !== 0).map((t) => {
            const [, y] = toPx(x0, t);
            return <line key={`y-grid-${t}`} x1={left} x2={plotRight} y1={y} y2={y} stroke="var(--w-grid)" strokeWidth="1" />;
          })}
          <rect x={left} y={top} width={plotWidth} height={plotHeight} fill="none" stroke="var(--w-axis)" strokeWidth="1" />
          {y0 <= 0 && y1 >= 0 && (() => {
            const [, y] = toPx(x0, 0);
            return <line x1={left} x2={plotRight} y1={y} y2={y} stroke="var(--w-axis)" strokeWidth="1.5" />;
          })()}
          {x0 <= 0 && x1 >= 0 && (() => {
            const [x] = toPx(0, y0);
            return <line x1={x} x2={x} y1={top} y2={plotBottom} stroke="var(--w-axis)" strokeWidth="1.5" />;
          })()}
        </g>
        {legendItems.length > 0 && <g aria-hidden="true" fontSize="10" fontFamily="ui-sans-serif, sans-serif">
          {!legendBelow && <rect x={plotRight - estimatedLegendWidth - 8} y={top + 1} width={estimatedLegendWidth + 7} height={legendItems.length * 13 + 3} fill="var(--w-bg)" fillOpacity={0.88} rx={2} />}
          {legendItems.map((item, i) => {
            const y = legendBelow ? plotBottom + 24 + i * 13 : top + 10 + i * 13;
            const x = legendBelow ? left + 4 : plotRight - estimatedLegendWidth - 4;
            return <g key={`legend-${i}`}><line x1={x} x2={x + 15} y1={y - 3} y2={y - 3} stroke={item.color} strokeWidth="2" strokeDasharray={dashArray(item.dash)} /><text x={x + 19} y={y} fill="var(--w-text)">{item.label}</text></g>;
          })}
        </g>}
        <g clipPath={`url(#${clipId})`} aria-hidden="true">
          {hlines.map((line, i) => {
            const [, y] = toPx(x0, line.at);
            return <line key={`h-${i}`} x1={left} x2={plotRight} y1={y} y2={y} stroke={line.color ?? FMM_COLORS.grau} strokeWidth="1.25" strokeDasharray={dashArray(line.dash)} />;
          })}
          {vlines.map((line, i) => {
            const [x] = toPx(line.at, y0);
            return <line key={`v-${i}`} x1={x} x2={x} y1={top} y2={plotBottom} stroke={line.color ?? FMM_COLORS.grau} strokeWidth="1.25" strokeDasharray={dashArray(line.dash)} />;
          })}
          {curveSegments.map((segments, i) => {
            const s = series[i];
            const color = s.color ?? PALETTE[i % PALETTE.length];
            if (!s.fill) return null;
            const baseline = typeof s.fill === "object" ? s.fill.to : 0;
            return segments.map((segment, j) => {
              if (!segment.length) return null;
              const first = segment[0];
              const last = segment[segment.length - 1];
              const [firstX, baseY] = toPx(first[0], baseline);
              const [lastX] = toPx(last[0], baseline);
              return <path key={`fill-${i}-${j}`} d={`${pathForSegments(segment, toPx)} L${lastX.toFixed(2)},${baseY.toFixed(2)} L${firstX.toFixed(2)},${baseY.toFixed(2)} Z`} fill={color} fillOpacity="0.15" />;
            });
          })}
          {curveSegments.map((segments, i) => {
            const s = series[i];
            return segments.map((segment, j) => <path key={`curve-${i}-${j}`} d={pathForSegments(segment, toPx)} fill="none" stroke={s.color ?? PALETTE[i % PALETTE.length]} strokeWidth="2" strokeDasharray={dashArray(s.dash)} />);
          })}
          {polylines.map((line, i) => <path key={`poly-${i}`} d={pathForSegments(line.pts, toPx)} fill="none" stroke={line.color ?? PALETTE[(series.length + i) % PALETTE.length]} strokeWidth="2" strokeDasharray={dashArray(line.dash)} />)}
          {allPoints.map((point, i) => {
            const [x, y] = toPx(point.x, point.y);
            const label = labelPlacement(x, (left + plotRight) / 2, (point.r ?? 4) + 3);
            return <g key={`point-${i}`}><circle cx={x} cy={y} r={point.r ?? 4} fill={point.color ?? FMM_COLORS.rot} />{point.label && <text x={label.x} y={y - 5} textAnchor={label.textAnchor} fill="var(--w-text)" fontSize="11">{point.label}</text>}</g>;
          })}
          {hoverX !== null && (() => {
            const [x] = toPx(hoverX, y0);
            return <line x1={x} x2={x} y1={top} y2={plotBottom} stroke="var(--w-text)" strokeWidth="1" strokeDasharray="3 3" />;
          })()}
        </g>
        <g fill="var(--w-text)" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, monospace" aria-hidden="true">
          {xTicks.map((t) => { const [x] = toPx(t, y0); return <text key={`xt-${t}`} x={x} y={plotBottom + 12} textAnchor="middle">{fmtTick(t, xStep)}</text>; })}
          {yTicks.map((t) => { const [, y] = toPx(x0, t); return <text key={`yt-${t}`} x={left - 4} y={y + 3} textAnchor="end">{fmtTick(t, yStep)}</text>; })}
          {xLabel && <text x={(left + plotRight) / 2} y={safeHeight - 3} textAnchor="middle" fontFamily="ui-sans-serif, sans-serif">{xLabel}</text>}
          {yLabel && (() => {
            const x = Math.max(10, left - widestY - 12);
            const y = (top + plotBottom) / 2;
            return <text x={x} y={y} textAnchor="middle" fontFamily="ui-sans-serif, sans-serif" transform={`rotate(-90 ${x} ${y})`}>{yLabel}</text>;
          })()}
        </g>
        {hoverX !== null && <g aria-hidden="true">
          <rect x={readoutX} y={readoutY} width="100" height={readoutHeight} rx="2" fill="var(--w-bg)" stroke="var(--w-axis)" fillOpacity="0.94" />
          <text x={readoutX + 5} y={readoutY + 12} fill="var(--w-text)" fontSize="10" fontFamily="ui-monospace, SFMono-Regular, monospace">x = {fmtDe(hoverX)}</text>
          {readoutRows.map((row, i) => <text key={`readout-${i}`} x={readoutX + 5} y={readoutY + 25 + i * 13} fill={row.color} fontSize="10" fontFamily="ui-monospace, SFMono-Regular, monospace">{row.label}: {fmtDe(row.value)}</text>)}
        </g>}
      </>}
    </svg>
  );
}
