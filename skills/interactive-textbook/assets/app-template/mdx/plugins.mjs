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

/**
 * `extra` passes further remark-fmm options through — today only `numbers`
 * (a number table for the fixture tests, otherwise read from
 * <root>/src/sections/numbers.generated.json).
 */
export function remarkChain(root, extra = {}) {
  return [remarkMath, remarkGfm, remarkDirective, [remarkFmm, { root, ...extra }]];
}
