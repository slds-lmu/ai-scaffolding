/**
 * Gemeinsame Hilfen für alle Widgets (Kapitel- und Konzeptschicht).
 *
 * - FMM_COLORS: die Okabe-Ito-basierte Kurspalette, identisch zu den
 *   Mathe-Makros \cbblue/\cbgreen/\cbred/\cborange/\cbpurp (src/fmm-macros.ts).
 *   Eine Farbe = eine mathematische Rolle; die Rollen legt jedes Kapitel im
 *   Widget-Header fest.
 * - fmtDe: deutsche Dezimalzahl mit echtem Minus, „–" für NaN, „∞" für ±∞.
 * - mulberry32 / useSeed: geseedeter Zufall (nie nacktes Math.random).
 * - niceTicks / sigmaMax / maxAbsCoord: Achsen- und Fensterhelfer
 *   (aus Axes.tsx hierher gezogen; Axes.tsx re-exportiert sie).
 */
import { useCallback, useState } from "react";

export const FMM_COLORS = {
  blau: "#0072B2",
  gruen: "#009E73",
  rot: "#D55E00",
  orange: "#E69F00",
  violett: "#9E57D5",
  grau: "#6b7280",
  hellgrau: "#cbd5e1",
} as const;

/** Deutsche Dezimalzahl; unterscheidet undefiniert (–) von unendlich (∞). */
export function fmtDe(v: number, d = 2): string {
  if (Number.isNaN(v)) return "–";
  if (!Number.isFinite(v)) return v > 0 ? "∞" : "−∞";
  const s = v.toFixed(d);
  const t = Number(s) === 0 ? (0).toFixed(d) : s;
  return t.replace(".", ",").replace(/^-/, "−");
}

/**
 * Locale-generic variant: same rules as fmtDe (real minus sign, „–" for NaN,
 * „∞" for ±∞), decimal separator chosen by locale. `fmtDe` stays the
 * German default used inside the library; English projects pass
 * `fmt={fmtEn}` to Slider/Schaetzfrage/Zahlfrage or wrap `makeFmt("en")`.
 */
export function makeFmt(locale: "de" | "en"): (v: number, d?: number) => string {
  if (locale === "de") return fmtDe;
  return (v: number, d = 2): string => {
    if (Number.isNaN(v)) return "–";
    if (!Number.isFinite(v)) return v > 0 ? "∞" : "−∞";
    const s = v.toFixed(d);
    const t = Number(s) === 0 ? (0).toFixed(d) : s;
    return t.replace(/^-/, "−");
  };
}

/** English decimal number (decimal point); otherwise identical to fmtDe. */
export const fmtEn = makeFmt("en");

/** Ganzzahl mit deutschem Tausenderpunkt. */
export function fmtInt(v: number): string {
  if (!Number.isFinite(v)) return fmtDe(v, 0);
  const r = Math.round(v);
  return (Object.is(r, -0) ? 0 : r).toLocaleString("de-DE").replace(/^-/, "−");
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Sinnvolle Zahl von Nachkommastellen für einen Regler-Schritt.
 *
 * Binär dargestellte Brüche wie 1 / 30 dürfen den Readout nicht mit den
 * Artefakten von String(step) aufblasen. Vier Stellen reichen für einen
 * lesbaren Reglerwert; feinere Darstellungen geben Aufrufer explizit mit
 * `fmt` an.
 */
export function decimalsFromStep(step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 2;
  let decimals = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  while (decimals < 4 && Math.abs(step * 10 ** decimals - Math.round(step * 10 ** decimals)) > 1e-9) {
    decimals += 1;
  }
  return Math.min(decimals, 4);
}

/** Platzierung eines SVG-Labels auf der vom Ursprung abgewandten Seite. */
export function labelPlacement(x: number, originX: number, gap = 6): { x: number; textAnchor: "start" | "end" } {
  const linksVomUrsprung = x > originX;
  return {
    x: x + (linksVomUrsprung ? -gap : gap),
    textAnchor: linksVomUrsprung ? "end" : "start",
  };
}

/** Deterministischer Zufallsgenerator (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standardnormalverteilte Zufallszahl (Box–Muller) aus einem mulberry32-Generator. */
export function randn(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Seed im State + „neue Stichprobe"-Funktion; der Default-Seed ist kuratiert. */
export function useSeed(initial = 1): { seed: number; neueStichprobe: () => void; setSeed: (s: number) => void } {
  const [seed, setSeed] = useState(initial);
  const neueStichprobe = useCallback(() => setSeed((s) => s + 1), []);
  return { seed, neueStichprobe, setSeed };
}

/** „Schöne" Tick-Positionen, die [a, b] überdecken. */
export function niceTicks(a: number, b: number, target = 5): number[] {
  if (!(b > a)) return [];
  const raw = (b - a) / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = mag * (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10);
  const ticks: number[] = [];
  for (let t = Math.ceil(a / step) * step; t <= b + step * 1e-6; t += step) {
    ticks.push(Math.abs(t) < step * 1e-6 ? 0 : t);
  }
  return ticks;
}

/**
 * Tick-Beschriftung im deutschen Format. `step` (Tick-Abstand) bestimmt die
 * Nachkommastellen; ohne `step` werden sehr kleine Werte mit zwei
 * signifikanten Stellen statt als „0,00" geschrieben.
 */
export function fmtTick(t: number, step?: number): string {
  if (step !== undefined && step > 0) {
    // Nicht die Zehnerpotenz der Schrittweite zaehlt, sondern wie viele Stellen
    // die Schrittweite SELBST braucht: bei step = 0,25 liefert -log10 nur eine
    // Stelle und 0,25 wuerde als "0,3" beschriftet. Also so lange erhoehen, bis
    // step * 10^d (nahezu) ganzzahlig ist.
    let d = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
    while (d < 8 && Math.abs(step * 10 ** d - Math.round(step * 10 ** d)) > 1e-9) d += 1;
    return fmtDe(t, Math.min(d, 8));
  }
  const a = Math.abs(t);
  if (t === 0) return "0";
  if (a >= 100 || Number.isInteger(t)) return fmtInt(t);
  if (a < 0.005) {
    const rounded = Number(t.toPrecision(2));
    let d = 0;
    while (d < 8 && Math.abs(rounded * 10 ** d - Math.round(rounded * 10 ** d)) > 1e-9) d += 1;
    return fmtDe(rounded, d);
  }
  const s = a >= 10 ? t.toFixed(0) : a >= 1 ? t.toFixed(1).replace(/\.0$/, "") : t.toFixed(2).replace(/0$/, "");
  return s.replace(".", ",").replace(/^-/, "−");
}

/** Größter Singulärwert einer 2x2-Matrix (wie weit der Einheitskreis gestreckt wird). */
export function sigmaMax(m: [[number, number], [number, number]]): number {
  const [[a, b], [c, d]] = m;
  const T = a * a + b * b + c * c + d * d;
  const det = a * d - b * c;
  return Math.sqrt((T + Math.sqrt(Math.max(0, T * T - 4 * det * det))) / 2);
}

/** Größte |Koordinate| über eine Liste von 2-Vektoren. */
export function maxAbsCoord(...vs: [number, number][]): number {
  let m = 0;
  for (const [x, y] of vs) m = Math.max(m, Math.abs(x), Math.abs(y));
  return m;
}
