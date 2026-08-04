import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// singlefile inlines the JS/CSS bundles into dist/index.html — one
// self-contained file, viewable offline via double-click (MathJax is
// bundled too, see src/mathjax-setup.ts).
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  base: "./",
});
