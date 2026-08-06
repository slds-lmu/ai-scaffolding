/**
 * Die EINE kanonische remark-Kette der Autorenschicht.
 *
 * Sie war vorher an vier Stellen dupliziert (vite.config.ts, inventory.mjs,
 * typecheck.mjs, fixtures.test.mjs). Das ist gefährlich, weil das
 * Migrations-Gate dann anders kompiliert als der Build: eine Abweichung
 * würde nicht auffallen, sondern nur dazu führen, dass geprüft wird, was
 * nie ausgeliefert wird. Alle vier importieren jetzt diese Funktion.
 *
 * Reihenfolge: Mathe zuerst (damit $…$ nicht als Text durchrutscht), dann
 * GFM (Tabellen), dann Direktiven, zuletzt remark-fmm, das alles auf die
 * Komponenten aus src/lib abbildet.
 */
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkFmm from "./remark-fmm.mjs";

export function remarkChain(root) {
  return [remarkMath, remarkGfm, remarkDirective, [remarkFmm, { root }]];
}
