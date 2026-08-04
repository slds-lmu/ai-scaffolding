/**
 * Reference implementation for concept tooltip modules — used as the build
 * smoke test and as the canonical pattern for tooltip workers.
 */
import { useState } from "react";
import { ConceptLink, M, MD, Plot, registerConcept, Slider } from "../lib";

function DemoWidget() {
  const [a, setA] = useState(1);
  return (
    <div className="mt-2 rounded bg-slate-700/60 p-2">
      <Slider label="a" value={a} onChange={setA} min={-2} max={2} />
      <Plot
        series={[{ f: (x) => a * x * x }]}
        xDomain={[-2, 2]}
        yDomain={[-2, 2]}
        width={280}
        height={180}
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
