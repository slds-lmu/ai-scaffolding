#!/usr/bin/env node
/**
 * Verifies the numbers quoted in src/sections/widgets/_demo-widget.tsx and
 * src/sections/_demo.mdx: for A = diag(s, 1) the largest singular value is
 * max(|s|, 1), and the default state s = 1.5, x = (1, 1) gives
 * ‖Ax‖₂ = √(1.5² + 1²) = √3.25 ≈ 1.803 ≤ σ_max · ‖x‖₂ = 1.5 · √2 ≈ 2.121.
 *
 * `sigmaMax` is imported from the same plain-TypeScript module the widget
 * uses, so this exercises the production calculation against independent
 * analytic values (a second formula written here would only test itself).
 * Importable calculations must live in a `.ts` module without JSX: Node's
 * type stripping handles `.ts`, not `.tsx`.
 */
import assert from "node:assert/strict";
import { sigmaMax } from "../../src/lib/widgets/util.ts";

const norm = ([x, y]) => Math.hypot(x, y);

// analytic: diag(s, 1) has singular values |s| and 1
for (const s of [-2, -0.5, 0, 0.3, 1, 1.5, 2]) {
  assert.ok(Math.abs(sigmaMax([[s, 0], [0, 1]]) - Math.max(Math.abs(s), 1)) < 1e-12, `sigmaMax(diag(${s},1))`);
}
// analytic: a rotation has σ_max = 1; a shear [[1, t], [0, 1]] has σ_max = (t + √(t² + 4)) / 2
const c = Math.cos(0.7), sn = Math.sin(0.7);
assert.ok(Math.abs(sigmaMax([[c, -sn], [sn, c]]) - 1) < 1e-12, "rotation");
assert.ok(Math.abs(sigmaMax([[1, 3], [0, 1]]) - (3 + Math.sqrt(13)) / 2) < 1e-12, "shear");

// the widget's default state and the numbers the section text quotes
const s = 1.5, x = [1, 1];
const Ax = [s * x[0], x[1]];
assert.ok(Math.abs(norm(Ax) - Math.sqrt(3.25)) < 1e-12);
assert.equal(norm(Ax).toFixed(3), "1.803");
assert.ok(norm(Ax) <= sigmaMax([[s, 0], [0, 1]]) * norm(x));
assert.equal((sigmaMax([[s, 0], [0, 1]]) * norm(x)).toFixed(3), "2.121");
// the widget's "fails" verdict: s = 0 makes A singular (det = 0)
const det = ([[a, b], [c2, d]]) => a * d - b * c2;
assert.equal(det([[0, 0], [0, 1]]), 0);
assert.notEqual(det([[0.3, 0], [0, 1]]), 0);
console.log("demo-scaling: numbers verified against the widget's sigmaMax");
