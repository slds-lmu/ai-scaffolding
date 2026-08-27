/**
 * Aufgabe — die eine Handlungsanweisung am Widget.
 *
 *   <Aufgabe>Ziehen wir x auf die Antidiagonale und lesen κ ab.</Aufgabe>
 *
 * Widget-interne Prosa ist auf drei Dinge beschränkt (craft.md): diese eine
 * Zeile, die Legende und das <Verdikt>. Motivation gehört in den Absatz DAVOR,
 * die Auflösung in den Absatz DANACH — sonst steht das Ergebnis als Spoiler
 * über dem Widget. Ton: Wir-Form (STYLE.md), kein „Sie", kein „du".
 */
import type { ReactNode } from "react";
import { W_MUTED } from "./surface";

export function Aufgabe({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`my-1 max-w-prose text-sm italic ${W_MUTED} ${className}`}>
      <span aria-hidden="true" className="mr-1 not-italic">
        ▸
      </span>
      {children}
    </p>
  );
}
