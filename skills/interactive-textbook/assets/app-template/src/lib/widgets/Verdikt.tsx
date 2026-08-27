/**
 * Verdikt — die zustandsabhängige Deutung unter der Grafik.
 *
 * „Neu gezeichnete Pixel sind keine Rückmeldung" (explorable-widgets, Pflicht 4):
 * Ein Widget muss dem Leser sagen, was der aktuelle Zustand BEDEUTET, und dabei
 * die nummerierten Ergebnisse des Skripts zitieren („hier scheitert (12.3)").
 * Diese Komponente ist die einheitliche Hülle dafür.
 *
 *   <Verdikt kind="fail">
 *     Für dieses Paar liegt die Sehne UNTER dem Graphen: (12.3) ist verletzt,
 *     also ist f nach Definition 11.2.1 nicht konvex.
 *   </Verdikt>
 *
 * Die Art wird nie nur über die Farbe transportiert (craft.md): jedes Verdikt
 * trägt ein Zeichen (→ ✓ ! ✗) und für Screenreader ein ausgeschriebenes Wort.
 * `role="status" aria-live="polite"` meldet Zustandswechsel an.
 *
 * Farben: ok = grün (#009E73), warn = orange (#E69F00), fail = rot (#D55E00),
 * neutral = grau. Das sind Rollen der Rückmeldung, keine Kapitel-Farbrollen —
 * wenn ein Kapitel Rot für einen Fehlerterm benutzt, bleibt der Kasten
 * trotzdem lesbar, weil die Farbe nur Zeichen und Kante einfärbt.
 */
import { useEffect, useState, type ReactNode } from "react";
import { FMM_COLORS } from "./util";
import { W_PANEL, W_TEXT } from "./surface";

export type VerdiktArt = "neutral" | "ok" | "warn" | "fail";

export interface VerdiktLabels {
  neutral: string;
  ok: string;
  warn: string;
  fail: string;
}

const DEFAULT_LABELS: VerdiktLabels = {
  neutral: "Observation",
  ok: "OK",
  warn: "Caution",
  fail: "Fails",
};

const ZEICHEN: Record<VerdiktArt, string> = {
  neutral: "→",
  ok: "✓",
  warn: "!",
  fail: "✗",
};

const FARBE: Record<VerdiktArt, string> = {
  neutral: FMM_COLORS.grau,
  ok: FMM_COLORS.gruen,
  warn: FMM_COLORS.orange,
  fail: FMM_COLORS.rot,
};

export function Verdikt({
  kind = "neutral",
  titel,
  labels,
  className = "",
  children,
}: {
  kind?: VerdiktArt;
  /** optionale fette Einleitung („Gut konditioniert:") */
  titel?: ReactNode;
  labels?: Partial<VerdiktLabels>;
  className?: string;
  children: ReactNode;
}) {
  const wort = { ...DEFAULT_LABELS, ...labels }[kind];
  const farbe = FARBE[kind];
  // Die Live-Region muss vor ihrer Nachricht existieren. Der sichtbare Kasten
  // bleibt davon unabhängig sofort vollständig gerendert.
  const [meldung, setMeldung] = useState<ReactNode>(null);
  useEffect(() => setMeldung(<>{wort}: {titel} {children}</>), [wort, titel, children]);
  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {meldung}
      </div>
      <div
      className={`max-w-prose p-3 pl-4 text-sm ${W_PANEL} ${W_TEXT} ${className}`}
      // Der Farbbalken links ist ein inset-Schatten, KEINE border: im
      // Tooltip-Panel überschreibt `.concept-body .border-slate-200` in
      // src/index.css jede Randfarbe mit !important und würde die Farbrolle
      // schlucken.
      style={{ boxShadow: `inset 4px 0 0 ${farbe}` }}
    >
      <span className="sr-only">{wort}: </span>
      <span
        aria-hidden="true"
        className="mr-1.5 font-bold"
        style={{ color: farbe }}
      >
        {ZEICHEN[kind]}
      </span>
      {/* Der Titel bleibt in der Textfarbe: farbige Fettschrift unterschreitet
          auf hellem Grund den Kontrastwert 4,5:1. Die Farbe trägt links die
          Kante und das Zeichen. */}
      {titel && <strong className="mr-1">{titel}</strong>}
      {children}
      </div>
    </>
  );
}
