/**
 * Number table and reference syntax — the shared core of automatic
 * numbering. Three consumers must all see the same table:
 *
 *   scripts/gen-numbers.mjs   counts and writes src/sections/numbers.generated.json
 *   mdx/remark-fmm.mjs        resolves labels and @refs at compile time
 *   scripts/lint-numbers.mjs  flags numbers that were typed by hand instead
 *
 * WHY THIS EXISTS. An adapted chapter is full of numbers — "Theorem 4.6",
 * "(4.12)", "Section 4.3" — and every one of them typed into prose is a
 * number nothing checks. The fmm-skript project started without a counter
 * and had to migrate ~3300 reference sites afterwards. Do not repeat that.
 * The rule for authors is short: NEVER write a number. Label the target,
 * reference the label.
 *
 * TWO SOURCES OF NUMBERS, ONE REFERENCE SYNTAX
 *
 * 1. SOURCE-NUMBERED (the normal case when adapting a book). The number is
 *    the one printed in the source and must be preserved exactly, so the
 *    author writes it as the label's id — nothing is re-derived:
 *
 *      :::theorem[4.6 (Scaling map)]     -> "Theorem 4.6",  anchor env-4.6
 *      $$ {#eq-5.107}                    -> "(5.107)",      anchor eq-5.107
 *      ### 4.6.1 Sub-heading             ->                 anchor sec-4.6.1
 *      export const id = "4.6"           -> Section 4.6,    anchor sec-4.6
 *
 *    These are referenced by their number: `@theorem:4.6`, `@eq:5.107`,
 *    `@sec:4.6`. The number in the prose is then produced from the table,
 *    and a reference to something that does not exist fails the build.
 *
 * 2. AUTO-NUMBERED (material the adaptation adds itself: an extra example,
 *    an equation the source left unnumbered but a widget refers to). The
 *    author gives a slug and the counter assigns "<section>.<n>" in
 *    document order, skipping numbers already claimed by source-numbered
 *    objects in the same file:
 *
 *      :::example[#scaling-twice]        -> "Example 4.6.1"
 *      $$ {#eq-two-step}                 -> "(4.6.2)"
 *      ### Title :id[why-it-works]       -> "4.6.3 Title"
 *
 *    Referenced by slug: `@example:scaling-twice`, `@eq:two-step`.
 *
 * Both forms may be mixed inside one file, and neither ever puts a number
 * into prose or into a widget's TSX (widgets use num()/ref() from
 * src/sections/numbers.generated).
 *
 * REFERENCES (only inside prose text nodes; not in code, math or links)
 *
 *   @definition:x @theorem:x @lemma:x @corollary:x @example:x @remark:x
 *   @algorithm:x            (German aliases @satz: @korollar: … also work)
 *   @eq:4.12       -> "(4.12)"          @sec:4.3   -> "Section 4.3"
 *   @num:4.6       -> "4.6" only        @ref:4.6   -> kind chosen from the table
 *   \@theorem:4.6  -> literal, no reference
 *
 * There is no @chapter: — one app is one chapter. Cross-app links are
 * ordinary Markdown links.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/* ------------------------------------------------------------------ */
/* Environment kinds                                                   */
/* ------------------------------------------------------------------ */

/** directive name -> printed kind (identical to ENV in remark-fmm). */
export const ENV_KIND = {
  definition: "Definition",
  theorem: "Theorem",
  lemma: "Lemma",
  corollary: "Corollary",
  example: "Example",
  remark: "Remark",
  algorithm: "Algorithm",
  satz: "Satz",
  korollar: "Korollar",
  beispiel: "Beispiel",
  bemerkung: "Bemerkung",
  algorithmus: "Algorithmus",
};

