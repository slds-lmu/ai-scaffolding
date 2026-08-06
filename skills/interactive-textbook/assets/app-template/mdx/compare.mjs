#!/usr/bin/env node
/**
 * Migrations-Gate: vergleicht das semantische Inventar einer TSX-Fassung mit
 * dem der MDX-Fassung.
 *
 *   node mdx/compare.mjs src/sections/S22.tsx src/sections/S22.mdx
 * Exit 0 = in Inhalt, Reihenfolge und semantischer Verschachtelung
 * gleichwertig. Prosa kann nicht ausgeblendet werden: Gerade still verlorene
 * Prosa ist für diesen Migrations-Gate der kritischste Fehler.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  inventoryFromTsx,
  inventoryFromMdx,
  diffInventories,
  diffMultiset,
} from "./inventory.mjs";

const args = process.argv.slice(2);
if (args.some((a) => a.startsWith("--"))) {
  console.error("Optionen sind nicht erlaubt; der Gate vergleicht Prosa immer vollständig.");
  process.exit(2);
}
const [tsxPath, mdxPath] = args;

if (!tsxPath || !mdxPath) {
  console.error("Aufruf: node mdx/compare.mjs <alt.tsx> <neu.mdx>");
  process.exit(2);
}

const root = process.cwd();
const tsx = inventoryFromTsx(readFileSync(tsxPath, "utf8"));
const mdx = await inventoryFromMdx(readFileSync(mdxPath, "utf8"), path.resolve(mdxPath), root);
const count = (inv) => inv.reduce((m, it) => ((m[it.kind] = (m[it.kind] ?? 0) + 1), m), {});

console.log(`TSX: ${tsx.length} Einträge`, count(tsx));
console.log(`MDX: ${mdx.length} Einträge`, count(mdx));

// Die Menge liefert eine knappe Verlustdiagnose; entscheidend ist anschließend
// der geordnete Vergleich samt Elternpfad.
const lost = diffMultiset(tsx, mdx);
console.log(`\n[Diagnose] Mengenvergleich: ${lost.length === 0 ? "OK" : `${lost.length} Abweichung(en)`}`);
for (const d of lost.slice(0, 40)) console.log(`  ${d.side}: ${d.entry.slice(0, 150)}`);
if (lost.length > 40) console.log(`  … und ${lost.length - 40} weitere`);

const order = diffInventories(tsx, mdx);
console.log(
  `[Gate] Reihenfolge und Verschachtelung: ${order.length === 0 ? "OK" : `${order.length} Abweichung(en)`}`
);
for (const d of order.slice(0, 10)) {
  console.log(`  [${d.index}] alt: ${d.tsx.slice(0, 120)}`);
  console.log(`       neu: ${d.mdx.slice(0, 120)}`);
}

if (order.length === 0) {
  console.log(`\nGLEICHWERTIG`);
  process.exit(0);
}
process.exit(1);
