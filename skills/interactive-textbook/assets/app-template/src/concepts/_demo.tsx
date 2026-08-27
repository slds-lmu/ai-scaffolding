/**
 * Reference implementation for concept tooltip modules — used as the build
 * smoke test and as the canonical pattern for tooltip workers.
 *
 * Insight: the parabola a·x² flips when a changes sign.
 * Colours: the single series uses the palette default (blue).
 * Verified numbers: none quoted.
 */
import { useState } from "react";
import { ConceptLink, M, MD, Plot, registerConcept, Slider, fmtEn } from "../lib";

function DemoWidget() {
  const [a, setA] = useState(1);
  return (
    <div className="mt-2">
      <Slider label="a" value={a} onChange={setA} min={-2} max={2} step={0.1} fmt={fmtEn} />
      {/* the SVG Plot reads the --w-* surface variables, so it needs no
          colour props to look right inside the dark tooltip panel */}
      <Plot
        series={[{ f: (x) => a * x * x, label: "a·x²" }]}
        xDomain={[-2, 2]}
        yDomain={[-2, 2]}
        width={280}
        height={180}
        xLabel="x"
        yLabel="f(x)"
        readout
        ariaLabel="Graph of the parabola a times x squared"
      />
    </div>
  );
}

registerConcept({
  id: "_demo",
  title: "Demo concept",
  body: (
    <>
      <p>
        An example tooltip with math such as <M>{"f(x) = a x^2"}</M> and a link to a{" "}
        <ConceptLink id="_demo">circular concept</ConceptLink> (rendered greyed-out).
      </p>
      <MD>{"\\int_0^1 x^2 \\, dx = \\tfrac{1}{3}"}</MD>
      <DemoWidget />
    </>
  ),
});
