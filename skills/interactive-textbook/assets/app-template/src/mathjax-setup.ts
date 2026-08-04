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

window.MathJax = {
  loader: { load: [] },
  tex: {
    packages: { "[+]": ["ams"] },
    inlineMath: [["\\(", "\\)"]],
    displayMath: [["\\[", "\\]"]],
  },
  svg: { fontCache: "none" },
  startup: { typeset: false },
};

export {};
