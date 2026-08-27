/**
 * MathJax global config — MUST be imported before "mathjax/es5/tex-svg.js"
 * (the MathJax bundle reads window.MathJax at load time). SVG output is used
 * because it embeds all glyphs as vectors: no external font files, so the
 * single-file build is fully offline-capable.
 */
declare global {
  interface Window {
    MathJax: any;
  }
}

/**
 * Project-wide TeX macros, MathJax `tex.macros` shape: `"bx": "\\mathbf{x}"`
 * or `"norm": ["\\left\\lVert #1 \\right\\rVert", 1]` (string + arity).
 * Keep every entry on the `"name": "…"` / `"name": ["…", n]` form —
 * scripts/verify/scan-macros.mjs parses this file textually to find macros
 * that MathJax would otherwise typeset SILENTLY as literal text.
 */
export const texMacros: Record<string, string | [string, number]> = {};

window.MathJax = {
  loader: { load: [] },
  tex: {
    packages: { "[+]": ["ams"] },
    macros: texMacros,
    inlineMath: [["\\(", "\\)"]],
    displayMath: [["\\[", "\\]"]],
  },
  svg: { fontCache: "none" },
  startup: { typeset: false },
};

/**
 * Optional TeX that is typeset ONCE, hidden, before any real math, so that
 * document-wide definitions stick (MathJax's `color` package keeps
 * `\definecolor` state across expressions). Leave empty if the project has
 * no named colours; e.g. the FMM-Skript sets
 *   "\\definecolor{cbblue}{RGB}{0,114,178}\\definecolor{cbred}{RGB}{213,94,0}"
 * (and lists "color" under tex.packages above).
 */
export const colorBootstrap: string = "";
