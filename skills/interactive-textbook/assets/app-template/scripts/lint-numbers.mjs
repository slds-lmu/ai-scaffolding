#!/usr/bin/env node
/**
 * lint-numbers — finds numbers that were typed by hand, which no counter and
 * no link checker can see:
 *
 *   1. Widget TSX (src/sections/**\/*.tsx, src/concepts/**\/*.tsx):
 *      "Theorem 4.6", "(5.107)" inside RENDERED strings (string and template
 *      literals, JSX text). Comments are ignored. Such strings go stale
 *      silently; use ref()/num() from src/sections/numbers.generated instead.
 *   2. MDX prose: references without @ — "Theorem 4.6", "($4.12$)", "(5.107)",
 *      "[Section 4.3](#sec-4.3)". Label lines (`:::theorem[4.6 …]`), the
 *      `$$ {#eq-…}` fence and code fences are not references and are skipped.
 *
 * Exits 1 on a finding. `--warn` downgrades it to a warning (use it only when
 * adopting the linter in an app that already has hand-written numbers).
 *
 *   node scripts/lint-numbers.mjs [--warn] [--quiet]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as babelParse } from "@babel/parser";
import _traverse from "@babel/traverse";

const traverse = _traverse.default ?? _traverse;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const warnOnly = argv.includes("--warn");
const quiet = argv.includes("--quiet");

const KINDS =
  "Theorems?|Definitions?|Lemmas?|Lemmata|Corollar(?:y|ies)|Examples?|Remarks?|Algorithms?|" +
  "S(?:ä|ae)tze|Satz|Korollare?|Beispiele?|Bemerkungen?|Algorithmen";
const NUM = "\\d+\\.\\d+(?:\\.\\d+)*";
const TSX_RE = new RegExp(`\\b(?:${KINDS})\\s+${NUM}\\b|\\(${NUM}\\)`, "g");
const MDX_RES = [
  [new RegExp(`\\b(?:${KINDS})\\s+${NUM}\\b`, "g"), "environment reference"],
  [new RegExp(`\\(\\$${NUM}\\$\\)|\\(${NUM}\\)|Equation\\s+\\$?${NUM}\\$?`, "g"), "equation reference"],
  [/\[(?:Section|Chapter|Abschnitt|Kapitel)[^\]]*\]\((?:#sec-[^)]+)\)/g, "section link"],
];

function* walk(dir, ext) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p, ext);
    else if (e.isFile() && e.name.endsWith(ext) && !e.name.includes(".mdx-check.")) yield p;
  }
}

const findings = [];
const DIRS = [join(root, "src", "sections"), join(root, "src", "concepts")];

/* ---- 1. TSX: rendered strings only -------------------------------- */
for (const dir of DIRS)
  for (const file of walk(dir, ".tsx")) {
    const code = readFileSync(file, "utf8");
    let ast;
    try {
      ast = babelParse(code, { sourceType: "module", plugins: ["typescript", "jsx"], errorRecovery: true });
    } catch (e) {
      findings.push({ file, line: 0, kind: "TSX not parseable", text: String(e.message).split("\n")[0] });
      continue;
    }
    const check = (value, node) => {
      for (const m of String(value).matchAll(TSX_RE))
        findings.push({ file, line: node.loc?.start.line ?? 0, kind: "TSX string", text: m[0] });
    };
    traverse(ast, {
      StringLiteral: ({ node }) => check(node.value, node),
      TemplateElement: ({ node }) => check(node.value.cooked ?? node.value.raw, node),
      JSXText: ({ node }) => check(node.value, node),
    });
  }

/* ---- 2. MDX: references without @ --------------------------------- */
for (const dir of DIRS)
  for (const file of walk(dir, ".mdx")) {
    const lines = readFileSync(file, "utf8").split("\n");
    let inFence = false;
    lines.forEach((line, i) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      // skip: code fences, label lines (`:::theorem[4.6 …]`), MDX comments,
      // the `$$ {#eq-…}` fence and the `export const id = "4.6"` metadata
      if (
        inFence ||
        /^\s*:::+\s*[a-z]+\[/.test(line) ||
        /^\s*\{\/\*/.test(line) ||
        /^\s*\$\$\s*\{#eq-/.test(line) ||
        /^\s*export\s+const\s+(id|key|title)\s*=/.test(line)
      )
        return;
      for (const [re, kind] of MDX_RES)
        for (const m of line.matchAll(re)) findings.push({ file, line: i + 1, kind, text: m[0] });
    });
  }

/* ---- report ------------------------------------------------------- */
const byKind = new Map();
for (const f of findings) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);
const files = new Set(findings.map((f) => f.file));
if (!quiet)
  for (const f of findings.slice(0, warnOnly ? 15 : findings.length))
    console.log(`  ${relative(root, f.file)}:${f.line}  ${f.kind}: ${f.text}`);
if (findings.length) {
  const summary = [...byKind].map(([k, n]) => `${k} ${n}`).join(", ");
  console.log(
    `lint-numbers: ${findings.length} hand-written number(s) in ${files.size} file(s) — ${summary}. ` +
      `Label the target and reference it (@theorem:4.6, @eq:5.107, @sec:4.3); in TSX use ref()/num().`
  );
  if (!warnOnly) process.exit(1);
} else {
  console.log("lint-numbers: no hand-written numbers.");
}