/** kind -> family, so `@theorem:` may point at a `:::satz` but not at a definition. */
const FAMILY = {
  Definition: "definition",
  Theorem: "theorem",
  Satz: "theorem",
  Lemma: "lemma",
  Corollary: "corollary",
  Korollar: "corollary",
  Example: "example",
  Beispiel: "example",
  Remark: "remark",
  Bemerkung: "remark",
  Algorithm: "algorithm",
  Algorithmus: "algorithm",
};
export const envFamily = (kind) => FAMILY[kind] ?? kind;

/* ------------------------------------------------------------------ */
/* Label forms                                                         */
/* ------------------------------------------------------------------ */

/** slug id: lower case, digits, hyphens; never purely numeric */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
/** a number taken from the source, e.g. 4.12 or 5.107 or 4.6.1 */
export const SRC_NUM_RE = /^\d+(?:\.\d+)+$/;

export function isSlug(id) {
  return SLUG_RE.test(id) && !/^\d+$/.test(id);
}
/** every id that may appear in a label or a reference */
export function isValidId(id) {
  return isSlug(id) || SRC_NUM_RE.test(id);
}

/**
 * Split an environment label.
 *   "4.6 (Name)" / "4.6"   -> { form: "source", num, name }
 *   "#slug (Name)" / "#slug" -> { form: "id", id, name }
 *   "(Name)"               -> { form: "unnumbered", name }
 *   anything else          -> { form: "free", text }
 */
