/**
 * Writes src/definitions/<id>.mdx: one copy of the BODY of every labelled
 * definition, theorem, lemma and corollary (families: PREVIEW_FAMILIES in
 * mdx/numbers.mjs; German directive aliases included). src/mdx/definitions-mdx.tsx
 * registers them as preview windows for `:d[term]{#id}` and for @references.
 *
 * Why copies instead of separate texts: the window must show EXACTLY the
 * wording of the text, maintained in one place only. Cloning the DOM node
 * #env-… at runtime would duplicate its ids and drop its React behaviour
 * (nested concept links); compiling a copy renders it like any concept body.
 *
 * remark-fmm treats files under src/definitions/ as preview copies: their
 * @references resolve as everywhere else (one app is one page), but their
 * equations emit no anchor ids, so the page never has an id twice. The
 * directory is generated and not committed.
 *
 * Deterministic and mtime-stable (written only on change); stale copies are
 * deleted. Runs before dev and build and inside the Vite plugin.
 *
 *   node scripts/gen-definitions.mjs [--check]   (--check: exit 1 if stale)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkMdx from "remark-mdx";
import { visit } from "unist-util-visit";
import { loadNumbers, hasPreview } from "../mdx/numbers.mjs";

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_REL = join("src", "definitions");

const processor = unified().use(remarkParse).use(remarkMath).use(remarkGfm).use(remarkDirective).use(remarkMdx);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Body (without the label paragraph) of the container directive `env.directive`
 * that starts on `env.line` and whose label begins with the env's id
 * ("4.6 (Name)" for a source number, "#slug (Name)" for a counted one);
 * otherwise null (stale table).
 */
function bodyAt(src, tree, id, env) {
  let hit = null;
  visit(tree, "containerDirective", (n) => {
    if (n.position?.start.line === env.line) {
      hit = n;
      return false;
    }
  });
  if (!hit || hit.name !== env.directive) return null;
  const label = hit.children.find((c) => c.data?.directiveLabel);
  const labelSrc = label ? src.slice(label.position.start.offset, label.position.end.offset) : "";
  // the label position includes the opening bracket: "[4.6 (Name)]"
  const head = env.fixed ? `${escapeRe(id)}(?![\\d.])` : `#${escapeRe(id)}(?![a-z0-9-])`;
  if (!new RegExp(`^\\[?${head}`).test(labelSrc)) return null;
  const kids = hit.children.filter((c) => !c.data?.directiveLabel);
  if (!kids.length) return "";
  return src.slice(kids[0].position.start.offset, kids.at(-1).position.end.offset);
}

/**
 * What does not work inside a window: headings (duplicate anchor ids),
 * relative image/link paths (the copy lives in another directory), nested
 * environments (duplicate env anchors), import/export.
 */
const UNCOPYABLE = [
  [/^\s*(import|export)\s/m, "import/export"],
  [/^#{1,6}\s/m, "a heading"],
  [/^\s*:{3,}[a-z]/m, "a nested block"],
  [/\]\(\.{0,2}\//, "a relative path"],
];

/**
 * Target content of the copies: Map relPath -> content, plus errors. With
 * `onlyFile` (relative path of a section file) only that file's environments:
 * parsing every section costs time, and after a text edit the dev server only
 * needs the copies of the saved file.
 */
export function buildDefinitions(root = DEFAULT_ROOT, onlyFile = null) {
  const table = loadNumbers(root);
  const files = new Map();
  const errors = [];
  const trees = new Map();
  for (const [id, env] of Object.entries(table.envs ?? {})) {
    if (!hasPreview(env) || (onlyFile && env.file !== onlyFile)) continue;
    if (!trees.has(env.file)) {
      const src = readFileSync(join(root, env.file), "utf8");
      trees.set(env.file, { src, tree: processor.parse(src) });
    }
    const { src, tree } = trees.get(env.file);
    const body = bodyAt(src, tree, id, env);
    if (body == null) {
      errors.push(`${env.file}:${env.line}: no environment “${id}” found — stale number table? npm run gen:numbers`);
      continue;
    }
    const bad = UNCOPYABLE.find(([re]) => re.test(body));
    if (bad) {
      errors.push(`${env.file}:${env.line}: environment “${id}” contains ${bad[1]} — cannot be copied into a preview window`);
      continue;
    }
    const meta = {
      id,
      kind: env.kind,
      num: env.num,
      name: env.name ?? null,
      section: env.section,
      anchor: env.anchor,
      source: `${env.file}:${env.line}`,
    };
    files.set(join(OUT_REL, `${id}.mdx`), `export const meta = ${JSON.stringify(meta)};\n\n${body.trim()}\n`);
  }
  return { files, errors };
}

/**
 * Write the copies. Returns { changed, written, removed, errors, count }.
 * With write=false it only compares.
 */
export function generateDefinitions(root = DEFAULT_ROOT, { write = true, onlyFile = null } = {}) {
  const { files, errors } = buildDefinitions(root, onlyFile);
  const outDir = join(root, OUT_REL);
  const written = [];
  const removed = [];
  if (errors.length) return { changed: false, written, removed, errors, count: files.size };
  for (const [rel, content] of files) {
    const abs = join(root, rel);
    if (existsSync(abs) && readFileSync(abs, "utf8") === content) continue;
    written.push(rel);
    if (write) {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, content);
    }
  }
  // clean up only on a full run: a partial run does not know every target file
  const present = onlyFile || !existsSync(outDir) ? [] : readdirSync(outDir).filter((n) => n.endsWith(".mdx"));
  for (const name of present) {
    const rel = join(OUT_REL, name);
    if (files.has(rel)) continue;
    removed.push(rel);
    if (write) rmSync(join(root, rel));
  }
  return { changed: written.length + removed.length > 0, written, removed, errors, count: files.size };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const check = process.argv.includes("--check");
  const r = generateDefinitions(DEFAULT_ROOT, { write: !check });
  for (const e of r.errors) console.error(`gen-definitions: ERROR ${e}`);
  if (r.errors.length) process.exit(1);
  console.log(
    `gen-definitions: ${r.count} preview copies -> ${OUT_REL}` +
      (r.changed ? ` (${r.written.length} written, ${r.removed.length} removed)` : " (unchanged)")
  );
  if (check && r.changed) {
    console.error("gen-definitions --check: the copies are out of date — run npm run gen:definitions");
    process.exit(1);
  }
}
