import { useEffect, useRef } from "react";

export interface Vec2 {
  v: [number, number];
  color?: string;
  label?: string;
}

/**
 * 2D linear-map visualizer: draws the image of the standard grid, the unit
 * circle, and optional vectors under the map x ↦ A x. The workhorse for
 * eigenvalue / determinant / SVD widgets.
 */
export function TransformCanvas({
  matrix,
  vectors = [],
  showGrid = true,
  showUnitCircle = true,
  size = 340,
  worldHalf = 3.2,
}: {
  matrix: [[number, number], [number, number]];
  vectors?: Vec2[];
  showGrid?: boolean;
  showUnitCircle?: boolean;
  size?: number;
  worldHalf?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = size / (2 * worldHalf); // world -> px scale
    const toPx = (x: number, y: number): [number, number] => [
      size / 2 + x * s,
      size / 2 - y * s,
    ];
    const [[a, b], [c, d]] = matrix;
    const map = (x: number, y: number): [number, number] => [a * x + b * y, c * x + d * y];

    ctx.clearRect(0, 0, size, size);

    const line = (
      p: [number, number],
      q: [number, number],
      color: string,
      width = 1
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(...toPx(...p));
      ctx.lineTo(...toPx(...q));
      ctx.stroke();
    };

    // original grid (faint)
    if (showGrid) {
      for (let k = -Math.ceil(worldHalf); k <= Math.ceil(worldHalf); k++) {
        line([k, -worldHalf], [k, worldHalf], "#e2e8f0");
        line([-worldHalf, k], [worldHalf, k], "#e2e8f0");
      }
      // transformed grid
      const ext = worldHalf * 2;
      for (let k = -Math.ceil(ext); k <= Math.ceil(ext); k++) {
        line(map(k, -ext), map(k, ext), "#bae6fd");
        line(map(-ext, k), map(ext, k), "#bae6fd");
      }
    }
    // axes
    line([-worldHalf, 0], [worldHalf, 0], "#94a3b8", 1.5);
    line([0, -worldHalf], [0, worldHalf], "#94a3b8", 1.5);

    // unit circle and its image
    if (showUnitCircle) {
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let t = 0; t <= 2 * Math.PI + 0.01; t += 0.02) {
        const [px, py] = toPx(Math.cos(t), Math.sin(t));
        t === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let t = 0; t <= 2 * Math.PI + 0.01; t += 0.02) {
        const [px, py] = toPx(...map(Math.cos(t), Math.sin(t)));
        t === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // vectors (drawn as arrows from origin)
    const arrow = (x: number, y: number, color: string, label?: string) => {
      const [px, py] = toPx(x, y);
      const [ox, oy] = toPx(0, 0);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(px, py);
      ctx.stroke();
      const ang = Math.atan2(py - oy, px - ox);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - 9 * Math.cos(ang - 0.4), py - 9 * Math.sin(ang - 0.4));
      ctx.lineTo(px - 9 * Math.cos(ang + 0.4), py - 9 * Math.sin(ang + 0.4));
      ctx.fill();
      if (label) {
        ctx.font = "12px sans-serif";
        ctx.fillText(label, px + 6, py - 4);
      }
    };
    for (const { v, color = "#dc2626", label } of vectors) arrow(v[0], v[1], color, label);
  }, [matrix, vectors, showGrid, showUnitCircle, size, worldHalf]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size }}
      className="rounded border border-slate-300 bg-white dark:border-slate-600"
    />
  );
}
