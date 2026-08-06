import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import mdx from "@mdx-js/rollup";
import { fileURLToPath } from "node:url";
import { remarkChain } from "./mdx/plugins.mjs";

const ROOT = fileURLToPath(new URL(".", import.meta.url));

// singlefile inlines the JS/CSS bundles into dist/index.html — one
// self-contained file, viewable offline via double-click (MathJax is
// bundled too, see src/mathjax-setup.ts).
export default defineConfig({
  plugins: [
    // enforce "pre": MDX must run BEFORE the React plugin, which then also has
    // to be told to transform the JSX that MDX produces (include below).
    { enforce: "pre", ...mdx({ remarkPlugins: remarkChain(ROOT) }) },
    react({ include: /\.(jsx|js|mdx|md|tsx|ts)$/ }),
    tailwindcss(),
    viteSingleFile(),
  ],
  base: "./",
});
