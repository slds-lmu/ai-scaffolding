/**
 * Writes src/sections/numbers.generated.json (+ .ts): the number table of
 * every environment, equation, numbered sub-heading and section in the app.
 *
 * Numbering convention
 *   - A section's number is its own `export const id` (the number printed in
 *     the SOURCE). Nothing re-derives it, so the source's numbering is
 *     preserved exactly.
 *   - Objects labelled with a source number (`:::theorem[4.6 …]`,
 *     `$$ {#eq-5.107}`, `### 4.6.1 …`) claim that number verbatim.
 *   - Objects labelled with a slug (`:::theorem[#kkt …]`, `$$ {#eq-two-step}`,
 *     `### … :id[why]`) are counted: one counter per file for environments,
 *     a second for equations, a third for numbered sub-headings, each
 *     assigning "<section-id>.<n>" in document order and skipping numbers a
 *     source-numbered object already claimed. Deep dives count too.
 *
 * Deterministic and mtime-stable: the files are only rewritten when their
 * content changes, so Vite does not reload for nothing. Runs before dev and
 * build (package.json) and inside the Vite plugin on every MDX change.
 *
 *   node scripts/gen-numbers.mjs [--check]   (--check: verify only, exit 1 if stale)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkMdx from "remark-mdx";
import { visit } from "unist-util-visit";
import { readSections } from "./lib/registry.mjs";
import {
  ENV_KIND,
  parseEnvLabel,
  parseEqMeta,
  takeHeadingId,
  isSlug,
  formatEnvLabel,
} from "../mdx/numbers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(here, "..");

const processor = unified()
  .use(remarkParse)
  .use(remarkMath)
  .use(remarkGfm)
  .use(remarkDirective)
  .use(remarkMdx);

function plain(node) {
  if (!node) return "";
  if (node.type === "text" || node.type === "inlineCode") return node.value;
  if (node.type === "inlineMath") return "";
  return (node.children ?? []).map(plain).join("");
}

/** read a directive's label paragraph without mutating the tree */
function labelOf(node) {
  const first = node.children?.[0];
  if (!first?.data?.directiveLabel) return node.attributes?.label ?? null;
  return plain(first).trim();
}

/**
 * Every numberable object of one file, in document order.
 * Returns [{ ns: "envs"|"eqs"|"subs", fixed, id|num, …, line }]
 */
export function scanFile(src, relPath) {
  const tree = processor.parse(src);
  const items = [];
  const errors = [];
  const err = (node, msg) => errors.push(`${relPath}:${node?.position?.start?.line ?? "?"}: ${msg}`);

  visit(tree, (node) => {
    const line = node.position?.start?.line ?? 0;
    if (node.type === "containerDirective" && ENV_KIND[node.name]) {
      const raw = labelOf(node);
      if (raw == null) return; // remark-fmm reports the missing label
      const p = parseEnvLabel(raw);
      const base = { ns: "envs", kind: ENV_KIND[node.name], directive: node.name, line };
      if (p.form === "source") items.push({ ...base, fixed: true, num: p.num, name: p.name });
      else if (p.form === "id") {
        if (!isSlug(p.id))
          err(node, `environment id “${p.id}” — use a-z, 0-9, - (a slug), or a number from the source`);
        else items.push({ ...base, fixed: false, id: p.id, name: p.name });
      }
      // "unnumbered" / "free": nothing to register
      return;
    }
    if (node.type === "math") {
      const p = parseEqMeta(node.meta);
      if (!p) return;
      if (p.error) return; // remark-fmm reports it
      items.push(
        p.fixed ? { ns: "eqs", fixed: true, num: p.id, line } : { ns: "eqs", fixed: false, id: p.id, line }
      );
      return;
    }
    if (node.type === "heading") {
      // work on a copy so takeHeadingId does not prune the real tree here
      const copy = { ...node, children: [...(node.children ?? [])] };
      const h = takeHeadingId(copy, plain);
      if (h.error) return err(node, h.error);
      if (h.fixed)
        items.push({
          ns: "subs",
          fixed: true,
          num: h.fixed,
          title: plain(node).trim().replace(/^\d+(?:\.\d+)*\s*/, ""),
          depth: node.depth,
          line,
        });
      else if (h.id)
        items.push({ ns: "subs", fixed: false, id: h.id, title: plain(copy).trim(), depth: node.depth, line });
    }
  });
  return { items, errors };
}

