/**
 * Stepper — Schrittsteuerung für Algorithmus-Widgets.
 *
 * Muster 7 (design-patterns.md): ein Knopf = ein Algorithmusschritt, die
 * Nummerierung stimmt mit dem Algorithmus-Block im Text überein, und der
 * Verlauf ist SCRUBBAR — zurückgehen muss ohne Neustart möglich sein.
 * Play/Pause ist ein Zusatz für lange Läufe, nie der Default.
 *
 * Der Zustand gehört dem Aufrufer: das Widget rechnet seinen Zustand
 * deterministisch aus dem Schrittindex (Muster `12-optim/widgets/S124Bfgs.tsx`),
 * damit Scrubben und Rückwärtsgehen keinen Extra-Code brauchen.
 *
 *   const [k, setK] = useState(0);
 *   const z = useMemo(() => lauf(k), [k]);        // deterministisch aus k
 *   …
 *   <Stepper step={k} setStep={setK} max={6} playable narration={z.text} />
 *
 * Alle sichtbaren Texte sind über `labels` lokalisierbar (Muster wie bei
 * <Quiz>/<Proof>); die Defaults sind deutsch.
 */
import { useEffect, useState, type ReactNode } from "react";
import { W_BUTTON, W_MUTED, W_TEXT } from "./surface";

export interface StepperLabels {
  schritt: string;
  von: string;
  anfang: string;
  zurueck: string;
  vor: string;
  abspielen: string;
  pause: string;
}

const DEFAULT_LABELS: StepperLabels = {
  schritt: "Step",
  von: "of",
  anfang: "Back to start",
  zurueck: "One step back",
  vor: "One step forward",
  abspielen: "Play",
  pause: "Pause",
};

export function Stepper({
  step,
  setStep,
  max,
  min = 0,
  labels,
  narration,
  playable = false,
  speedMs = 700,
  onPlay,
  className = "",
}: {
  step: number;
  setStep: (k: number) => void;
  /** höchster Schrittindex (der Zähler zeigt „Schritt k von max") */
  max: number;
  /** niedrigster Schrittindex, Default 0 = Ausgangslage */
  min?: number;
  labels?: Partial<StepperLabels>;
  /** einzeilige Erläuterung des aktuellen Schritts (Muster 7: Narration) */
  narration?: ReactNode;
  /** Play/Pause anbieten; startet NIE von selbst */
  playable?: boolean;
  speedMs?: number;
  onPlay?: (laeuft: boolean) => void;
  className?: string;
}) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const [laeuft, setLaeuft] = useState(false);

  const spielen = (an: boolean) => {
    setLaeuft(an);
    onPlay?.(an);
  };

  // Kein rAF-Dauerlauf: pro Schritt genau ein Timeout, und nur solange gespielt
  // wird. Am Ende hält der Lauf von selbst an.
  useEffect(() => {
    if (!laeuft) return;
    if (step >= max) {
      setLaeuft(false);
      onPlay?.(false);
      return;
    }
    const t = window.setTimeout(() => setStep(step + 1), speedMs);
    return () => window.clearTimeout(t);
    // setStep/onPlay sind Aufrufer-Callbacks und wechseln pro Render die Identität
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laeuft, step, max, speedMs]);

  const gehe = (k: number) => {
    if (laeuft) spielen(false);
    setStep(Math.max(min, Math.min(max, k)));
  };

  return (
    <div className={`my-2 space-y-1 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={W_BUTTON}
          onClick={() => gehe(min)}
          disabled={step <= min}
          aria-label={L.anfang}
          title={L.anfang}
        >
          ⏮
        </button>
        <button
          type="button"
          className={W_BUTTON}
          onClick={() => gehe(step - 1)}
          disabled={step <= min}
          aria-label={L.zurueck}
          title={L.zurueck}
        >
          ◀
        </button>
        <input
          type="range"
          className="grow accent-sky-600"
          min={min}
          max={max}
          step={1}
          value={step}
          aria-label={L.schritt}
          onChange={(e) => gehe(Number(e.target.value))}
        />
        <button
          type="button"
          className={W_BUTTON}
          onClick={() => gehe(step + 1)}
          disabled={step >= max}
          aria-label={L.vor}
          title={L.vor}
        >
          ▶
        </button>
        {playable && (
          <button
            type="button"
            className={W_BUTTON}
            onClick={() => {
              if (laeuft) {
                spielen(false);
                return;
              }
              // am Ende beginnt „Abspielen" wieder vorn statt gar nichts zu tun
              if (step >= max) setStep(min);
              spielen(true);
            }}
            aria-pressed={laeuft}
            aria-label={laeuft ? L.pause : L.abspielen}
            title={laeuft ? L.pause : L.abspielen}
          >
            {laeuft ? "⏸" : "⏵"}
          </button>
        )}
        <span className={`shrink-0 font-mono text-xs ${W_MUTED}`} aria-live="polite">
          {L.schritt} {step} {L.von} {max}
        </span>
      </div>
      {narration && <p className={`max-w-prose text-sm ${W_TEXT}`}>{narration}</p>}
    </div>
  );
}
