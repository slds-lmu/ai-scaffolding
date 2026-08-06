import { useState } from "react";
import { LabeledTransformCanvas, Slider, sigmaMax } from "../../lib";

export function DemoScalingWidget() {
  const [scale, setScale] = useState(1.5);
  const matrix: [[number, number], [number, number]] = [
    [scale, 0],
    [0, 1],
  ];
  const worldHalf = Math.max(2.4, 1.25 * sigmaMax(matrix));

  return (
    <div className="my-3 rounded-lg border border-amber-300 bg-white/80 p-3 dark:border-amber-700 dark:bg-slate-900/60">
      <Slider
        label="horizontal scale"
        value={scale}
        onChange={setScale}
        min={-2}
        max={2}
        step={0.1}
      />
      <p className="my-2 text-sm">
        Current matrix: <code>[[{scale.toFixed(1)}, 0], [0, 1]]</code>
      </p>
      <LabeledTransformCanvas
        matrix={matrix}
        vectors={[{ v: [scale, 1], color: "#dc2626", label: "A(1,1)" }]}
        xLabel="x₁"
        yLabel="x₂"
        size={260}
        worldHalf={worldHalf}
      />
    </div>
  );
}