export function parseEnvLabel(text) {
  const t = String(text ?? "").trim();
  let m;
  if ((m = /^(\d+(?:\.\d+)+)\s*(?:\((.+)\))?$/.exec(t)))
    return { form: "source", num: m[1], name: m[2]?.trim() ?? null };
  if ((m = /^#(\S+)\s*(?:\((.+)\))?$/.exec(t)))
    return { form: "id", id: m[1], name: m[2]?.trim() ?? null };
  if ((m = /^\((.+)\)$/.exec(t))) return { form: "unnumbered", name: m[1].trim() };
  return { form: "free", text: t };
}

/** printed label: "4.6 (Name)" or "4.6". */
export function formatEnvLabel(num, name) {
  return name ? `${num} (${name})` : num;
}

/** `{#eq-…}` after `$$` -> { id, fixed } | null (no meta) | { error }. */
export function parseEqMeta(meta) {
  const t = String(meta ?? "").trim();
  if (!t) return null;
  const m = /^\{#eq-([^}\s]+)\}$/.exec(t);
  if (!m)
    return {
      error: `cannot read the token after $$: “${t}”. Exactly one {#eq-<id>} is allowed, e.g. $$ {#eq-5.107} (a number from the source) or $$ {#eq-two-step} (a slug)`,
    };
  const id = m[1];
  if (SRC_NUM_RE.test(id)) return { id, fixed: true };
  if (!isSlug(id))
    return { error: `equation id “${id}” — use a-z, 0-9, - (a slug), or a number from the source such as 5.107` };
  return { id, fixed: false };
}

/**
 * Inspect a heading (mdast node, BEFORE it is rewritten):
 *   "### 4.6.1 Title"       -> { fixed: "4.6.1" }
 *   "### Title :id[slug]"   -> { id: "slug" }  (the directive is REMOVED from the children)
 *   otherwise               -> {}
 * `plain` renders a node's text (the caller supplies its own version).
 */
export function takeHeadingId(node, plain) {
  const kids = node.children ?? [];
  const idx = kids.findIndex((c) => c.type === "textDirective" && c.name === "id");
  if (idx >= 0) {
    const d = kids[idx];
    const id = plain(d).trim();
    if (d.attributes && Object.keys(d.attributes).length)
      return { error: `:id[…] in a heading takes no attributes` };
    if (!isSlug(id)) return { error: `heading id “${id}” — use a-z, 0-9, - (not purely numeric)` };
    if (idx !== kids.length - 1) return { error: `:id[${id}] must come LAST in the heading` };
    node.children = kids.slice(0, idx);
    const last = node.children[node.children.length - 1];
    if (last?.type === "text") last.value = last.value.replace(/\s+$/, "");
    const text = plain(node).trim();
    if (/^\d+(?:\.\d+)*\b/.test(text))
      return { error: `heading “${text}” carries a number AND :id[${id}] — use one or the other` };
    return { id, position: d.position };
  }
  const text = plain(node).trim();
  const m = /^(\d+(?:\.\d+)*)\b/.exec(text);
  return m ? { fixed: m[1] } : {};
}

/* ------------------------------------------------------------------ */
/* Loading the table                                                   */
/* ------------------------------------------------------------------ */

export const TABLE_REL = path.join("src", "sections", "numbers.generated.json");

export const EMPTY_TABLE = Object.freeze({
  version: 1,
  sections: {},
  envs: {},
  eqs: {},
  subs: {},
});

const cache = new Map(); // absPath -> { mtimeMs, size, table }

/**
 * Read the table synchronously from <root>/src/sections/numbers.generated.json,
 * cached by mtime, so a running dev server picks up a regenerated table. If
 * the file is missing (fixtures with a made-up root), the table is empty and
 * every labelled object reports "not in the number table".
 */
export function loadNumbers(root) {
  const file = path.resolve(root ?? process.cwd(), TABLE_REL);
  if (!existsSync(file)) return EMPTY_TABLE;
  const st = statSync(file);
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.table;
  const table = JSON.parse(readFileSync(file, "utf8"));
  cache.set(file, { mtimeMs: st.mtimeMs, size: st.size, table });
  return table;
}

/* ------------------------------------------------------------------ */
/* @references                                                         */
/* ------------------------------------------------------------------ */

const REF_TYPES = [...Object.keys(ENV_KIND), "eq", "sec", "num", "ref"];
/** id part: a slug OR a source number such as 4.12 */
const REF_ID = "(?:\\d+(?:\\.\\d+)+|[a-z0-9][a-z0-9-]*)";
/** one reference token; the leading `\\?` catches the \@ escape */
export const REF_RE = new RegExp(`(\\\\?)@(${REF_TYPES.join("|")}):(${REF_ID})`, "g");

/**
 * remark-directive reads the ":kkt" of "@theorem:kkt" as a text directive.
 * A reference therefore has to be reassembled BEFORE any directive check:
 * text "…@theorem" + directive ":kkt" (+ following text) become ONE text
 * node "…@theorem:kkt…". The position is widened to the whole range so the
 * raw-source comparison (which detects the \@ escape) still lines up.
 * Returns a list of errors [{ node, message }].
 */
export function mergeRefDirectives(tree, visit) {
  const errors = [];
  const tail = new RegExp(`(\\\\?)@(${REF_TYPES.join("|")})$`);
  visit(tree, (node, index, parent) => {
    if (node.type !== "textDirective" || !parent || index == null) return;
    const prev = parent.children[index - 1];
    if (!prev || prev.type !== "text" || !tail.test(prev.value)) return;
    if ((node.children ?? []).length || Object.keys(node.attributes ?? {}).length) {
      errors.push({
        node,
        message: `an @reference “@…:${node.name}” must not be followed directly by [ or {`,
      });
      return;
    }
    prev.value += `:${node.name}`;
    let end = node.position?.end;
    const next = parent.children[index + 1];
    let removed = 1;
    if (next?.type === "text") {
      prev.value += next.value;
      end = next.position?.end ?? end;
      removed = 2;
    }
    if (prev.position && end) prev.position = { start: prev.position.start, end };
    parent.children.splice(index, removed);
    return index; // re-check the same index (chains like @a:b … @c:d)
  });
  return errors;
}

/**
 * Resolve one reference. Throws an Error whose message is written for the
 * author. One app is one chapter, so every href is a plain in-page anchor.
 */
export function resolveRef(table, type, id, ctx = {}, numOnly = false) {
  const envKind = ENV_KIND[type];

  if (envKind || type === "ref" || type === "num") {
    const env = table.envs?.[id];
    if (env) {
      if (envKind && envFamily(envKind) !== envFamily(env.kind))
        throw new Error(
          `@${type}:${id} — but “${id}” is a ${env.kind} (${env.num}); write @${env.directive}:${id}`
        );
      const text = type === "num" ? env.num : `${env.kind} ${env.num}`;
      return { text, href: `#${env.anchor}`, anchor: env.anchor, target: "env", num: env.num };
    }
    if (envKind)
      throw new Error(`unknown reference @${type}:${id} — no environment carries that label`);
    // @num / @ref also resolve equations, sub-headings and sections
    const eq = table.eqs?.[id];
    const sub = table.subs?.[id];
    const sec = table.sections?.[id];
    const hits = [eq && "equation", sub && "sub-heading", sec && "section"].filter(Boolean);
    if (hits.length > 1)
      throw new Error(`@${type}:${id} is ambiguous (${hits.join(" AND ")}) — use @eq: or @sec:`);
    if (eq) return resolveRef(table, "eq", id, ctx, type === "num");
    if (sub || sec) return resolveRef(table, "sec", id, ctx, type === "num");
    throw new Error(`unknown reference @${type}:${id}`);
  }

  if (type === "eq") {
    const eq = table.eqs?.[id];
    if (!eq) throw new Error(`unknown reference @eq:${id} — no equation carries $$ {#eq-${id}}`);
    const text = numOnly ? eq.num : `(${eq.num})`;
    return { text, href: `#${eq.anchor}`, anchor: eq.anchor, target: "eq", num: eq.num };
  }

  if (type === "sec") {
    const sec = table.sections?.[id];
    const sub = table.subs?.[id];
    if (sec && sub)
      throw new Error(
        `@sec:${id} is ambiguous: a section AND a sub-heading carry that id — rename one of them`
      );
    const hit = sec ?? sub;
    if (!hit)
      throw new Error(
        `unknown reference @sec:${id} — sections are addressed by their number (@sec:4.3) or by their optional key export`
      );
    const text = numOnly ? hit.num : `Section ${hit.num}`;
    return {
      text,
      href: `#${hit.anchor}`,
      anchor: hit.anchor,
      target: sec ? "sec" : "sub",
      num: hit.num,
    };
  }
  throw new Error(`unknown reference kind @${type}:`);
}

/**
 * Split a text node's value into segments: { text } | { ref: {type,id}, raw }.
 * `raw` is the node's source text (needed for the \@ escape): the parser has
 * already dropped the backslash, so the value reads "@theorem:x" either way
 * and only the source says whether it was escaped. The k-th match in the
 * value corresponds to the k-th in the source (escaping neither creates nor
 * destroys @patterns); if the counts disagree we report instead of guessing.
 */
export function splitRefs(value, raw) {
  const inValue = [...String(value).matchAll(REF_RE)];
  if (!inValue.length) return null;
  const inRaw = raw != null ? [...String(raw).matchAll(REF_RE)] : null;
  if (inRaw && inRaw.length !== inValue.length)
    return {
      error: `@references in this text cannot be matched to the source (${inValue.length} in the text, ${inRaw.length} in the source) — avoid entities or unusual spellings around @…`,
    };
  const out = [];
  let pos = 0;
  let any = false;
  inValue.forEach((m, k) => {
    const escaped = inRaw ? inRaw[k][1] === "\\" : m[1] === "\\";
    const start = m.index;
    if (escaped) return; // value already carries the unescaped "@…": keep as text
    if (start > pos) out.push({ text: value.slice(pos, start) });
    out.push({ ref: { type: m[2], id: m[3] }, raw: m[0] });
    pos = start + m[0].length;
    any = true;
  });
  if (!any) return null;
  if (pos < value.length) out.push({ text: value.slice(pos) });
  return { segments: out };
}
