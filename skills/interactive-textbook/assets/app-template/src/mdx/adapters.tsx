/**
 * Kontext-Adapter für MDX-Inhalte.
 *
 * Das remark-fmm-Plugin erzeugt ABSICHTLICH kein Layout-<div>: derselbe
 * MDX-Inhalt landet an zwei Orten mit völlig verschiedener Typografie.
 *
 *   SectionBody  — heller Seitenkörper, volle Breite, große Überschriften
 *   ConceptBody  — Erklärfenster: IMMER dunkel, max-w-md, text-sm
 *                  (siehe src/lib/tooltip/TooltipEngine.tsx)
 *
 * Ohne diese Trennung würden Seitenklassen wie `[&_pre]:bg-slate-200/70`
 * oder `[&_h3]:mt-8` in ein schmales dunkles Fenster geschrieben: heller
 * Codeblock auf dunklem Grund, absurde Abstände. Die Kontextwahl liegt
 * deshalb beim Aufrufer und nicht an einer Pfad-Heuristik im Plugin.
 */
import type { ComponentType, ReactNode } from "react";

/**
 * Verpackt den Default-Export einer Abschnitts-MDX-Datei in die
 * Seitentypografie. Am Modulanfang EINMAL aufrufen, damit die
 * Komponenten-Identität stabil bleibt:
 *
 *     import SLabBody from "./SLab.mdx";
 *     const SLab = mdxSection(SLabBody);
 */
export function mdxSection(Body: ComponentType): ComponentType {
  return function MdxSection() {
    return (
      <SectionBody>
        <Body />
      </SectionBody>
    );
  };
}

/** Typografie für einen Abschnitt im Seitenkörper. */
export function SectionBody({ children }: { children: ReactNode }) {
  return (
    <div
      className={
        "space-y-4 [&>p]:max-w-prose " +
        "[&_h3]:mb-2 [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold " +
        "[&_h4]:mb-1 [&_h4]:mt-6 [&_h4]:text-lg [&_h4]:font-semibold " +
        "[&_a]:underline " +
        // max-w-prose nur für Listen auf oberster Ebene — Listen IN einer
        // EnvBlock-Box sollen die volle Boxbreite nutzen
        "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&>ul]:max-w-prose " +
        "[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&>ol]:max-w-prose " +
        "[&_table]:my-3 [&_table]:w-full [&_table]:text-sm [&_th]:border-b [&_th]:py-1 " +
        "[&_th]:pr-4 [&_th]:text-left [&_td]:py-1 [&_td]:pr-4 " +
        "[&_pre]:max-w-prose [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-200/70 " +
        "[&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm dark:[&_pre]:bg-slate-900/60"
      }
    >
      {children}
    </div>
  );
}

/**
 * Typografie für einen Tooltip-Text. Kompakt, und OHNE hell/dunkel-Varianten:
 * das Fenster ist immer dunkel, `dark:`-Klassen würden hier am Seitenthema
 * hängen statt am Fenster.
 */
export function ConceptBody({ children }: { children: ReactNode }) {
  return (
    <div
      className={
        "concept-body [color-scheme:dark] [&_p]:my-1.5 [&>p]:first:mt-0 " +
        "[&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold " +
        "[&_h4]:mb-1 [&_h4]:mt-3 [&_h4]:font-semibold " +
        "[&_a]:underline " +
        "[&_ul]:list-disc [&_ul]:space-y-0.5 [&_ul]:pl-4 " +
        "[&_ol]:list-decimal [&_ol]:space-y-0.5 [&_ol]:pl-4 " +
        "[&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_th]:border-b " +
        "[&_th]:py-1 [&_th]:pr-2 [&_th]:text-left [&_td]:py-1 [&_td]:pr-2 " +
        "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-slate-900/70 " +
        "[&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-xs"
      }
    >
      {children}
    </div>
  );
}
