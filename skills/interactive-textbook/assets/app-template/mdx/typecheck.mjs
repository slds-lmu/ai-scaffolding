#!/usr/bin/env node
/**
 * Kompiliert MDX vor dem TypeScript-Lauf zu temporärem TSX. Das globale
 * *.mdx-Shim kann nur Importe typisieren; Fehler im erzeugten JSX würde es
 * sonst vollständig verdecken und lazy geladene Kapitel erst im Browser
 * scheitern lassen.
 */
import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** eindeutig pro Lauf; siehe checkFileFor() */
const RUN = Math.random().toString(36).slice(2, 8);
import { fileURLToPath } from "node:url";
import { parse as babelParse } from "@babel/parser";
import _traverse from "@babel/traverse";
import { compile } from "@mdx-js/mdx";
import remarkMath from "remark-math";
import remarkDirective from "remark-directive";
import ts from "typescript";
import remarkFmm from "./remark-fmm.mjs";
import { remarkChain } from "./plugins.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const traverse = _traverse.default ?? _traverse;

async function mdxFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await mdxFiles(file)));
    else if (entry.isFile() && entry.name.endsWith(".mdx")) out.push(file);
  }
  return out;
}

function generatedPath(file) {
  // Der Name trägt PID und Zufallsanteil, weil im Workflow MEHRERE
  // Abschnitts-Agenten gleichzeitig `npm run typecheck:mdx` laufen lassen.
  // Bei festem Namen räumt der eine Lauf die Dateien des anderen weg, und der
  // zweite scheitert mit einem Fehler, der nichts mit seinem Abschnitt zu tun
  // hat. Die Datei muss NEBEN der Quelle liegen, damit relative Imports
  // (./widgets/…) auflösen — nur der Name darf eindeutig sein.
  return path.join(
    path.dirname(file),
    `.${path.basename(file, ".mdx")}.${process.pid}-${RUN}.mdx-check.tsx`
  );
}

async function compiled(entry) {
  const js = String(
    await compile(
      { value: entry.source, path: entry.path },
      {
        remarkPlugins: remarkChain(ROOT),
        jsx: true,
      }
    )
  );
  // Die MDX-Laufzeit liefert JavaScript-Scaffolding, dessen leeres Default-
  // Objekt TypeScript zu eng als {} inferiert. Nur diese generierten
  // Funktionsparameter werden gelockert; Autorenkomponenten bleiben intakt.
  return js
    .replace(/^\/\*@jsx(?:Runtime|ImportSource).*\*\/\r?\n/gm, "")
    .replace(/function _createMdxContent\(props\)/, "function _createMdxContent(props: any)")
    .replace(/function MDXContent\(props = \{\}\)/, "function MDXContent(props: any = {})");
}

export function assertStaticConceptTitle(js, file) {
  const ast = babelParse(js, { sourceType: "module", plugins: ["typescript", "jsx"] });
  for (const statement of ast.program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    const declaration = statement.declaration;
    if (declaration?.type !== "VariableDeclaration") continue;
    for (const item of declaration.declarations) {
      if (item.id.type === "Identifier" && item.id.name === "title") {
        if (item.init?.type === "StringLiteral" && item.init.value.trim()) return;
        throw new Error(
          `Konzept-Modul ${path.relative(ROOT, file)} braucht einen nichtleeren, statischen ` +
            `String in „export const title = \"…\"".`
        );
      }
    }
  }
  throw new Error(
    `Konzept-Modul ${path.relative(ROOT, file)} exportiert keinen Titel — ergänze ` +
      `„export const title = \"…\"".`
  );
}

export function assertUniqueConceptIds(entries) {
  const byId = new Map();
  for (const { id, file } of entries) {
    const previous = byId.get(id);
    if (previous)
      throw new Error(
        `Konzept-ID „${id}" ist doppelt: ${previous} und ${file}. ` +
          `Das MDX-Konzept und sein Widget müssen verschiedene Pfade haben.`
      );
    byId.set(id, file);
  }
}

async function checkUniqueConceptIds() {
  const dir = path.join(ROOT, "src/concepts");
  const files = (await readdir(dir)).filter((name) => /\.(tsx|mdx)$/.test(name));
  const entries = [];
  for (const name of files) {
    const file = path.join(dir, name);
    if (name.endsWith(".mdx")) {
      entries.push({ id: name.replace(/\.mdx$/, ""), file: path.relative(ROOT, file) });
      continue;
    }
    const ast = babelParse(await readFile(file, "utf8"), {
      sourceType: "module",
      plugins: ["typescript", "jsx"],
    });
    traverse(ast, {
      CallExpression(call) {
        if (call.node.callee.type !== "Identifier" || call.node.callee.name !== "registerConcept")
          return;
        const object = call.node.arguments[0];
        const id = object?.type === "ObjectExpression"
          ? object.properties.find(
              (property) =>
                property.type === "ObjectProperty" &&
                !property.computed &&
                (property.key.name ?? property.key.value) === "id"
            )?.value
          : null;
        if (id?.type !== "StringLiteral" || !id.value.trim())
          throw new Error(
            `Konzept-Modul ${path.relative(ROOT, file)} braucht eine statische String-ID in ` +
              `registerConcept({ id: "…" }).`
          );
        entries.push({ id: id.value, file: path.relative(ROOT, file) });
      },
    });
  }
  assertUniqueConceptIds(entries);
}

function readMdxConfig(extraFiles) {
  const configPath = path.join(ROOT, "tsconfig.mdx.json");
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, "\n"));
  const config = ts.parseJsonConfigFileContent(read.config, ts.sys, ROOT, undefined, configPath);
  return { options: config.options, rootNames: [...config.fileNames, ...extraFiles] };
}

/** Für die Fixture-Suite exportiert: liefert TypeScript-Fehler je MDX-Quelle. */
export async function typecheckMdxSources(entries) {
  const generated = [];
  try {
    for (const entry of entries) {
      const output = generatedPath(entry.path);
      await writeFile(output, await compiled(entry), "utf8");
      generated.push(output);
    }
    const config = readMdxConfig(generated);
    const program = ts.createProgram(config);
    const generatedSet = new Set(generated.map((file) => path.resolve(file)));
    return ts
      .getPreEmitDiagnostics(program)
      .filter(
        (d) =>
          d.category === ts.DiagnosticCategory.Error &&
          d.file &&
          generatedSet.has(path.resolve(d.file.fileName))
      )
      .map((d) => ({
        file: d.file?.fileName ?? "",
        message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
      }));
  } finally {
    await Promise.all(generated.map((file) => unlink(file).catch(() => undefined)));
  }
}

export async function runMdxTypecheck() {
  await checkUniqueConceptIds();
  const files = await mdxFiles(path.join(ROOT, "src"));
  const entries = [];
  for (const file of files) {
    const entry = { path: file, source: await readFile(file, "utf8") };
    const js = await compiled(entry);
    if (path.dirname(file) === path.join(ROOT, "src/concepts")) assertStaticConceptTitle(js, file);
    entries.push(entry);
  }
  const diagnostics = await typecheckMdxSources(entries);
  if (diagnostics.length) {
    for (const diagnostic of diagnostics)
      console.error(
        `${path.relative(ROOT, diagnostic.file)}: ${diagnostic.message.replace(/\n/g, " ")}`
      );
    throw new Error(`${diagnostics.length} TypeScript-Fehler im erzeugten MDX-JSX`);
  }
  console.log(`${files.length} MDX-Datei(en) statisch geprüft`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMdxTypecheck().catch((error) => {
    console.error(String(error.message ?? error));
    process.exit(1);
  });
}
