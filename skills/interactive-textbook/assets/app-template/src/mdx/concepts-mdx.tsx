/**
 * Registriert die in MDX geschriebenen Konzept-Module.
 *
 * WARUM ES DIESE DATEI GIBT: `src/App.tsx` sammelt die Konzepte mit
 * `import.meta.glob("./concepts/*.tsx", { eager: true })` ein, und jedes
 * TSX-Modul ruft beim Import selbst `registerConcept(...)` auf. Ein
 * MDX-Modul kann das nicht — es exportiert nur eine Komponente. Würde man
 * ein Konzept einfach von .tsx auf .mdx umbenennen, verschwände es also
 * STILL aus der Tooltip-Registry, und jeder Verweis darauf würde als roter
 * „unbekanntes Konzept"-Link rendern. Deshalb übernimmt dieses Modul die
 * Registrierung für alle .mdx-Konzepte.
 *
 * Konvention wie bisher: DATEINAME = CONCEPT-ID (`trace.mdx` -> id "trace").
 * Der Titel kommt aus einem benannten Export:
 *
 *     export const title = "Spur einer Matrix";
 *
 *     Die *Spur* einer quadratischen Matrix ist die Summe ihrer …
 */
import type { ComponentType } from "react";
import { registerConcept } from "../lib";
import { ConceptBody } from "./adapters";

type ConceptModule = { default: ComponentType; title?: string };

const modules = import.meta.glob("../concepts/*.mdx", { eager: true }) as Record<
  string,
  ConceptModule
>;

for (const [file, mod] of Object.entries(modules)) {
  const id = file.replace(/^.*\//, "").replace(/\.mdx$/, "");
  if (!mod.title) {
    // laut scheitern: ein stiller Fallback („Titel = id") würde in einem
    // Fenster landen, das der Dozent nie zu sehen bekommt
    throw new Error(
      `Konzept-Modul ${file} exportiert keinen Titel — ergänze z.B. ` +
        `export const title = "Spur einer Matrix";`
    );
  }
  const Body = mod.default;
  registerConcept({
    id,
    title: mod.title,
    body: (
      <ConceptBody>
        <Body />
      </ConceptBody>
    ),
  });
}

export {};
