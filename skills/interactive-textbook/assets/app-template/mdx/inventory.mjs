/**
 * Semantisches Inventar einer Abschnittsdatei — das Migrations-Orakel.
 *
 * Der Extraktor liest nur den tatsächlich gerenderten Abschnitts- bzw.
 * Konzept-Teilbaum. Deklarationskörper und hochgezogene Quizdaten dürfen die
 * Dokumentreihenfolge nicht verschieben. Jeder Eintrag trägt außerdem seinen
 * semantischen Elternpfad; damit ist „dieselbe Formel, aber außerhalb des
 * Satzes" keine gleichwertige Konvertierung.
 */
import { parse as babelParse } from "@babel/parser";
import _traverse from "@babel/traverse";
import { compile } from "@mdx-js/mdx";
import remarkMath from "remark-math";
import remarkDirective from "remark-directive";
import remarkFmm from "./remark-fmm.mjs";
import { remarkChain } from "./plugins.mjs";

const traverse = _traverse.default ?? _traverse;
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

const SEMANTIC = new Set([
  "M",
  "MD",
  "Eq",
  "EnvBlock",
  "ConceptLink",
  "ExpandedReading",
  "Interaktiv",
  "Proof",
  "PStep",
  "Quiz",
  "Frage",
]);

const CONTAINERS = new Set(["EnvBlock", "ExpandedReading", "Interaktiv", "Proof", "PStep", "Quiz"]);
// Blockgrenzen beenden einen Prosalauf. Das muss VOLLSTÄNDIG sein: fehlten
// hier th/td, sickerte der Quelltext-Umbruch zwischen `</th>` und `<th>` als
// Leerzeichen in den Lauf, und die MDX-Tabellenzelle erzeugte keinen — vier
// Fehlalarme allein im Pilotabschnitt. Die Antwort darauf ist, hier
// vollständig zu sein, NICHT den Vergleich weichzuspülen.
const BLOCKS = new Set([
  "p", "li", "blockquote", "pre", "table", "tr", "th", "td", "thead", "tbody",
  "tfoot", "caption", "div", "ul", "ol", "dl", "dt", "dd", "section", "figure",
  "figcaption", "h1", "h2", "h3", "h4", "h5", "h6",
]);

const jsxName = (n) =>
  n?.type === "JSXIdentifier"
    ? n.name
    : n?.type === "JSXMemberExpression"
      ? `${jsxName(n.object)}.${jsxName(n.property)}`
      : "";

function sourceOf(node, code) {
  return node?.start != null && node?.end != null ? code.slice(node.start, node.end) : "?";
}

/** Statischer Ausdruckswert; Unbekanntes bleibt mit Quelltext sichtbar. */
function expressionValue(e, code) {
  if (!e) return "«leer»";
  if (e.type === "JSXEmptyExpression") return undefined;
  if (e.type === "StringLiteral" || e.type === "BooleanLiteral" || e.type === "NumericLiteral")
    return e.value;
  if (e.type === "NullLiteral") return null;
  if (e.type === "TemplateLiteral" && e.expressions.length === 0)
    return e.quasis[0]?.value?.cooked ?? "";
  if (e.type === "Identifier" && e.name === "undefined") return undefined;
  if (e.type === "ArrayExpression")
    return e.elements.map((x) =>
      x?.type === "SpreadElement" ? `«dynamisch:${sourceOf(x, code)}»` : expressionValue(x, code)
    );
  if (e.type === "ObjectExpression") {
    const entries = [];
    for (const p of e.properties) {
      if (p.type !== "ObjectProperty" || p.computed) {
        entries.push([`«dynamisch:${sourceOf(p, code)}»`, true]);
        continue;
      }
      const k = p.key.type === "Identifier" ? p.key.name : String(p.key.value);
      entries.push([k, expressionValue(p.value, code)]);
    }
    return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
  }
  if (e.type === "UnaryExpression" && ["+", "-", "!"].includes(e.operator)) {
    const v = expressionValue(e.argument, code);
    if (typeof v === "number" || typeof v === "boolean") {
      if (e.operator === "+") return +v;
      if (e.operator === "-") return -v;
      return !v;
    }
  }
  return `«dynamisch:${norm(sourceOf(e, code))}»`;
}

