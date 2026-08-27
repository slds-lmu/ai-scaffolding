/**
 * Klassen für die drei Oberflächen, auf denen ein Widget landen kann.
 *
 * 1. helles Skript (Default),
 * 2. dunkle Seite (`dark:`, folgt prefers-color-scheme),
 * 3. dunkles Tooltip-Panel (`.w-dark`, unabhängig vom Systemschema —
 *    `src/lib/tooltip/TooltipEngine.tsx` setzt die Klasse).
 *
 * SVG-INNENLEBEN (Achsen, Gitter, Beschriftungen) nutzt stattdessen die
 * CSS-Variablen `--w-bg/--w-grid/--w-grid-strong/--w-axis/--w-text/--w-muted/
 * --w-border` aus `src/index.css`; die Rahmen-Bedienelemente in DOM (Knöpfe,
 * Kästen, Fließtext) nutzen diese Klassenketten hier. Beides zusammen deckt
 * alle drei Oberflächen ab, ohne dass ein Aufrufer Props durchreichen muss.
 */

/** Kasten für Verdikt/Ergebnisse: dezente Fläche mit Rand. */
export const W_PANEL =
  "rounded border border-slate-200 bg-slate-50 " +
  "dark:border-slate-700 dark:bg-slate-800/50 " +
  "[.w-dark_&]:border-slate-600 [.w-dark_&]:bg-slate-900/40";

/** Fließtext im Widget. */
export const W_TEXT = "text-slate-700 dark:text-slate-200 [.w-dark_&]:text-slate-100";

/** Nebentext: Aufgabenzeile, Legende, Schrittzähler. */
export const W_MUTED = "text-slate-500 dark:text-slate-400 [.w-dark_&]:text-slate-300";

/** Knopf im Ruhezustand. */
export const W_BUTTON =
  "rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 " +
  "hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 " +
  "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 " +
  "[.w-dark_&]:border-slate-600 [.w-dark_&]:bg-slate-800 [.w-dark_&]:text-slate-100 " +
  "[.w-dark_&]:hover:bg-slate-700";

/** Knopf im gewählten Zustand (Preset aktiv, Antwort gewählt). */
export const W_BUTTON_AKTIV =
  "rounded border border-sky-600 bg-sky-50 px-2 py-1 text-sm font-medium text-sky-900 " +
  "dark:border-sky-400 dark:bg-sky-900/40 dark:text-sky-100 " +
  "[.w-dark_&]:border-sky-400 [.w-dark_&]:bg-sky-900/50 [.w-dark_&]:text-sky-100";

/** Zahlen-/Texteingabe. */
export const W_INPUT =
  "rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 " +
  "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 " +
  "[.w-dark_&]:border-slate-600 [.w-dark_&]:bg-slate-800 [.w-dark_&]:text-slate-100";
