/**
 * useAnimatedValue — weiche Übergänge für DISKRETE Sprünge.
 *
 * Regel aus design-patterns.md (Muster 12): kontinuierliche Regler brauchen
 * keine Animation, das Ziehen IST die Animation. Ein Preset-Wechsel oder ein
 * Umschalter dagegen springt hart, und die Zuordnung zwischen Vorher und
 * Nachher geht verloren. Genau dafür ist dieser Hook da: ~250 ms ease-in-out
 * auf dem Zahlenwert, danach läuft nichts mehr.
 *
 *   const gezeigt = useAnimatedValue(ziel);              // eine Zahl
 *   const [a, b]  = useAnimatedValue([za, zb]);          // mehrere Zahlen
 *   const M       = useAnimatedMatrix(matrix);           // 2x2
 *
 * Eigenschaften:
 *  - Im Ruhezustand läuft KEIN requestAnimationFrame (craft.md: „idle widgets
 *    must be truly idle"). Der Loop startet beim Zielwechsel und endet mit ihm.
 *  - `prefers-reduced-motion: reduce` schaltet auf Sofortsprung um.
 *  - Ändert sich die Länge des Arrays, wird ebenfalls sofort gesprungen
 *    (zwischen 2 und 3 Werten gibt es keine sinnvolle Interpolation).
 *  - Wer während einer laufenden Animation das Ziel erneut ändert, bekommt
 *    einen Übergang vom AKTUELL gezeigten Wert aus, kein Zurückspringen.
 */
import { useEffect, useRef, useState } from "react";

export type Easing = (u: number) => number;

/** kubisches ease-in-out (Standard) */
export const easeInOut: Easing = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
export const linear: Easing = (u) => u;

function reduzierteBewegung(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function useAnimatedArray(ziel: number[], ms: number, easing: Easing): number[] {
  const [wert, setWert] = useState<number[]>(ziel);
  const wertRef = useRef<number[]>(ziel);
  const zielRef = useRef<number[]>(ziel);
  const easingRef = useRef<Easing>(easing);
  const msRef = useRef<number>(ms);
  easingRef.current = easing;
  msRef.current = ms;
  const rafRef = useRef<number | null>(null);
  const schluessel = ziel.join("|");

  useEffect(() => {
    zielRef.current = ziel;
    const z = zielRef.current;
    const von = wertRef.current;
    const ms = msRef.current;
    const easing = easingRef.current;
    const sofort = ms <= 0 || von.length !== z.length || reduzierteBewegung();
    if (sofort) {
      wertRef.current = z;
      setWert(z);
      return;
    }
    if (von.every((v, i) => Math.abs(v - z[i]) < 1e-12)) return;

    const t0 = performance.now();
    const schritt = (jetzt: number) => {
      const u = Math.min(1, (jetzt - t0) / ms);
      const e = easing(u);
      const neu = von.map((v, i) => v + (z[i] - v) * e);
      wertRef.current = u < 1 ? neu : z;
      setWert(wertRef.current);
      rafRef.current = u < 1 ? requestAnimationFrame(schritt) : null;
    };
    rafRef.current = requestAnimationFrame(schritt);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // schluessel steht für den Inhalt von ziel (Array-Identität wechselt pro Render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);

  return wert;
}

/** Weicher Übergang auf einen neuen Zielwert (bzw. auf einen neuen Zielvektor). */
export function useAnimatedValue(ziel: number, ms?: number, easing?: Easing): number;
export function useAnimatedValue(ziel: number[], ms?: number, easing?: Easing): number[];
export function useAnimatedValue(
  ziel: number | number[],
  ms = 250,
  easing: Easing = easeInOut,
): number | number[] {
  const alsArray = typeof ziel === "number" ? [ziel] : ziel;
  const animiert = useAnimatedArray(alsArray, ms, easing);
  return typeof ziel === "number" ? (animiert[0] ?? ziel) : animiert;
}

export type Mat2 = [[number, number], [number, number]];

/** Bequemlichkeit für 2x2-Matrizen (Basiswechsel, Preset-Wechsel im TransformCanvas). */
export function useAnimatedMatrix(ziel: Mat2, ms = 250, easing: Easing = easeInOut): Mat2 {
  const flach = useAnimatedArray(
    [ziel[0][0], ziel[0][1], ziel[1][0], ziel[1][1]],
    ms,
    easing,
  );
  return [
    [flach[0], flach[1]],
    [flach[2], flach[3]],
  ];
}
