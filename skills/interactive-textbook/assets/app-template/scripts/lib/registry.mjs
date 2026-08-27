/**
 * Section registry — the ONE place that reads section metadata off disk.
 * gen-numbers, lint-numbers and the inventory snapshot all go through here.
 *
 * Unlike a chaptered script, this app registers sections by globbing
 * `src/sections/S*.mdx` (see src/sections/index.ts), and every section MDX
 * carries its own metadata:
 *
 *   export const id    = "4.6";              // the SOURCE's section number
 *   export const title = "Scaling maps";
 *   export const key   = "scaling-maps";     // optional, stable alias
 *
 * `id` is the number printed in the heading and used for the anchor
 * `#sec-4.6`; it comes from the source, so it never shifts and needs no
 * counter. `key` is optional sugar: it adds a second anchor `#sec-<key>`
 * and lets `@sec:<key>` survive a renumbering of the adaptation.
 *
 * Every `*.mdx` directly inside src/sections is numbered, not only the
 * `S*.mdx` the app renders — the shipped `_demo.mdx` is compiled by
 * `npm run typecheck:mdx` too and would otherwise fail on unknown ids.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SECTIONS_REL = join("src", "sections");

const constant = (src, name) => {
  const m = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(src);
  return m ? JSON.parse(`"${m[1]}"`) : null;
};

/**
 * Sections in render order (numeric by id):
 *   { id, key, title, file }   — `file` is the basename, e.g. "S46.mdx".
 */
export function readSections(root) {
  const dir = join(root, SECTIONS_REL);
  const files = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".mdx") && !e.name.includes(".mdx-check."))
    .map((e) => e.name);
  const sections = [];
  for (const file of files.sort()) {
    const src = readFileSync(join(dir, file), "utf8");
    const id = constant(src, "id");
    const title = constant(src, "title");
    if (!id || !title)
      throw new Error(
        `${SECTIONS_REL}/${file}: needs \`export const id = "…"\` and \`export const title = "…"\` ` +
          `(copy the shape from src/sections/_demo.mdx)`
      );
    sections.push({ id, key: constant(src, "key"), title, file });
  }
  if (!sections.length) throw new Error(`no section MDX found in ${SECTIONS_REL}`);
  sections.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const seen = new Map();
  for (const s of sections) {
    if (seen.has(s.id))
      throw new Error(`${SECTIONS_REL}: section id “${s.id}” is used twice (${seen.get(s.id)}, ${s.file})`);
    seen.set(s.id, s.file);
    if (s.key == null) continue;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(s.key) || /^\d+$/.test(s.key))
      throw new Error(`${SECTIONS_REL}/${s.file}: section key “${s.key}” — use a-z, 0-9, - (not purely numeric)`);
    if (seen.has(s.key))
      throw new Error(`${SECTIONS_REL}: section key “${s.key}” collides with ${seen.get(s.key)}`);
    seen.set(s.key, s.file);
  }
  return sections;
}