function stable(value) {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

/** Wert eines JSX-Attributs, soweit statisch bestimmbar. */
function attrValue(el, name, code) {
  const a = (el.attributes ?? []).find(
    (x) => x.type === "JSXAttribute" && x.name?.name === name
  );
  if (!a) return null;
  if (!a.value) return true;
  if (a.value.type === "StringLiteral") return a.value.value;
  if (a.value.type === "JSXExpressionContainer") return expressionValue(a.value.expression, code);
  return `«dynamisch:${norm(sourceOf(a.value, code))}»`;
}

/** Alle Komponenten-Props in kanonischer Reihenfolge, inklusive Spreads. */
function propsOf(el, code, omit = []) {
  const ignored = new Set(omit);
  const out = [];
  for (const a of el.attributes ?? []) {
    if (a.type === "JSXSpreadAttribute") {
      out.push([`...${norm(sourceOf(a.argument, code))}`, "«dynamisch»"]);
      continue;
    }
    const name = a.name?.name;
    if (!name || ignored.has(name)) continue;
    out.push([name, attrValue(el, name, code)]);
  }
  return out
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${stable(value)}`)
    .join(" ");
}

function stringChild(el, code) {
  const parts = [];
  for (const c of el.children ?? []) {
    if (c.type === "JSXText") parts.push(c.value);
    else if (c.type === "JSXExpressionContainer") {
      const v = expressionValue(c.expression, code);
      if (typeof v === "string" || typeof v === "number") parts.push(String(v));
      else return `«dynamisch:${norm(sourceOf(c.expression, code))}»`;
    } else return `«dynamisch:${norm(sourceOf(c, code))}»`;
  }
  return parts.join("");
}

/** Sichtbarer Inhalt eines JSX-Teilbaums, mit semantischen Inline-Markern. */
function contentSignature(node, code) {
  let out = "";
  const walk = (n) => {
    if (!n) return;
    if (Array.isArray(n)) {
      for (const x of n) walk(x);
      return;
    }
    if (n.type === "JSXText") {
      out += n.value;
      return;
    }
    if (n.type === "StringLiteral" || n.type === "NumericLiteral") {
      out += String(n.value);
      return;
    }
    if (n.type === "JSXExpressionContainer") {
      if (n.expression.type === "JSXElement" || n.expression.type === "JSXFragment") walk(n.expression);
      else {
        const v = expressionValue(n.expression, code);
        out += typeof v === "string" || typeof v === "number" ? String(v) : stable(v);
      }
      return;
    }
    if (n.type === "JSXFragment") {
      walk(n.children);
      return;
    }
    if (n.type !== "JSXElement") return;
    const el = n.openingElement;
    const name = jsxName(el.name);
    if (name === "M" || name === "MD") {
      out += ` «${name}:${norm(stringChild(n, code))}» `;
      return;
    }
    if (name === "ConceptLink") {
      out += ` «Konzept:${stable(attrValue(el, "id", code))}|`;
      walk(n.children);
      out += "» ";
      return;
    }
    if (name === "a") {
      out += ` «Link:${stable(attrValue(el, "href", code))}|`;
      walk(n.children);
      out += "» ";
      return;
    }
    if (/^[A-Z]/.test(name) && !SEMANTIC.has(name)) {
      out += ` «Widget:${name} ${propsOf(el, code)}» `;
      walk(n.children);
      return;
    }
    walk(n.children);
  };
  walk(node);
  return norm(out);
}

function attrWhyText(el, code) {
  const a = (el.attributes ?? []).find(
    (x) => x.type === "JSXAttribute" && x.name?.name === "why"
  );
  if (!a?.value || a.value.type !== "JSXExpressionContainer") return "";
  return contentSignature(a.value.expression, code);
}

function returnExpression(fn) {
  if (!fn) return null;
  if (fn.type === "ArrowFunctionExpression" && fn.body.type !== "BlockStatement") return fn.body;
  for (const st of fn.body?.body ?? []) if (st.type === "ReturnStatement") return st.argument;
  return null;
}

/** Gerenderte Wurzel statt sämtlicher JSX-Deklarationen der Datei. */
function renderRoots(ast) {
  const functions = new Map();
  for (const st of ast.program.body) {
    const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (d?.type === "FunctionDeclaration" && d.id) functions.set(d.id.name, d);
    if (d?.type === "VariableDeclaration")
      for (const v of d.declarations)
        if (v.id.type === "Identifier" && ["ArrowFunctionExpression", "FunctionExpression"].includes(v.init?.type))
          functions.set(v.id.name, v.init);
  }

  if (functions.has("_createMdxContent")) return [returnExpression(functions.get("_createMdxContent"))].filter(Boolean);

  const roots = [];
  for (const st of ast.program.body) {
    if (st.type === "ExportDefaultDeclaration") {
      const d = st.declaration;
      const fn = d.type === "Identifier" ? functions.get(d.name) : d;
      const root = returnExpression(fn);
      if (root) roots.push(root);
    }
    if (st.type === "ExportNamedDeclaration" && st.declaration?.type === "FunctionDeclaration") {
      if (/^S\d/.test(st.declaration.id?.name ?? "")) {
        const root = returnExpression(st.declaration);
        if (root) roots.push(root);
      }
    }
  }

  traverse(ast, {
    CallExpression(path) {
      if (path.node.callee.type !== "Identifier" || path.node.callee.name !== "registerConcept") return;
      const obj = path.node.arguments[0];
      if (obj?.type !== "ObjectExpression") return;
      const body = obj.properties.find(
        (p) => p.type === "ObjectProperty" && !p.computed && (p.key.name ?? p.key.value) === "body"
      );
      if (body?.type === "ObjectProperty") roots.push(body.value);
    },
  });
  return roots;
}

function quizData(ast, code) {
  const quizzes = new Map();
  traverse(ast, {
    VariableDeclarator(path) {
      if (path.node.id.type !== "Identifier" || path.node.id.name !== "QUIZ") return;
      let init = path.node.init;
      while (init && ["TSAsExpression", "TSSatisfiesExpression", "TypeCastExpression"].includes(init.type)) init = init.expression;
      if (init?.type !== "ArrayExpression") return;
      const entries = [];
      for (const item of init.elements) {
        if (item?.type !== "ObjectExpression") continue;
        const get = (name) =>
          item.properties.find(
            (p) => p.type === "ObjectProperty" && !p.computed && (p.key.name ?? p.key.value) === name
          )?.value;
        const statement = get("statement");
        const truth = get("wahr");
        const explanation = get("expl");
        entries.push({
          wahr: truth ? expressionValue(truth, code) : "«fehlt»",
          statement: statement ? contentSignature(statement, code) : "«fehlt»",
          explanation: explanation ? contentSignature(explanation, code) : "«fehlt»",
        });
      }
      quizzes.set("QuizWidget", entries);
    },
  });
  return quizzes;
}

function scopeLabel(el, code) {
  const name = jsxName(el.name);
  if (name === "EnvBlock")
    return `EnvBlock(${stable(attrValue(el, "kind", code))},${stable(attrValue(el, "label", code))})`;
  if (name === "ExpandedReading") return `ExpandedReading(${stable(attrValue(el, "title", code))})`;
  if (name === "Interaktiv") return `Interaktiv(${stable(attrValue(el, "title", code))})`;
  if (name === "Proof") return `Proof(${propsOf(el, code) || "qed=Standard"})`;
  if (name === "PStep") return `PStep(${norm(attrWhyText(el, code)) || "ohne why"})`;
  if (name === "Quiz") return "Quiz";
  if (/^[A-Z]/.test(name) && !SEMANTIC.has(name)) return `${name}(${propsOf(el, code)})`;
  return null;
}

function scopeOf(path, code) {
  const out = [];
  for (let p = path.parentPath; p; p = p.parentPath) {
    if (p.node?.type !== "JSXElement") continue;
    const label = scopeLabel(p.node.openingElement, code);
    if (label) out.unshift(label);
  }
  return out;
}

export function inventoryFromTsx(code) {
  const ast = babelParse(code, { sourceType: "module", plugins: ["typescript", "jsx"] });
  const roots = renderRoots(ast);
  const ranges = roots.length
    ? roots.map((r) => [r.start, r.end])
    : [[ast.program.start, ast.program.end]];
  const inside = (n) => ranges.some(([a, b]) => n.start >= a && n.end <= b);
  const hoistedQuizzes = quizData(ast, code);
  const items = [];
  let prose = "";
  let proseWithin = [];

  const flushProse = () => {
    const text = norm(prose);
    if (text) items.push({ kind: "text", text, within: proseWithin });
    prose = "";
    proseWithin = [];
  };
  const appendProse = (value, path) => {
    if (!norm(value)) {
      // Reiner Weißraum: JSX verwirft ihn, WENN er einen Zeilenumbruch
      // enthält (Quelltext-Einrückung), behält ihn aber sonst — und `{" "}`
      // ist genau die Schreibweise für ein bewusst gesetztes Leerzeichen
      // zwischen Inline-Elementen. Das früher pauschale Verwerfen ließ
      // `Urteil{" "}<em>…` zu „Urteil…" zusammenlaufen und meldete gegen die
      // MDX-Fassung eine Abweichung, die es im Rendering nicht gibt.
      if (prose && !/\n/.test(value)) prose += " ";
      return;
    }
    const within = scopeOf(path, code);
    if (prose && stable(within) !== stable(proseWithin)) flushProse();
    if (!prose) proseWithin = within;
    prose += value;
  };
  const add = (path, item) => {
    flushProse();
    items.push({ ...item, within: scopeOf(path, code) });
  };

  traverse(ast, {
    JSXElement: {
      enter(path) {
        if (!inside(path.node)) {
          path.skip();
          return;
        }
        const el = path.node.openingElement;
        const name = jsxName(el.name);
        if (BLOCKS.has(name)) flushProse();

        if (name === "M" || name === "MD") {
          add(path, { kind: "math", display: name === "MD", tex: stringChild(path.node, code) });
          path.skip();
        } else if (name === "Eq") {
          add(path, { kind: "eq", tag: attrValue(el, "tag", code), tex: stringChild(path.node, code) });
          path.skip();
        } else if (name === "EnvBlock") {
          add(path, { kind: "env", envKind: attrValue(el, "kind", code), label: attrValue(el, "label", code) });
        } else if (name === "ConceptLink") {
          add(path, { kind: "concept", id: attrValue(el, "id", code), text: contentSignature(path.node.children, code) });
          path.skip();
        } else if (name === "ExpandedReading") {
          add(path, { kind: "deepdive", title: attrValue(el, "title", code) });
        } else if (name === "Interaktiv") {
          add(path, { kind: "interaktiv", title: attrValue(el, "title", code) });
        } else if (name === "Proof") {
          add(path, { kind: "proof", props: propsOf(el, code) || "qed=Standard" });
        } else if (name === "PStep") {
          add(path, { kind: "step", why: norm(attrWhyText(el, code)) });
        } else if (name === "Quiz") {
          add(path, { kind: "quiz", props: propsOf(el, code) });
        } else if (name === "Frage") {
          const children = path.node.children.filter(
            (c) => !(c.type === "JSXText" && !norm(c.value)) &&
              !(c.type === "JSXExpressionContainer" && !norm(contentSignature(c, code)))
          );
          const siblings = path.parentPath.node?.children ?? [];
          const order = siblings.filter(
            (c) => c.type === "JSXElement" && jsxName(c.openingElement.name) === "Frage" && c.start < path.node.start
          ).length;
          add(path, {
            kind: "frage",
            order,
            wahr: attrValue(el, "wahr", code),
            statement: contentSignature(children[0], code),
            explanation: contentSignature(children.slice(1), code),
          });
          path.skip();
        } else if (name === "QuizWidget" && hoistedQuizzes.has(name)) {
          add(path, { kind: "quiz", props: "" });
          const within = [...scopeOf(path, code), "Quiz"];
          hoistedQuizzes.get(name).forEach((q, order) => items.push({ kind: "frage", order, ...q, within }));
          path.skip();
        } else if (/^h[1-6]$/.test(name)) {
          add(path, { kind: "heading", level: Number(name[1]), id: attrValue(el, "id", code), text: contentSignature(path.node.children, code) });
          path.skip();
        } else if (name === "img") {
        // Bilder waren für den Gate unsichtbar: ein gelöschtes `<img>` verglich
        // sich gleich. Quelle und Alt-Text gehören zum Inhalt.
        add(path, {
          kind: "image",
          src: attrValue(el, "src", code),
          alt: attrValue(el, "alt", code),
        });
        path.skip();
      } else if (name === "a") {
          add(path, { kind: "link", href: attrValue(el, "href", code), text: contentSignature(path.node.children, code) });
          path.skip();
        } else if (/^[A-Z]/.test(name) && !SEMANTIC.has(name)) {
          add(path, { kind: "widget", name, props: propsOf(el, code) });
        }
      },
      exit(path) {
        if (inside(path.node) && BLOCKS.has(jsxName(path.node.openingElement.name))) flushProse();
      },
    },
    JSXText(path) {
      if (inside(path.node) && path.parentPath.node.type !== "JSXAttribute") appendProse(path.node.value, path);
    },
    JSXExpressionContainer(path) {
      if (!inside(path.node)) return;
      if (path.parentPath.node.type !== "JSXElement" && path.parentPath.node.type !== "JSXFragment") return;
      const v = expressionValue(path.node.expression, code);
      if (typeof v === "string" || typeof v === "number") appendProse(String(v), path);
    },
  });
  flushProse();
  return items;
}

export async function inventoryFromMdx(source, filePath, root) {
  const js = String(
    await compile(
      { value: source, path: filePath },
      { remarkPlugins: remarkChain(root), jsx: true }
    )
  );
  const cleaned = js.replace(/_components\.([a-z][a-z0-9]*)/g, "$1");
  return inventoryFromTsx(cleaned);
}

const tex = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const where = (it) => (it.within?.length ? ` in ${it.within.join(" > ")}` : "");

const key = (it) => {
  let value;
  switch (it.kind) {
    case "math": value = `math${it.display ? "!" : ""} ${tex(it.tex)}`; break;
    case "eq": value = `eq(${it.tag}) ${tex(it.tex)}`; break;
    case "env": value = `env ${it.envKind} ${it.label}`; break;
    case "concept": value = `concept #${it.id} „${it.text}"`; break;
    case "deepdive": value = `deepdive ${it.title}`; break;
    case "interaktiv": value = `interaktiv ${it.title}`; break;
    case "proof": value = `proof ${it.props}`; break;
    case "step": value = `step why=${it.why}`; break;
    case "quiz": value = `quiz ${it.props}`; break;
    case "frage": value = `frage[${it.order}] wahr=${stable(it.wahr)} aussage=„${it.statement}" erklärung=„${it.explanation}"`; break;
    case "heading": value = `h${it.level}#${it.id ?? "-"} ${it.text}`; break;
    case "link": value = `link ${it.href} „${it.text}"`; break;
    case "image":
      value = `image ${stable(it.src)} alt=${stable(it.alt)}`;
      break;
    case "widget": value = `widget <${it.name}> props(${it.props})`; break;
    // Weißraum wird NORMALISIERT, nicht entfernt. Entfernen hätte
    // „Ende.Deshalb" und „Ende. Deshalb" gleich gemacht, also genau die
    // zusammengelaufenen Wörter durchgelassen, die eine schludrige
    // Konvertierung produziert. Die Fehlalarme an Element-Grenzen sind
    // stattdessen an der Wurzel behoben (siehe BLOCKS oben).
    default: value = `text ${norm(it.text)}`;
  }
  return value + where(it);
};

