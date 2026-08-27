/**
 * Finds macros that MathJax typesets SILENTLY as literal text: the bundled
 * MathJax runs with the `noundefined` behaviour, so an unknown `\foo` becomes
 * an <mtext>foo</mtext>, not a red merror — nothing in the build or the
 * browser console flags it, only a reader sees "foo" in the middle of a
 * formula. (Recipe generalised from the FMM-Skript's check-cbblue.mjs.)
 *
 * Reads the macro table from src/mathjax-setup.ts (`texMacros`, textual parse
 * of the `"name": "…"` / `"name": ["…", n]` entries), collects every `\name`
 * used in src/** (.tsx/.mdx; typecheck's .mdx-check.tsx temp files are
 * excluded because their \n escapes look like macros), and typesets each name
 * with 0, 1 and 2 dummy arguments. The SVG output has no text nodes, so the
 * fallback is detected by decoding the glyph codes (data-c) of the <mtext>
 * MathJax emits: an undefined macro leaves exactly "\name" there.
 * Exit code 1 if any macro falls back.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const require = createRequire(`${ROOT}/package.json`);
// comments stripped first: the doc comment shows example entries
const src = fs.readFileSync(`${ROOT}/src/mathjax-setup.ts`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const table = {};
for (const m of src.matchAll(/"([A-Za-z]+)":\s*\[\s*"((?:[^"\\]|\\.)*)"\s*(?:,\s*(\d+))?\s*\]/g))
  table[m[1]] = m[3] ? [JSON.parse(`"${m[2]}"`), Number(m[3])] : JSON.parse(`"${m[2]}"`);
for (const m of src.matchAll(/"([A-Za-z]+)":\s*"((?:[^"\\]|\\.)*)"/g))
  if (!(m[1] in table)) table[m[1]] = JSON.parse(`"${m[2]}"`);

const files = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (!entry.name.startsWith(".") && (entry.name.endsWith(".tsx") || entry.name.endsWith(".mdx"))) files.push(path);
  }
}
collect(join(ROOT, "src"));
const used = new Map();
for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  // .mdx has single backslashes, .tsx strings double ones — accept both
  const re = f.endsWith(".mdx") ? /\\([a-zA-Z]{2,})/g : /\\\\([a-zA-Z]{2,})/g;
  for (const m of t.matchAll(re)) {
    if (!used.has(m[1])) used.set(m[1], f.replace(ROOT + "/", ""));
  }
}
const MathJax = require("mathjax/es5/node-main.js");
const mj = await MathJax.init({
  loader: { load: ["input/tex-full", "output/svg"] },
  tex: { packages: { "[+]": ["ams", "color", "unicode"] }, macros: table },
});
function mtextStrings(svg) {
  return [...svg.matchAll(/<g data-mml-node="mtext"[\s\S]*?<\/g>/g)].map((m) =>
    [...m[0].matchAll(/data-c="([0-9A-F]+)"/g)].map((c) => String.fromCodePoint(parseInt(c[1], 16))).join(""));
}
const broken = [];
for (const [name, file] of [...used].sort()) {
  // argument-less probe first; macros with arguments get up to two dummies
  for (const probe of [`\\${name}`, `\\${name}{x}`, `\\${name}{x}{y}`]) {
    let svg;
    try { svg = mj.startup.adaptor.outerHTML(mj.tex2svg(probe, { display: false })); }
    catch { continue; }
    // only "\name" rendered as literal mtext proves the noundefined fallback
    const textFallback = mtextStrings(svg).some((t) => t.includes(`\\${name}`));
    if (!textFallback) { svg = null; break; }
    if (probe.endsWith("{y}")) broken.push({ name, file });
  }
}
console.log(`scan-macros: ${used.size} macro names checked (${Object.keys(table).length} project macros)`);
if (broken.length === 0) console.log("scan-macros: no macro falls back to literal text.");
else {
  console.log(`scan-macros: ${broken.length} macro(s) typeset SILENTLY as text:`);
  for (const k of broken) console.log(`  \\${k.name}   first used in ${k.file}`);
  process.exitCode = 1;
}
