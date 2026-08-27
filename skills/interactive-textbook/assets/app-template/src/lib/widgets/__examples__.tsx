/**
 * Getippte Verwendungsbeispiele für die Widget-Bausteine aus diesem Ordner.
 *
 * Diese Datei wird von NIEMANDEM importiert; sie existiert, damit `tsc` die
 * Aufrufformen mitprüft und Kapitel-Agenten ein kompilierendes Muster zum
 * Abschreiben haben (README-widgets.md erklärt die Regeln dazu).
 */
import { useMemo, useState } from "react";
import { Aufgabe } from "./Aufgabe";
import { Schaetzfrage } from "./Schaetzfrage";
import { Stepper } from "./Stepper";
import { Verdikt } from "./Verdikt";
import { DragHandle, useDrag, type Punkt } from "./useDrag";
import { useAnimatedMatrix, useAnimatedValue } from "./useAnimatedValue";
import { clamp, FMM_COLORS, fmtDe } from "./util";

const PAD_L = 34;
const SIZE = 240;
const FELD = { x0: PAD_L, y0: 0, w: SIZE, h: SIZE };
const WELT = { x0: -3, x1: 3, y0: -3, y1: 3 };

/** Muster 2: Punkt ziehen, Doppelpfad über zwei Regler, Verdikt darunter. */
export function BeispielZiehen() {
  const [p, setP] = useState<Punkt>([1, 0.5]);
  const zieh = useDrag<"p">({
    feld: FELD,
    welt: WELT,
    clamp: ([x, y]) => [clamp(x, -3, 3), clamp(y, -3, 3)],
    greifPosition: () => p,
    onDrag: (q) => setP(q),
  });
  const px = (x: number) => PAD_L + ((x - WELT.x0) / (WELT.x1 - WELT.x0)) * SIZE;
  const py = (y: number) => SIZE - ((y - WELT.y0) / (WELT.y1 - WELT.y0)) * SIZE;

  return (
    <div>
      <Aufgabe>Ziehen wir den Punkt und beobachten seine Norm.</Aufgabe>
      <svg
        viewBox={`0 0 ${PAD_L + SIZE} ${SIZE}`}
        className="max-w-full h-auto"
        role="img"
        aria-label="Ein ziehbarer Punkt in der Ebene."
        {...zieh.svgProps}
      >
        <rect x={PAD_L} y={0} width={SIZE} height={SIZE} fill="var(--w-bg)" stroke="var(--w-border)" />
        <DragHandle
          x={px(p[0])}
          y={py(p[1])}
          farbe={FMM_COLORS.blau}
          aktiv={zieh.dragging === "p"}
          label="x"
          {...zieh.handleProps("p")}
        />
      </svg>
      <Verdikt kind="ok" titel="Norm:">
        ‖x‖₂ = {fmtDe(Math.hypot(p[0], p[1]))}
      </Verdikt>
    </div>
  );
}

/** Muster 7: deterministischer Zustand aus dem Schrittindex. */
export function BeispielStepper() {
  const [k, setK] = useState(0);
  const wert = useMemo(() => 2 ** -k, [k]);
  return (
    <Stepper
      step={k}
      setStep={setK}
      max={6}
      playable
      narration={<>Nach Schritt {k} ist der Fehler {fmtDe(wert, 4)}.</>}
    />
  );
}

/** Muster 1: erst tippen, dann auflösen — hier mit verdeckter Zusatztafel. */
export function BeispielSchaetzfrage() {
  return (
    <Schaetzfrage
      frage={<>Um welchen Faktor sinkt der Fehler, wenn wir h halbieren?</>}
      variante="auswahl"
      optionen={[
        { id: "2", text: "Faktor 2" },
        { id: "4", text: "Faktor 4" },
        { id: "8", text: "Faktor 8" },
      ]}
      loesung="4"
      verdeckt={<p className="text-sm">Die Restterme stehen jetzt in der Tabelle.</p>}
    >
      <p className="text-sm">(hier stünde das Widget)</p>
    </Schaetzfrage>
  );
}

/** Render-Prop-Form: das Widget nimmt den Tipp selbst entgegen. */
export function BeispielKlickSchaetzung() {
  return (
    <Schaetzfrage variante="klick" frage="Wo liegt das Minimum?" loesung={1.37} toleranz={0.15}>
      {({ aufgeloest, guess, setGuess }) => (
        <button type="button" className="text-sm underline" onClick={() => setGuess(1.2)}>
          Tipp setzen (aktuell {typeof guess === "number" ? fmtDe(guess) : "–"}
          {aufgeloest ? ", aufgelöst" : ""})
        </button>
      )}
    </Schaetzfrage>
  );
}

/** Übergänge nur für diskrete Sprünge (Preset-Wechsel). */
export function BeispielAnimation({ preset }: { preset: 0 | 1 }) {
  const winkel = useAnimatedValue(preset === 0 ? 0 : 45);
  const [a, b] = useAnimatedValue(preset === 0 ? [1, 0] : [0.5, 1.5]);
  const M = useAnimatedMatrix(
    preset === 0
      ? [
          [1, 0],
          [0, 1],
        ]
      : [
          [2, 0.5],
          [0, 0.5],
        ],
  );
  return (
    <p className="text-sm">
      {fmtDe(winkel, 0)}° · {fmtDe(a)} / {fmtDe(b)} · {fmtDe(M[0][0])}
    </p>
  );
}