export { key as inventoryKey };

/** Mengenvergleich nur für eine zusätzliche, verständliche Verlustdiagnose. */
export function diffMultiset(a, b, { ignoreText = false } = {}) {
  const bag = (inv) => {
    const m = new Map();
    for (const it of inv) {
      if (ignoreText && it.kind === "text") continue;
      const k = key(it);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const ma = bag(a);
  const mb = bag(b);
  const out = [];
  for (const [k, n] of ma) if ((mb.get(k) ?? 0) < n) out.push({ side: "fehlt in MDX", entry: k, alt: n, neu: mb.get(k) ?? 0 });
  for (const [k, n] of mb) if ((ma.get(k) ?? 0) < n) out.push({ side: "nur in MDX", entry: k, alt: ma.get(k) ?? 0, neu: n });
  return out;
}

/** Geordneter Vergleich; leer bedeutet einschließlich Verschachtelung gleichwertig. */
export function diffInventories(a, b, { ignoreText = false } = {}) {
  const fa = ignoreText ? a.filter((x) => x.kind !== "text") : a;
  const fb = ignoreText ? b.filter((x) => x.kind !== "text") : b;
  const out = [];
  for (let i = 0; i < Math.max(fa.length, fb.length); i++) {
    const ka = fa[i] ? key(fa[i]) : "«fehlt»";
    const kb = fb[i] ? key(fb[i]) : "«fehlt»";
    if (ka !== kb) out.push({ index: i, tsx: ka, mdx: kb });
  }
  return out;
}
