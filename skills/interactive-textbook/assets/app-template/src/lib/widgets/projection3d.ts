/**
 * Rechenkern für `Surface3D`: Projektion, Beleuchtung, Höhenlinien.
 *
 * Einsicht (die die Komponente tragen soll): Eine Fläche über der Ebene ist
 * dasselbe Objekt wie ihre Höhenlinientafel — nur aus einer anderen Richtung
 * angesehen. Dieser Rechenkern liefert dafür die Abbildung Welt → Bildebene.
 *
 * Verfahren: orthographische Projektion mit Kamerarichtung aus Azimut und
 * Höhenwinkel, optional ein Perspektivfaktor. Die Kamerabasis ist
 *
 *   d = (cos e cos a, cos e sin a, sin e)   Blickrichtung (zur Kamera hin)
 *   r = (−sin a, cos a, 0)                  Bildschirm-x
 *   u = d × r = (−sin e cos a, −sin e sin a, cos e)   Bildschirm-y
 *
 * also bei e = 0 genau „z zeigt nach oben". `depth = d · p` wächst zur Kamera
 * hin und ist der Sortierschlüssel des Malerverfahrens.
 *
 * Die Höhenlinien folgen dem Dreiecksverfahren aus
 * `src/chapters/10-differentialrechnung/widgets/S108Kontur.ts` (jede Gitterzelle wird
 * in zwei Dreiecke zerlegt): anders als beim üblichen Marching-Squares gibt es
 * damit keine mehrdeutigen Sattelzellen. Der Code ist hier neu geschrieben,
 * weil die Bibliothek nicht aus einem Kapitel importieren darf.
 *
 * Alles ist deterministisch und frei von Zufall (kein Math.random).
 * PRÜFSTATUS (historische Notiz, 2026-08-19): Das ursprüngliche Skript ist nicht mehr vorhanden; die folgenden Zahlen sind derzeit nicht reproduzierbar nachgewiesen (Kamerabasis
 * orthonormal und rechtshändig für 96 Winkelpaare; Projektion der acht
 * Würfelecken bei (Azimut 35°, Höhe 25°) gegen die Handrechnung; Normalen der
 * Fläche z = ½(2x² + 8y²) gegen den analytischen Gradienten auf 1e−6).
 */

export type Vec3 = [number, number, number];

export interface Projected {
  /** Bildschirm-x in Weltmaßen (noch nicht in Pixel skaliert) */
  x: number;
  /** Bildschirm-y in Weltmaßen, positiv = oben */
  y: number;
  /** Tiefe: größer = näher an der Kamera */
  depth: number;
}

export type Projector = (p: Vec3) => Projected;

export const rad = (grad: number) => (grad * Math.PI) / 180;

/** Orthonormale Kamerabasis (Blickrichtung, Bildschirm-x, Bildschirm-y). */
export function kamerabasis(azimutGrad: number, hoeheGrad: number): { d: Vec3; r: Vec3; u: Vec3 } {
  const a = rad(azimutGrad);
  const e = rad(hoeheGrad);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const ce = Math.cos(e);
  const se = Math.sin(e);
  return {
    d: [ce * ca, ce * sa, se],
    r: [-sa, ca, 0],
    u: [-se * ca, -se * sa, ce],
  };
}

/**
 * Projektor für die gegebene Kamera. `perspektive` = 0 ist orthographisch;
 * Werte bis 0,6 ziehen nahe Punkte auseinander (Kameraabstand 2,5).
 */
export function machProjektor(azimutGrad: number, hoeheGrad: number, perspektive = 0): Projector {
  const { d, r, u } = kamerabasis(azimutGrad, hoeheGrad);
  const q = Math.min(0.6, Math.max(0, perspektive));
  return (p: Vec3) => {
    const depth = d[0] * p[0] + d[1] * p[1] + d[2] * p[2];
    const k = q > 0 ? 1 / Math.max(0.35, 1 - (q * depth) / 2.5) : 1;
    return {
      x: k * (r[0] * p[0] + r[1] * p[1] + r[2] * p[2]),
      y: k * (u[0] * p[0] + u[1] * p[1] + u[2] * p[2]),
      depth,
    };
  };
}

