#!/usr/bin/env node
/**
 * Verifies the numbers quoted in src/sections/widgets/_demo-widget.tsx and
 * src/sections/_demo.mdx: for A = diag(s, 1) the largest singular value is
 * max(|s|, 1), and the default state s = 1.5, x = (1, 1) gives
 * ‖Ax‖₂ = √(1.5² + 1²) = √3.25 ≈ 1.803 ≤ σ_max · ‖x‖₂ = 1.5 · √2 ≈ 2.121.
 * Recomputed here independently of the library (plain JS, no imports).
 */
import assert from "node:assert/strict";

function sigmaMax([[a, b], [c, d]]) {
  const T = a * a + b * b + c * c + d * d;
  const det = a * d - b * c;
  return Math.sqrt((T + Math.sqrt(Math.max(0, T * T - 4 * det * det))) / 2);
}
const norm = ([x, y]) => Math.hypot(x, y);

for (const s of [-2, -0.5, 0, 0.3, 1, 1.5, 2]) {
  assert.ok(Math.abs(sigmaMax([[s, 0], [0, 1]]) - Math.max(Math.abs(s), 1)) < 1e-12, `sigmaMax(diag(${s},1))`);
}
const s = 1.5, x = [1, 1];
const Ax = [s * x[0], x[1]];
assert.ok(Math.abs(norm(Ax) - Math.sqrt(3.25)) < 1e-12);
assert.equal(norm(Ax).toFixed(3), "1.803");
assert.ok(norm(Ax) <= sigmaMax([[s, 0], [0, 1]]) * norm(x));
assert.equal((sigmaMax([[s, 0], [0, 1]]) * norm(x)).toFixed(3), "2.121");
// the widget's "fails" verdict: s = 0 makes A singular (det = 0)
const det = ([[a, b], [c, d]]) => a * d - b * c;
assert.equal(det([[0, 0], [0, 1]]), 0);
assert.notEqual(det([[0.3, 0], [0, 1]]), 0);
console.log("demo-scaling: numbers verified");
