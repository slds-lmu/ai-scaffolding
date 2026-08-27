#!/usr/bin/env node
/**
 * Content oracle: inventoryFromMdx() (mdx/inventory.mjs) over ALL section
 * MDX, stored as JSON or compared against a stored run. This is the gate for
 * changes to the authoring toolchain (a remark upgrade, a plugin rewrite, a
 * migration onto @references): change the tools, and the fingerprints
 * `env <kind> <label>`, `eq(<tag>) …`, `h3#sec-… Title` plus the prose must
 * stay identical, except for differences you whitelist with --allow.
 *
 *   node scripts/verify/inventory-snapshot.mjs --write <file> [--root <app>]
 *   node scripts/verify/inventory-snapshot.mjs --compare <file> [--root <app>] [--allow <rule>…]
 *
 * --root points at the app whose TOOLCHAIN and SOURCES are used (e.g. a
 * `git worktree` of the pre-change commit, to record the reference). With no
 * arguments the script does nothing, so it is safe in a run-all script.
 *
 * --allow <rule>: hide expected differences.
 *   link-wrap   "prose Theorem 4.6" -> "link #env-4.6 “Theorem 4.6”"
 *               (what happens when prose moves onto @references)
 *   heading-id  h3#sec-4.6.1 -> h3#sec-<slug> at identical text
 *   eq-math     "($4.12$)" written as math -> the reference link "(4.12)"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : null;
};
const root = resolve(flag("--root") ?? process.cwd());
const writeTo = flag("--write");
const compareTo = flag("--compare");
const allow = new Set(argv.flatMap((a, i) => (a === "--allow" ? [argv[i + 1]] : [])));

if (!writeTo && !compareTo) {
  console.log("inventory-snapshot: nothing to do (--write <file> or --compare <file>)");
  process.exit(0);
}

const { inventoryFromMdx, inventoryKey } = await import(
  pathToFileURL(join(root, "mdx", "inventory.mjs")).href
);
// the reference tree may predate scripts/lib/registry.mjs — fall back to ours
const { readSections } = await import(pathToFileURL(join(root, "scripts", "lib", "registry.mjs")).href).catch(
  () => import(pathToFileURL(join(process.cwd(), "scripts", "lib", "registry.mjs")).href)
);

const snapshot = {};
for (const s of readSections(root)) {
  const rel = `src/sections/${s.file}`;
  const abs = join(root, rel);
  const inv = await inventoryFromMdx(readFileSync(abs, "utf8"), abs, root);
  snapshot[rel] = inv.map(inventoryKey);
}

if (writeTo) {
  writeFileSync(writeTo, JSON.stringify(snapshot, null, 1) + "\n");
  const n = Object.values(snapshot).reduce((a, b) => a + b.length, 0);
  console.log(`inventory-snapshot: ${Object.keys(snapshot).length} files, ${n} entries -> ${writeTo}`);
  process.exit(0);
}

const ref = JSON.parse(readFileSync(compareTo, "utf8"));

/**
 * Allowed changes are made invisible by NORMALISING both sides, not by
 * forgiving them pairwise: a prose run that got split would otherwise shift
 * every following index.
 *   link-wrap:  reference links (#env-/#eq-/#sec-) become text, and adjacent
 *               text pieces with the same parent path merge into ONE run —
 *               exactly what inventory.mjs produced from unlinked prose.
 *   heading-id: h3#sec-<anything> -> h3#sec-* at identical text.
 *   eq-math:    "($4.12$)" (text "(" + math + text ")") -> the link "(4.12)".
 */
// An entry is "<head>[ in <path>]"; the path starts with a component name
// and "(" — prose such as "as in Theorem 4.6" never contains that.
const WHERE_RE = / in [A-Z][A-Za-z]*\(/;
const LINK_RE = /^link #(?:env|eq|sec)-[^ ]+ \u201e([^]*)"$/;
function normalize(entries) {
  if (!allow.size) return entries;
  const out = [];
  let run = null; // { text, where }
  const flush = () => {
    if (!run) return;
    let text = run.text.replace(/\s+/g, " ").trim();
    // "($4.12$)" was math between "(" and ")"; the reference link is one text piece "(4.12)"
    if (allow.has("eq-math")) text = text.replace(/\( (\d+(?:\.\d+)+) \)/g, "($1)");
    out.push(`text ${text}${run.where}`);
    run = null;
  };
  for (let e of entries) {
    if (allow.has("heading-id")) e = e.replace(/^(h\d)#sec-[^ ]+ /, "$1#sec-* ");
    let text = null;
    let where = "";
    if (allow.has("link-wrap")) {
      const wi = e.search(WHERE_RE);
      const head = wi >= 0 ? e.slice(0, wi) : e;
      where = wi >= 0 ? e.slice(wi) : "";
      let m;
      if (head.startsWith("text ")) text = head.slice(5);
      else if ((m = LINK_RE.exec(head))) text = m[1];
      else if (allow.has("eq-math") && (m = /^math (\d+(?:\.\d+)+)$/.exec(head))) text = m[1];
    }
    if (text == null) {
      flush();
      out.push(e);
      continue;
    }
    if (run && run.where === where) run.text += " " + text;
    else {
      flush();
      run = { text, where };
    }
  }
  flush();
  return out;
}

let bad = 0;
const files = new Set([...Object.keys(ref), ...Object.keys(snapshot)]);
for (const f of [...files].sort()) {
  const a = ref[f] && normalize(ref[f]);
  const b = snapshot[f] && normalize(snapshot[f]);
  if (!a || !b) {
    console.log(`${f}: ${!a ? "new" : "missing"}`);
    bad++;
    continue;
  }
  const diffs = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ka = a[i] ?? "«missing»";
    const kb = b[i] ?? "«missing»";
    if (ka !== kb) diffs.push({ i, ka, kb });
  }
  if (diffs.length) {
    bad += diffs.length;
    console.log(`${f}: ${diffs.length} difference(s)`);
    for (const d of diffs.slice(0, 5))
      console.log(`   [${d.i}]\n     old: ${d.ka.slice(0, 160)}\n     new: ${d.kb.slice(0, 160)}`);
  }
}
if (bad) {
  console.error(`inventory-snapshot: ${bad} difference(s) against ${compareTo}`);
  process.exit(1);
}
console.log(`inventory-snapshot: identical to ${compareTo} (${files.size} files)`);