/** Die acht Ecken des Quaders [−1,1] × [−1,1] × [−h,h]. */
export function quaderEcken(h: number): Vec3[] {
  const ecken: Vec3[] = [];
  for (const z of [-h, h]) for (const y of [-1, 1]) for (const x of [-1, 1]) ecken.push([x, y, z]);
  return ecken;
}

/** Normierte Flächennormale eines (fast ebenen) Vierecks, z-Komponente ≥ 0. */
export function vierecksNormale(a: Vec3, b: Vec3, c: Vec3, d: Vec3): Vec3 {
  const u: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const v: Vec3 = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
  let n: Vec3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(n[0], n[1], n[2]);
  if (l < 1e-12) return [0, 0, 1];
  n = [n[0] / l, n[1] / l, n[2] / l];
  return n[2] < 0 ? [-n[0], -n[1], -n[2]] : n;
}

/* --------------------------------------------------------------- Farben */

function hexZuRgb(hex: string): [number, number, number] {
  const s = hex.replace("#", "");
  const v =
    s.length === 3
      ? s
          .split("")
          .map((c) => c + c)
          .join("")
      : s;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const zuHex = (c: number) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0");

/** Farbe mit einem Faktor multiplizieren (Lambert-Schattierung). */
export function schattiere(hex: string, faktor: number): string {
  const [r, g, b] = hexZuRgb(hex);
  return `#${zuHex(r * faktor)}${zuHex(g * faktor)}${zuHex(b * faktor)}`;
}

/** Lineare Mischung zweier Farben, t = 0 gibt a, t = 1 gibt b. */
export function mischeFarben(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexZuRgb(a);
  const [r2, g2, b2] = hexZuRgb(b);
  const m = (x: number, y: number) => x + (y - x) * t;
  return `#${zuHex(m(r1, r2))}${zuHex(m(g1, g2))}${zuHex(m(b1, b2))}`;
}

/**
 * Lambert-Anteil einer Normalen zur festen Lichtrichtung (links oben vorn).
 * Ergebnis liegt in [0,55; 1,05] und bleibt damit in beiden Themes lesbar.
 */
const LICHT: Vec3 = (() => {
  const l: Vec3 = [-0.45, -0.6, 0.75];
  const n = Math.hypot(l[0], l[1], l[2]);
  return [l[0] / n, l[1] / n, l[2] / n];
})();

export function lambert(n: Vec3): number {
  const d = n[0] * LICHT[0] + n[1] * LICHT[1] + n[2] * LICHT[2];
  return 0.55 + 0.5 * Math.max(0, d);
}

/* ---------------------------------------------------------- Höhenlinien */

export interface Segment2 {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Höhenlinie zum Niveau auf einem Wertegitter (Dreieckszerlegung, siehe
 * Kopfkommentar). `x` und `y` sind die Stützstellen, `v[i][j] = f(x[i], y[j])`.
 */
export function hoehenlinie(x: number[], y: number[], v: number[][], niveau: number): Segment2[] {
  const raus: Segment2[] = [];
  const dreieck = (p: [number, number, number][]) => {
    const treffer: [number, number][] = [];
    for (let i = 0; i < 3; i++) {
      const a = p[i];
      const b = p[(i + 1) % 3];
      if (!Number.isFinite(a[2]) || !Number.isFinite(b[2])) return;
      const da = a[2] - niveau;
      const db = b[2] - niveau;
      if ((da <= 0 && db > 0) || (da > 0 && db <= 0)) {
        const t = da / (da - db);
        treffer.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    if (treffer.length === 2) {
      raus.push({ x1: treffer[0][0], y1: treffer[0][1], x2: treffer[1][0], y2: treffer[1][1] });
    }
  };
  for (let i = 0; i + 1 < x.length; i++) {
    for (let j = 0; j + 1 < y.length; j++) {
      const a: [number, number, number] = [x[i], y[j], v[i][j]];
      const b: [number, number, number] = [x[i + 1], y[j], v[i + 1][j]];
      const c: [number, number, number] = [x[i + 1], y[j + 1], v[i + 1][j + 1]];
      const d: [number, number, number] = [x[i], y[j + 1], v[i][j + 1]];
      dreieck([a, b, c]);
      dreieck([a, c, d]);
    }
  }
  return raus;
}
