import { useState, type ReactNode } from "react";

/**
 * Annotierter, schrittweise aufdeckbarer Beweis.
 *
 *   <Proof>
 *     <PStep why={<>Definition 1.7.2 einsetzen</>}> ...Zeile... </PStep>
 *     <PStep> ...Zeile ohne Annotation... </PStep>
 *   </Proof>
 *
 * Standardansicht: kompletter Beweis mit allen Begründungen. Der Knopf
 * „Schritt für Schritt" blendet alles aus und deckt die Schritte einzeln
 * auf — für den Einsatz als Selbsttest beim Nacharbeiten.
 */
export function PStep({ children }: { children: ReactNode; why?: ReactNode }) {
  // PStep is a data carrier; rendering happens inside <Proof>
  return <>{children}</>;
}

export function Proof({ children, qed = true }: { children: ReactNode; qed?: boolean }) {
  const steps = (Array.isArray(children) ? children : [children]).flat().filter(Boolean) as {
    props: { children: ReactNode; why?: ReactNode };
  }[];
  // null = alle Schritte sichtbar; sonst Anzahl aufgedeckter Schritte
  const [shown, setShown] = useState<number | null>(null);
  const visible = shown === null ? steps.length : shown;

  return (
    <div className="my-4 rounded-r-md border-l-4 border-slate-300 bg-slate-50/60 px-4 py-2 dark:border-slate-600 dark:bg-slate-800/30">
      <div className="mb-1 flex items-center gap-3">
        <span className="font-semibold italic">Beweis.</span>
        <button
          type="button"
          className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          onClick={() => setShown(shown === null ? 0 : null)}
        >
          {shown === null ? "Schritt für Schritt" : "kompletten Beweis zeigen"}
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
          nächster Schritt ({visible}/{steps.length})
        </button>
      )}
      {visible === steps.length && qed && (
        <div className="text-right text-slate-500" aria-label="Beweisende">
          ∎
        </div>
      )}
    </div>
  );
}
