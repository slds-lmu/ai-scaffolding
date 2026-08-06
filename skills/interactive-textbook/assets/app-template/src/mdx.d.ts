/// <reference types="mdx" />

// Nur der Modultyp. ACHTUNG: `tsc --noEmit` prüft damit den INHALT einer
// .mdx-Datei NICHT — im Programm liegt bloß diese Deklaration. Die
// inhaltliche Absicherung leisten die Regeln in mdx/remark-fmm.mjs, die
// Fixtures und mdx/typecheck.mjs. Letzteres kompiliert MDX vor dem normalen
// Build zu temporärem TSX, damit auch Namen und Komponenten-Props im
// erzeugten JSX statisch geprüft werden.

declare module "*.mdx" {
  import type { ComponentType } from "react";
  const MDXComponent: ComponentType<Record<string, unknown>>;
  export default MDXComponent;
  export const title: string | undefined;
}
