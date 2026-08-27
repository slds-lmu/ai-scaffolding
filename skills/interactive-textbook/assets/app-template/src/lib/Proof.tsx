import { Children, createContext, isValidElement, useContext, useState, type ReactNode } from "react";

/**
 * Annotierter, schrittweise aufdeckbarer Beweis.
 *
 *   <Proof>
 *     <PStep why={<>Definition 1.7.2 einsetzen</>}> ...Zeile... </PStep>
 *     <PStep> ...Zeile ohne Annotation... </PStep>
 *   </Proof>
 *
 * Standardansicht: NUR DER ERSTE SCHRITT. Der Leser deckt mit „nächster
 * Schritt" nacheinander auf; der Knopf „kompletten Beweis zeigen" springt zur
 * Gesamtansicht (und wieder zurück). Ein Beweis, der sofort vollständig
 * dasteht, wird überflogen statt nachvollzogen — deshalb ist das Steppen der
 * Default (geändert 2026-08-20).
 *
 * Alle sichtbaren UI-Texte sind lokalisierbar (Muster wie beim
 * TooltipProvider): Defaults sind DEUTSCH, eine anderssprachige App setzt
 * eigene Labels per <ProofLabelsProvider labels={…}> um den Baum oder per
 * labels-Prop an einem einzelnen <Proof>.
 */
export interface ProofLabels {
  /** Überschrift der Beweis-Box */
  proof: string;
  /** Knopf: in den Schritt-für-Schritt-Modus wechseln */
  stepByStep: string;
  /** Knopf: zurück zur Komplettansicht */
  showFullProof: string;
  /** Knopf: nächsten Schritt aufdecken (der Zähler „(k/n)" wird angehängt) */
  nextStep: string;
  /** aria-Label des QED-Zeichens ∎ (das Zeichen selbst ist ein Symbol) */
  qed: string;
}

const DEFAULT_LABELS: ProofLabels = {
  proof: "Proof.",
  stepByStep: "step by step",
  showFullProof: "show full proof",
  nextStep: "next step",
  qed: "end of proof",
};

const LabelCtx = createContext<Partial<ProofLabels>>({});

/** Setzt Beweis-Labels app-weit (z. B. um App.tsx gelegt). */
export function ProofLabelsProvider({
  children,
  labels,
}: {
  children: ReactNode;
  labels: Partial<ProofLabels>;
}) {
  return <LabelCtx.Provider value={labels}>{children}</LabelCtx.Provider>;
}

export function PStep({ children }: { children: ReactNode; why?: ReactNode }) {
  // PStep is a data carrier; rendering happens inside <Proof>
  return <>{children}</>;
}

export function Proof({
  children,
  qed = true,
  labels,
}: {
  children: ReactNode;
  qed?: boolean;
  labels?: Partial<ProofLabels>;
}) {
  const inherited = useContext(LabelCtx);
  const L: ProofLabels = { ...DEFAULT_LABELS, ...inherited, ...labels };
  const steps = Children.toArray(children).filter(isValidElement) as {
    props: { children: ReactNode; why?: ReactNode };
  }[];
  // null = alle Schritte sichtbar; sonst Anzahl aufgedeckter Schritte.
  // Default ist das schrittweise Lesen ab dem ERSTEN Schritt: ein Beweis, der
  // sofort vollstaendig dasteht, wird ueberflogen statt nachvollzogen.
  const [shown, setShown] = useState<number | null>(1);
  const visible = shown === null ? steps.length : Math.min(shown, steps.length);

  return (
    <div className="my-4 rounded-r-md border-l-4 border-slate-300 bg-slate-50/60 px-4 py-2 dark:border-slate-600 dark:bg-slate-800/30">
      <div className="mb-1 flex items-center gap-3">
        <span className="font-semibold italic">{L.proof}</span>
        <button
          type="button"
          className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          onClick={() => setShown(shown === null ? 1 : null)}
        >
          {shown === null ? L.stepByStep : L.showFullProof}
        </button>
      </div>
      {steps.slice(0, visible).map((s, i) => (
        <div key={i} className="my-2">
          {s.props.children}
          {s.props.why !== undefined && (
            <div className="mt-0.5 text-right text-sm text-slate-500 dark:text-slate-400">
              [{s.props.why}]
            </div>
          )}
        </div>
      ))}
      {shown !== null && visible < steps.length && (
        <button
          type="button"
          className="my-2 rounded bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-500"
          onClick={() => setShown(visible + 1)}
        >
          {L.nextStep} ({visible + 1}/{steps.length})
        </button>
      )}
      {visible === steps.length && qed && (
        <div className="text-right text-slate-500" aria-label={L.qed}>
          ∎
        </div>
      )}
    </div>
  );
}