/** per namespace: source numbers claim theirs, slugs fill the gaps in order. */
export function assignNumbers(items, secNum, relPath, errors, warnings) {
  const out = [];
  for (const ns of ["envs", "eqs", "subs"]) {
    const mine = items.filter((it) => it.ns === ns);
    const taken = new Set();
    let last = null;
    for (const it of mine) {
      if (!it.fixed) continue;
      if (taken.has(it.num)) errors.push(`${relPath}:${it.line}: number ${it.num} is used twice in this file`);
      taken.add(it.num);
      // books number per chapter, not per section, so only the ORDER is checked
      if (last && cmpNum(it.num, last) <= 0)
        warnings.push(`${relPath}:${it.line}: source number ${it.num} does not increase (after ${last})`);
      last = it.num;
    }
    let n = 1;
    for (const it of mine) {
      if (it.fixed) {
        out.push(it);
        continue;
      }
      while (taken.has(`${secNum}.${n}`)) n++;
      out.push({ ...it, num: `${secNum}.${n}` });
      n++;
    }
  }
  return out;
}

function cmpNum(a, b) {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

export function buildTable(root = DEFAULT_ROOT) {
  const errors = [];
  const warnings = [];
  const table = { version: 1, sections: {}, envs: {}, eqs: {}, subs: {} };
  const sections = readSections(root);

  for (const s of sections) {
    const relPath = `src/sections/${s.file}`;
    const entry = { num: s.id, key: s.key, title: s.title, anchor: `sec-${s.id}`, file: relPath };
    table.sections[s.id] = entry;
    // the optional key is a second name for the SAME section
    if (s.key) table.sections[s.key] = { ...entry, anchor: `sec-${s.key}` };
    const abs = join(root, relPath);
    if (!existsSync(abs)) {
      errors.push(`${relPath}: file missing`);
      continue;
    }
    const { items, errors: fileErrors } = scanFile(readFileSync(abs, "utf8"), relPath);
    errors.push(...fileErrors);
    for (const it of assignNumbers(items, s.id, relPath, errors, warnings)) {
      const id = it.fixed ? it.num : it.id;
      const common = { num: it.num, section: s.id, file: relPath, line: it.line, fixed: it.fixed };
      const bag = table[it.ns];
      if (bag[id]) {
        errors.push(
          `${relPath}:${it.line}: id “${id}” (${it.ns}) is already taken in ${bag[id].file}:${bag[id].line}`
        );
        continue;
      }
      if (it.ns === "envs")
        bag[id] = {
          ...common,
          kind: it.kind,
          directive: it.directive,
          name: it.name,
          label: formatEnvLabel(it.num, it.name),
          anchor: `env-${id}`,
        };
      else if (it.ns === "eqs") bag[id] = { ...common, anchor: `eq-${id}` };
      else bag[id] = { ...common, title: it.title, depth: it.depth, anchor: `sec-${id}` };
    }
  }
  for (const id of Object.keys(table.subs))
    if (table.sections[id])
      errors.push(
        `${table.subs[id].file}:${table.subs[id].line}: sub-heading id “${id}” collides with a section id or key — @sec:${id} would be ambiguous`
      );
  for (const ns of ["envs", "eqs", "subs", "sections"]) table[ns] = sortKeys(table[ns]);
  return { table, errors, warnings };
}

/* ---- output: JSON + TS -------------------------------------------- */

function tsSource(table) {
  const entries = [];
  for (const [id, e] of Object.entries(table.envs)) entries.push([`${e.directive}:${id}`, e.num, `${e.kind} ${e.num}`]);
  for (const [id, e] of Object.entries(table.eqs)) entries.push([`eq:${id}`, e.num, `(${e.num})`]);
  for (const [id, e] of Object.entries(table.subs)) entries.push([`sec:${id}`, e.num, `Section ${e.num}`]);
  for (const [id, e] of Object.entries(table.sections)) entries.push([`sec:${id}`, e.num, `Section ${e.num}`]);
  const byKey = new Map(entries.map((e) => [e[0], e]));
  const rows = [...byKey.values()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const keyType = rows.length ? rows.map(([k]) => `  | ${JSON.stringify(k)}`).join("\n") : "  never";
  const body = rows
    .map(([k, n, t]) => `  ${JSON.stringify(k)}: [${JSON.stringify(n)}, ${JSON.stringify(t)}],`)
    .join("\n");
  return `/* GENERATED by scripts/gen-numbers.mjs — do not edit by hand.
 * Regenerate with: npm run gen:numbers (also runs before dev and build).
 *
 * Numbers for widget TSX. Never write "… from Theorem 4.6" as a string:
 *   import { num, ref } from "../numbers.generated";
 *   \`… from \${ref("theorem:4.6")}\`   -> "… from Theorem 4.6"
 *   num("eq:5.107")                    -> "5.107"
 * Keys are <directive>:<id> (theorem:, definition:, …), eq:<id>, sec:<id>.
 * An unknown key is a type error, not a silent typo.
 */
export type NumKey =
${keyType};

/** [number, reference text] per key. */
export const NUMBERS: Record<NumKey, readonly [string, string]> = {
${body}
};

/** just the number, e.g. num("theorem:4.6") -> "4.6". */
export function num(key: NumKey): string {
  return NUMBERS[key][0];
}

/** reference text including the kind, e.g. ref("eq:5.107") -> "(5.107)". */
export function ref(key: NumKey): string {
  return NUMBERS[key][1];
}
`;
}

function writeIfChanged(file, content) {
  const old = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (old === content) return false;
  writeFileSync(file, content);
  return true;
}

/**
 * Build and write the table. Returns { table, changed, errors, warnings }.
 * `changed` means the JSON changed in content — the Vite plugin uses it to
 * decide between plain HMR and a full reload.
 */
export function generateNumbers(root = DEFAULT_ROOT, { write = true } = {}) {
  const { table, errors, warnings } = buildTable(root);
  const json = JSON.stringify(table, null, 1) + "\n";
  const jsonFile = join(root, "src", "sections", "numbers.generated.json");
  const tsFile = join(root, "src", "sections", "numbers.generated.ts");
  let changed = false;
  if (write && !errors.length) {
    changed = writeIfChanged(jsonFile, json);
    writeIfChanged(tsFile, tsSource(table));
  } else if (!write) {
    changed = !existsSync(jsonFile) || readFileSync(jsonFile, "utf8") !== json;
  }
  return { table, changed, errors, warnings, json };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const check = process.argv.includes("--check");
  const { table, changed, errors, warnings } = generateNumbers(DEFAULT_ROOT, { write: !check });
  for (const w of warnings) console.warn(`gen-numbers: WARNING ${w}`);
  for (const e of errors) console.error(`gen-numbers: ERROR ${e}`);
  if (errors.length) process.exit(1);
  const count = (ns, fixed) => Object.values(table[ns]).filter((e) => e.fixed === fixed).length;
  const rel = relative(process.cwd(), join(DEFAULT_ROOT, "src", "sections", "numbers.generated.json"));
  console.log(
    `gen-numbers: ${new Set(Object.values(table.sections).map((s) => s.num)).size} sections, ` +
      `envs ${count("envs", true)} from source / ${count("envs", false)} counted, ` +
      `equations ${count("eqs", true)} / ${count("eqs", false)}, ` +
      `sub-headings ${count("subs", true)} / ${count("subs", false)} -> ${rel}${changed ? "" : " (unchanged)"}`
  );
  if (check && changed) {
    console.error("gen-numbers --check: the table is out of date — run npm run gen:numbers");
    process.exit(1);
  }
}
