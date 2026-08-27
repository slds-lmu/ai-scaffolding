import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import mdx from "@mdx-js/rollup";
import { fileURLToPath } from "node:url";
import { remarkChain } from "./mdx/plugins.mjs";
import { generateNumbers } from "./scripts/gen-numbers.mjs";
import type { Plugin } from "vite";

const ROOT = fileURLToPath(new URL(".", import.meta.url));

/**
 * Keep the number table current in the dev server: every MDX change
 * recomputes src/sections/numbers.generated.json. If no number moved (a text
 * edit), ordinary HMR runs. If a counter shifted (a new example inserted),
 * the numbers in EVERY MDX module are stale, so all of them are invalidated
 * and the page reloads. A full reload after inserting a numbered block is
 * the intended behaviour, not a bug.
 */
function numbersPlugin(root: string): Plugin {
  const report = (r: ReturnType<typeof generateNumbers>) => {
    for (const w of r.warnings) console.warn(`gen-numbers: WARNING ${w}`);
    for (const e of r.errors) console.error(`gen-numbers: ERROR ${e}`);
  };
  return {
    name: "fmm-numbers",
    buildStart() {
      report(generateNumbers(root));
    },
    async handleHotUpdate({ file, server }) {
      if (!file.endsWith(".mdx")) return;
      const r = generateNumbers(root);
      report(r);
      if (!r.changed) return; // text only: ordinary HMR
      for (const mods of server.moduleGraph.fileToModulesMap.values())
        for (const mod of mods) if (mod.file?.endsWith(".mdx")) server.moduleGraph.invalidateModule(mod);
      server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}

// singlefile inlines the JS/CSS bundles into dist/index.html — one
// self-contained file, viewable offline via double-click (MathJax is
// bundled too, see src/mathjax-setup.ts).
export default defineConfig({
  plugins: [
    numbersPlugin(ROOT),
    // enforce "pre": MDX must run BEFORE the React plugin, which then also has
    // to be told to transform the JSX that MDX produces (include below).
    { enforce: "pre", ...mdx({ remarkPlugins: remarkChain(ROOT) }) },
    react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
    tailwindcss(),
    viteSingleFile(),
  ],
  base: "./",
});
