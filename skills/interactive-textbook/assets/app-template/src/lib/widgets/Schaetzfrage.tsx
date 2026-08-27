/**
 * Schaetzfrage — „erst tippen, dann auflösen" (predict-then-reveal).
 *
 * Muster 1 aus design-patterns.md, im ganzen Skript bisher null Mal umgesetzt.
 * Wer vor dem Blick auf die Antwort eine Vermutung abgibt, behält das Ergebnis
 * messbar besser (Kim, Reinecke & Hullman, CHI 2017). Die Hülle verwaltet nur
 * die Phase, den Tipp und den Abgleich; das Widget bleibt das Widget.
 *
 * Gegenmuster, das sie ersetzt: ein Absatz über dem Widget, der das Ergebnis
 * schon verrät („ab γ = 2 divergiert die Iteration"). Solche Sätze wandern in
 * die Auflösung.
 *
 * ── Beispiel 1: Zahl schätzen, verdeckte Marke erst nach dem Auflösen ────────
 *
 *   <Schaetzfrage
 *     frage={<>Ab welchem γ divergiert die Iteration?</>}
 *     loesung={2}
 *     toleranz={0.2}
 *     einheit="γ"
 *     verdeckt={<p>Die gestrichelte Linie sitzt jetzt bei γ = 2.</p>}
 *   >
 *     <MeinPlot />
 *   </Schaetzfrage>
 *
 * ── Beispiel 2: Klick ins eigene Bild (Render-Prop) ──────────────────────────
 *
 *   <Schaetzfrage variante="klick" frage="Wo liegt das Minimum?" loesung={1.37} toleranz={0.15}>
 *     {({ aufgeloest, guess, setGuess }) => (
 *       <MeinPlot
 *         markeGetippt={typeof guess === "number" ? guess : undefined}
 *         markeWahr={aufgeloest ? 1.37 : undefined}
 *         onKlick={(x) => setGuess(x)}
 *       />
 *     )}
 *   </Schaetzfrage>
 *
 * Varianten: „zahl" (Eingabefeld, Default), „auswahl" (2–4 Knöpfe),
 * „bereich" (Regler), „klick" (das Widget selbst nimmt den Tipp entgegen).
 * Alle sichtbaren Texte sind über `labels` lokalisierbar; Defaults deutsch,
 * Wir-Form (STYLE.md).
 */
import { useState, type ReactNode } from "react";
import { fmtDe } from "./util";
import { Verdikt } from "./Verdikt";
import { W_BUTTON, W_BUTTON_AKTIV, W_INPUT, W_MUTED, W_PANEL, W_TEXT } from "./surface";

export type Schaetzwert = number | string;
export type SchaetzPhase = "tippen" | "aufgeloest";

export interface SchaetzZustand {
  phase: SchaetzPhase;
  /** Kurzform für phase === "aufgeloest" */
  aufgeloest: boolean;
  guess: Schaetzwert | null;
  setGuess: (v: Schaetzwert | null) => void;
}

export type SchaetzOption = string | { id: string; text: ReactNode };

export interface SchaetzfrageLabels {
  aufloesen: string;
  nochmal: string;
  geschaetzt: string;
  tatsaechlich: string;
  abweichung: string;
  hinweis: string;
  hinweisKlick: string;
  richtig: string;
  daneben: string;
}

const DEFAULT_LABELS: SchaetzfrageLabels = {
  aufloesen: "Reveal",
  nochmal: "Again",
  geschaetzt: "Your guess",
  tatsaechlich: "Actual",
  abweichung: "Deviation",
  hinweis: "Guess first, then reveal.",
  hinweisKlick: "Place your guess in the figure, then reveal.",
  richtig: "Good guess.",
  daneben: "Off the mark.",
};

function optionId(o: SchaetzOption): string {
  return typeof o === "string" ? o : o.id;
}
function optionText(o: SchaetzOption): ReactNode {
  return typeof o === "string" ? o : o.text;
}

