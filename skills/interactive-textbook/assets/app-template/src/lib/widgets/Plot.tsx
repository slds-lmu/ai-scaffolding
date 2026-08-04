import { useEffect, useRef } from "react";

export interface Series {
  f: (x: number) => number;
  color?: string;
  dash?: number[];
  label?: string;
}

/** Minimal function plot on canvas (for tooltips / expanded readings). */
export function Plot({
  series,
  xDomain = [-3, 3],
  yDomain = [-3, 3],
  width = 320,
  height = 240,
  markers = [],
}: {
  series: Series[];
  xDomain?: [number, number];
  yDomain?: [number, number];
  width?: number;
  height?: number;
  markers?: { x: number; y: number; color?: string; label?: string }[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [x0, x1] = xDomain;
    const [y0, y1] = yDomain;
    const toPx = (x: number, y: number): [number, number] => [
      ((x - x0) / (x1 - x0)) * width,
      height - ((y - y0) / (y1 - y0)) * height,
    ];
    ctx.clearRect(0, 0, width, height);

    // axes
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;
    if (y0 < 0 && y1 > 0) {
      ctx.beginPath();
      ctx.moveTo(...toPx(x0, 0));
      ctx.lineTo(...toPx(x1, 0));
      ctx.stroke();
    }
    if (x0 < 0 && x1 > 0) {
      ctx.beginPath();
      ctx.moveTo(...toPx(0, y0));
      ctx.lineTo(...toPx(0, y1));
      ctx.stroke();
    }

    for (const { f, color = "#0284c7", dash = [] } of series) {
      ctx.strokeStyle = color;
      ctx.setLineDash(dash);
      ctx.lineWidth = 2;
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= 400; i++) {
        const x = x0 + ((x1 - x0) * i) / 400;
        const y = f(x);
        if (!Number.isFinite(y) || y < y0 - (y1 - y0) || y > y1 + (y1 - y0)) {
          pen = false;
          continue;
        }
        const [px, py] = toPx(x, y);
        pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        pen = true;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const { x, y, color = "#dc2626", label } of markers) {
      const [px, py] = toPx(x, y);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, 2 * Math.PI);
      ctx.fill();
      if (label) {
        ctx.font = "12px sans-serif";
        ctx.fillText(label, px + 7, py - 5);
      }
    }
  }, [series, xDomain, yDomain, width, height, markers]);

  return (
    <canvas
      ref={ref}
      style={{ width, height }}
      className="rounded border border-slate-300 bg-white dark:border-slate-600"
    />
  );
}