export function Schaetzfrage({
  frage,
  variante = "zahl",
  loesung,
  optionen,
  toleranz,
  einheit,
  fmt = (v: number) => fmtDe(v, 2),
  min = 0,
  max = 10,
  schritt = 0.1,
  start,
  auswertung,
  verdeckt,
  labels,
  onAufloesen,
  className = "",
  children,
}: {
  /** die Frage; steht ÜBER dem Widget und verrät nichts */
  frage: ReactNode;
  variante?: "zahl" | "auswahl" | "bereich" | "klick";
  /** wahrer Wert (Zahl) bzw. id der richtigen Option */
  loesung: Schaetzwert;
  /** nur für „auswahl": 2–4 Optionen */
  optionen?: SchaetzOption[];
  /** ab welcher Abweichung der Tipp noch als getroffen gilt */
  toleranz?: number;
  einheit?: string;
  fmt?: (v: number) => string;
  /** nur für „bereich" (und als Grenzen des Zahlenfelds) */
  min?: number;
  max?: number;
  schritt?: number;
  /** Startwert des Reglers; Default ist die Mitte von [min, max] */
  start?: number;
  /** eigenes Verdikt statt des Standardabgleichs (gern ein <Verdikt> zurückgeben) */
  auswertung?: (guess: Schaetzwert, loesung: Schaetzwert) => ReactNode;
  /** erscheint erst nach dem Auflösen (Marke, Zusatztafel, Zahlenreihe) */
  verdeckt?: ReactNode;
  labels?: Partial<SchaetzfrageLabels>;
  onAufloesen?: (guess: Schaetzwert | null) => void;
  className?: string;
  /** das Widget; als Funktion aufgerufen bekommt es den Schätzzustand */
  children?: ReactNode | ((z: SchaetzZustand) => ReactNode);
}) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const startwert = start ?? (min + max) / 2;
  const [phase, setPhase] = useState<SchaetzPhase>("tippen");
  const [guess, setGuess] = useState<Schaetzwert | null>(
    null, // auch bei "bereich": erst eine echte Bewegung zählt als Schätzung
  );
  // Zahlenfeld hält einen STRING (craft.md): sonst werden "" und "−" zu 0 und
  // negative oder halbfertige Eingaben lassen sich gar nicht tippen.
  const [text, setText] = useState("");

  const aufgeloest = phase === "aufgeloest";
  const zustand: SchaetzZustand = { phase, aufgeloest, guess, setGuess };

  const zahlAus = (s: string): number | null => {
    const v = Number(s.trim().replace(/,/g, ".").replace(/−/g, "-"));
    return s.trim() !== "" && Number.isFinite(v) ? v : null;
  };

  const aufloesen = () => {
    setPhase("aufgeloest");
    onAufloesen?.(guess);
  };
  const zuruecksetzen = () => {
    setPhase("tippen");
    setGuess(null);
    setText("");
  };

  const zahl = typeof guess === "number" ? guess : null;
  const wahr = typeof loesung === "number" ? loesung : null;
  const delta = zahl !== null && wahr !== null ? zahl - wahr : null;
  const getroffen =
    variante === "auswahl"
      ? guess !== null && guess === loesung
      : delta !== null && toleranz !== undefined
        ? Math.abs(delta) <= toleranz
        : null;

  const mitEinheit = (s: string) => (einheit ? `${s} ${einheit}` : s);
  /** Tipp bzw. Lösung lesbar: Zahl mit Einheit, Option mit ihrem Text. */
  const alsKnoten = (v: Schaetzwert | null): ReactNode => {
    if (v === null) return "–";
    if (typeof v === "number") return mitEinheit(fmt(v));
    const o = optionen?.find((x) => optionId(x) === v);
    return o ? optionText(o) : v;
  };

  /* ------------------------------------------------------------- Eingabe */
  let eingabe: ReactNode = null;
  if (variante === "auswahl") {
    eingabe = (
      <div className="flex flex-wrap gap-2" role="group">
        {(optionen ?? []).map((o) => {
          const id = optionId(o);
          const gewaehlt = guess === id;
          const istLoesung = aufgeloest && id === loesung;
          return (
            <button
              key={id}
              type="button"
              className={gewaehlt || istLoesung ? W_BUTTON_AKTIV : W_BUTTON}
              aria-pressed={gewaehlt}
              disabled={aufgeloest}
              onClick={() => setGuess(id)}
            >
              {istLoesung && <span aria-hidden="true">✓ </span>}
              {aufgeloest && gewaehlt && !istLoesung && <span aria-hidden="true">✗ </span>}
              {optionText(o)}
            </button>
          );
        })}
      </div>
    );
  } else if (variante === "zahl") {
    eingabe = (
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <input
          type="text"
          inputMode="decimal"
          className={`w-24 font-mono ${W_INPUT}`}
          value={text}
          disabled={aufgeloest}
          aria-label={L.geschaetzt}
          onChange={(e) => {
            setText(e.target.value);
            setGuess(zahlAus(e.target.value));
          }}
        />
        {einheit && <span className={W_MUTED}>{einheit}</span>}
      </label>
    );
  } else if (variante === "bereich") {
    eingabe = (
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <input
          type="range"
          className="grow accent-sky-600"
          min={min}
          max={max}
          step={schritt}
          value={zahl ?? startwert}
          disabled={aufgeloest}
          aria-label={L.geschaetzt}
          onChange={(e) => setGuess(Number(e.target.value))}
        />
        <span className="w-20 shrink-0 font-mono text-xs">
          {zahl === null ? "–" : mitEinheit(fmt(zahl))}
        </span>
      </label>
    );
  } else {
    eingabe = (
      <p className={`text-sm ${W_MUTED}`}>
        {guess === null ? (
          L.hinweisKlick
        ) : (
          <>
            {L.geschaetzt}: {alsKnoten(guess)}
          </>
        )}
      </p>
    );
  }

  /* ------------------------------------------------------------- Verdikt */
  let ergebnis: ReactNode = null;
  if (aufgeloest) {
    if (auswertung) {
      ergebnis = guess === null ? null : auswertung(guess, loesung);
    } else if (getroffen === null) {
      ergebnis = (
        <Verdikt kind="neutral">
          {L.tatsaechlich}: {alsKnoten(loesung)}
          {delta !== null && (
            <>
              {" — "}
              {L.abweichung} {mitEinheit(fmt(Math.abs(delta)))}
            </>
          )}
        </Verdikt>
      );
    } else {
      ergebnis = (
        <Verdikt kind={getroffen ? "ok" : "warn"}>
          {getroffen ? L.richtig : L.daneben} {L.tatsaechlich}: {alsKnoten(loesung)}.
        </Verdikt>
      );
    }
  }

  return (
    <div className={`my-3 space-y-2 ${className}`}>
      <p className={`max-w-prose text-sm font-medium ${W_TEXT}`}>{frage}</p>

      {typeof children === "function" ? children(zustand) : children}

      {aufgeloest && verdeckt}

      <div className={`max-w-prose space-y-2 p-3 ${W_PANEL}`}>
        {eingabe}
        <div className="flex flex-wrap items-center gap-3">
          {!aufgeloest ? (
            <button
              type="button"
              className={W_BUTTON}
              disabled={guess === null}
              onClick={aufloesen}
            >
              {L.aufloesen}
            </button>
          ) : (
            <button type="button" className={W_BUTTON} onClick={zuruecksetzen}>
              {L.nochmal}
            </button>
          )}
          {aufgeloest && (
            <span className={`font-mono text-xs ${W_MUTED}`}>
              {L.geschaetzt} {alsKnoten(guess)} · {L.tatsaechlich} {alsKnoten(loesung)}
              {delta !== null && (
                <>
                  {" · "}
                  {L.abweichung} {mitEinheit(fmt(Math.abs(delta)))}
                  {wahr !== null && Math.abs(wahr) > 1e-12 && (
                    <> ({fmtDe((100 * Math.abs(delta)) / Math.abs(wahr), 0)} %)</>
                  )}
                </>
              )}
            </span>
          )}
          {!aufgeloest && guess === null && (
            <span className={`text-xs ${W_MUTED}`}>{L.hinweis}</span>
          )}
        </div>
      </div>

      {ergebnis}
    </div>
  );
}

/** Bequemlichkeit: <SchaetzfrageAuswahl frage=… optionen={…} loesung="b" /> */
export function SchaetzfrageAuswahl(props: Omit<Parameters<typeof Schaetzfrage>[0], "variante">) {
  return <Schaetzfrage {...props} variante="auswahl" />;
}
