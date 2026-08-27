/**
 * `Surface3D` — Flächenstück über der Ebene als SVG, mit Overlays.
 *
 * EINSICHT, die die Komponente ermöglichen soll: Höhenlinientafel und Fläche
 * sind dasselbe Objekt aus zwei Blickrichtungen. Die 2D-Tafel bleibt deshalb
 * überall die tot lesbare Hauptdarstellung (Architektur-Entscheidung D7); die
 * 3D-Fläche steht daneben und zeigt denselben Punkt, denselben Pfeil, dieselbe
 * Kurve — verlinkt, nicht dekorativ.
 *
 * FARBROLLEN: Die Komponente vergibt keine eigenen Farben. Flächen, Punkte,
 * Pfeile, Kurven und Ebenen bekommen ihre Farbe vom Aufrufer aus `FMM_COLORS`
 * (eine Farbe = eine Rolle je Kapitel); Achsen, Gitter, Text und Hintergrund
 * kommen aus den CSS-Variablen `--w-bg`, `--w-grid`, `--w-grid-strong`,
 * `--w-axis`, `--w-text`, `--w-muted` (D2) und funktionieren damit auch im
 * dunklen Tooltip-Panel `.w-dark`.
 *
 * VERFAHREN: orthographische Projektion (optional mit Perspektivfaktor) aus
 * `projection3d.ts`; die Fläche wird als tiefensortierte Vierecke gezeichnet
 * (Malerverfahren, Sortierschlüssel ist die Tiefe des Viereckmittelpunktes),
 * Lambert-Schattierung aus einer festen Lichtrichtung. Overlays werden in
 * dieselbe Sortierung eingehängt, Beschriftungen liegen darüber. Das Bildfeld
 * wird aus den projizierten Quaderecken automatisch eingepasst, die Fläche
 * kann also nicht aus dem Rahmen laufen.
 *
 * BEDIENUNG (Dualpfad, Regel aus explorable-widgets/craft.md): Ziehen im Bild
 * dreht die Kamera, `<ViewControls>` bietet dieselben zwei Größen als Regler
 * plus Rücksetzknopf. Azimut/Höhe können kontrolliert (`azimuth`, `elevation`,
 * `onViewChange`) oder unkontrolliert (`defaultAzimuth`, `defaultElevation`)
 * geführt werden.
 *
 * VERWENDUNG (der ganze verlinkte 3D-Anbau kostet ~15 Zeilen):
 *
 * ```tsx
 * const [sicht, setSicht] = useState({ azimuth: 38, elevation: 26 });
 * const flaeche = useMemo(
 *   () => ({ f: (x: number, y: number) => 0.5 * (2 * x * x + 8 * y * y),
 *            color: FMM_COLORS.blau, opacity: 0.9, wire: true }),
 *   [],
 * );
 * <Surface3D
 *   size={300}
 *   xDomain={[-2.4, 2.4]} yDomain={[-2.4, 2.4]}
 *   surface={flaeche}
 *   contours={[1, 4, 9]}
 *   points={[{ p: [0, 0, 0], color: FMM_COLORS.violett, label: "x*" }]}
 *   arrows={[{ from: [0, 0, 0], to: [1.7, 0, 0], color: FMM_COLORS.orange, label: "v₁" }]}
 *   dropLines
 *   azimuth={sicht.azimuth} elevation={sicht.elevation} onViewChange={setSicht}
 *   ariaLabel="Fläche über der Ebene, aktuell eine Schale um den Nullpunkt."
 * />
 * <ViewControls value={sicht} onChange={setSicht} />
 * ```
 *
 * WICHTIG: `surface`, `points`, `arrows`, `curves`, `planes` werden über ihre
 * Objektidentität gemerkt (`useMemo`) — im Aufrufer also `useMemo` verwenden,
 * sonst wird das Gitter bei jedem Rendern neu berechnet.
 *
 * PERFORMANCE: Gitter höchstens 40 × 40 (wird hart geklemmt), Geometrie in
 * `useMemo` an Sicht und Eingaben gebunden, keine Animationsschleife.
 *
 * Provenienz: Eigenbau für dieses Skript (Phase-A-Lib, 2026-08-19); Rechenkern
 * und Höhenlinien in `projection3d.ts`, dort auch die per node geprüften Werte
 * (historische Notiz: Das ursprüngliche Skript ist nicht mehr vorhanden; die genannten Zahlen sind derzeit nicht reproduzierbar nachgewiesen, 2026-08-19).
 */
import { useCallback, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Slider } from "./Slider";
import { clamp, fmtTick, niceTicks } from "./util";
import { W_BUTTON } from "./surface";
import {
  hoehenlinie,
  rad,
  lambert,
  machProjektor,
  quaderEcken,
  schattiere,
  vierecksNormale,
  type Vec3,
} from "./projection3d";

export type { Vec3 };

export interface Sicht3D {
  /** Azimut in Grad (Drehung um die z-Achse) */
  azimuth: number;
  /** Höhenwinkel der Kamera in Grad, geklemmt auf [2, 88] */
  elevation: number;
}

export interface Flaeche3D {
  f: (x: number, y: number) => number;
  /** Standard: `xDomain`/`yDomain` der Komponente */
  xDomain?: [number, number];
  yDomain?: [number, number];
  /** Gitterzellen je Richtung, geklemmt auf höchstens 40 */
  nx?: number;
  ny?: number;
  /** feste Farbe oder Farbe als Funktion des Höhenwertes */
  color?: string | ((z: number) => string);
  opacity?: number;
  /** Gitterlinien auf der Fläche (Standard: an) */
  wire?: boolean;
}

export interface Punkt3D {
  p: Vec3;
  color?: string;
  r?: number;
  label?: string;
  /**
   * Immer ÜBER der Fläche zeichnen statt tiefensortiert. Nötig für alles, was
   * auf dem Boden liegt: eine Fläche, die das ganze Fenster überdeckt, verdeckt
   * den Boden aus jeder Blickrichtung von oben vollständig.
   */
  onTop?: boolean;
}

export interface Pfeil3D {
  from: Vec3;
  to: Vec3;
  color?: string;
  label?: string;
  width?: number;
  /** Immer über der Fläche zeichnen (siehe `Punkt3D.onTop`). */
  onTop?: boolean;
}

export interface Kurve3D {
  pts: Vec3[];
  color?: string;
  /** SVG-Strichmuster, z. B. "5 3" */
  dash?: string;
  width?: number;
  /** Immer über der Fläche zeichnen (siehe `Punkt3D.onTop`). */
  onTop?: boolean;
}

export interface Ebene3D {
  p0: Vec3;
  u: Vec3;
  v: Vec3;
  /** Halbe Kantenlängen in u- bzw. v-Richtung (Standard 1) */
  su?: number;
  sv?: number;
  color?: string;
  opacity?: number;
}

export interface Surface3DProps {
  /** Entwurfsbreite in px (viewBox); die Grafik skaliert responsiv mit. */
  size?: number;
  height?: number;
  xDomain: [number, number];
  yDomain: [number, number];
  /** Ohne Angabe aus der Fläche und den Overlays bestimmt. */
  zDomain?: [number, number];
  /** Höhenstreckung des Einheitsquaders (Standard 0,8). */
  zScale?: number;
  perspective?: number;
  labels?: { x?: string; y?: string; z?: string };
  ticks?: boolean;
  surface?: Flaeche3D;
  /** Niveaus, die als Höhenlinien auf den Boden (z = zmin) gezeichnet werden. */
  contours?: number[];
  contourColor?: string;
  points?: Punkt3D[];
  arrows?: Pfeil3D[];
  curves?: Kurve3D[];
  planes?: Ebene3D[];
  /** Lot von jedem Punkt auf den Boden. */
  dropLines?: boolean;
  azimuth?: number;
  elevation?: number;
  defaultAzimuth?: number;
  defaultElevation?: number;
  onViewChange?: (s: Sicht3D) => void;
  /** Ziehen zum Drehen (Standard: an). */
  interactive?: boolean;
  ariaLabel: string;
  className?: string;
}

const GITTER_MAX = 40;

/* ------------------------------------------------------------- Bausteine */

type Prim = { oben?: boolean } & (
  | { art: "flaeche"; tiefe: number; punkte: [number, number][]; fuellung: string; strich?: string; deckkraft: number }
  | { art: "linie"; tiefe: number; a: [number, number]; b: [number, number]; farbe: string; breite: number; dash?: string; pfeil?: string; deckkraft?: number }
  | { art: "punkt"; tiefe: number; c: [number, number]; farbe: string; r: number }
);

export function Surface3D({
  size = 320,
  height,
  xDomain,
  yDomain,
  zDomain,
  zScale = 0.8,
  perspective = 0,
  labels,
  ticks = true,
  surface,
  contours,
  contourColor,
  points,
  arrows,
  curves,
  planes,
  dropLines = false,
  azimuth,
  elevation,
  defaultAzimuth = 38,
  defaultElevation = 26,
  onViewChange,
  interactive = true,
  ariaLabel,
  className,
}: Surface3DProps) {
  const uid = useId().replace(/:/g, "");
  const [innen, setInnen] = useState<Sicht3D>({ azimuth: defaultAzimuth, elevation: defaultElevation });
  const sicht: Sicht3D = {
    azimuth: azimuth ?? innen.azimuth,
    elevation: clamp(elevation ?? innen.elevation, 2, 88),
  };
  const setzeSicht = useCallback(
    (s: Sicht3D) => {
      const naechste = { azimuth: ((s.azimuth % 360) + 360) % 360, elevation: clamp(s.elevation, 2, 88) };
      if (azimuth === undefined || elevation === undefined) setInnen(naechste);
      onViewChange?.(naechste);
    },
    [azimuth, elevation, onViewChange],
  );

  const W = size;
  const H = height ?? Math.round(size * 0.86);

  /* ------------------------------------------------------- Wertegitter */
  const gitter = useMemo(() => {
    if (!surface) return null;
    const xd = surface.xDomain ?? xDomain;
    const yd = surface.yDomain ?? yDomain;
    const nx = Math.max(2, Math.min(GITTER_MAX, Math.round(surface.nx ?? 24)));
    const ny = Math.max(2, Math.min(GITTER_MAX, Math.round(surface.ny ?? 24)));
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= nx; i++) xs.push(xd[0] + ((xd[1] - xd[0]) * i) / nx);
    for (let j = 0; j <= ny; j++) ys.push(yd[0] + ((yd[1] - yd[0]) * j) / ny);
    const v: number[][] = [];
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i <= nx; i++) {
      const spalte: number[] = [];
      for (let j = 0; j <= ny; j++) {
        const w = surface.f(xs[i], ys[j]);
        spalte.push(w);
        if (Number.isFinite(w)) {
          if (w < min) min = w;
          if (w > max) max = w;
        }
      }
      v.push(spalte);
    }
    return { xs, ys, v, min, max };
    // Absichtlich die ZAHLEN als Abhängigkeiten: Aufrufer schreiben die
    // Fenster als Literal (`xDomain={[-2.4, 2.4]}`), die Objektidentität
    // wechselt also bei jedem Rendern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, xDomain[0], xDomain[1], yDomain[0], yDomain[1]]);

  /* ------------------------------------------------- Höhenbereich und Maß */
  const [z0, z1] = useMemo((): [number, number] => {
    // Auch ein AUSDRUECKLICH uebergebener Bereich kann entartet sein (konstante
    // Flaeche); ungeschuetzt teilt die Hoehenskala dann durch null und alle
    // Polygone werden NaN. Der Auto-Pfad unten faengt das schon ab.
    if (zDomain)
      return zDomain[1] - zDomain[0] < 1e-9
        ? [zDomain[0] - 1, zDomain[1] + 1]
        : [zDomain[0], zDomain[1]];
    let lo = Infinity;
    let hi = -Infinity;
    if (gitter && Number.isFinite(gitter.min)) {
      lo = Math.min(lo, gitter.min);
      hi = Math.max(hi, gitter.max);
    }
    const merke = (z: number) => {
      if (!Number.isFinite(z)) return;
      lo = Math.min(lo, z);
      hi = Math.max(hi, z);
    };
    points?.forEach((p) => merke(p.p[2]));
    arrows?.forEach((a) => {
      merke(a.from[2]);
      merke(a.to[2]);
    });
    curves?.forEach((k) => k.pts.forEach((p) => merke(p[2])));
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [-1, 1];
    if (hi - lo < 1e-9) return [lo - 1, hi + 1];
    return [lo, hi];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zDomain?.[0], zDomain?.[1], gitter, points, arrows, curves]);

  const zA = Math.max(0.1, zScale);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nx1 = useCallback((x: number) => (2 * (x - xDomain[0])) / (xDomain[1] - xDomain[0]) - 1, [xDomain[0], xDomain[1]]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ny1 = useCallback((y: number) => (2 * (y - yDomain[0])) / (yDomain[1] - yDomain[0]) - 1, [yDomain[0], yDomain[1]]);
  const nz1 = useCallback((z: number) => (((z - z0) / (z1 - z0)) * 2 - 1) * zA, [z0, z1, zA]);
  const welt = useCallback((p: Vec3): Vec3 => [nx1(p[0]), ny1(p[1]), nz1(p[2])], [nx1, ny1, nz1]);

  /* ------------------------------------------------------------ Kamera */
  const geo = useMemo(() => {
    const proj = machProjektor(sicht.azimuth, sicht.elevation, perspective);
    const ecken = quaderEcken(zA).map(proj);
    let xmin = Infinity;
    let xmax = -Infinity;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (const e of ecken) {
      xmin = Math.min(xmin, e.x);
      xmax = Math.max(xmax, e.x);
      ymin = Math.min(ymin, e.y);
      ymax = Math.max(ymax, e.y);
    }
    const padX = ticks ? 36 : 14;
    const padY = ticks ? 30 : 14;
    const s = Math.min((W - 2 * padX) / Math.max(1e-6, xmax - xmin), (H - 2 * padY) / Math.max(1e-6, ymax - ymin));
    const cx = W / 2 - (s * (xmin + xmax)) / 2;
    const cy = H / 2 + (s * (ymin + ymax)) / 2;
    const px = (p: Vec3): [number, number] => {
      const q = proj(p);
      return [cx + s * q.x, cy - s * q.y];
    };
    const tiefe = (p: Vec3) => proj(p).depth;
    const dir = machProjektor(sicht.azimuth, sicht.elevation, 0);
    const d: Vec3 = [dir([1, 0, 0]).depth, dir([0, 1, 0]).depth, dir([0, 0, 1]).depth];
    return { px, tiefe, d };
  }, [sicht.azimuth, sicht.elevation, perspective, zA, W, H, ticks]);

  const px = geo.px;
  const pxW = useCallback((p: Vec3) => px(welt(p)), [px, welt]);

  /* ------------------------------------------------ Boden, Kasten, Achsen */
  const xTicks = useMemo(() => niceTicks(xDomain[0], xDomain[1], 4), [xDomain[0], xDomain[1]]);
  const yTicks = useMemo(() => niceTicks(yDomain[0], yDomain[1], 4), [yDomain[0], yDomain[1]]);
  const zTicks = useMemo(() => niceTicks(z0, z1, 4), [z0, z1]);

  const yKante = geo.d[1] > 0 ? 1 : -1; // vordere Kante in y-Richtung
  const xKante = geo.d[0] > 0 ? 1 : -1;
  // Die senkrechte Kante für die z-Achse ist die auf dem Bild LINKESTE der
  // vier: sie liegt auf der Silhouette und wird deshalb von der Fläche nie
  // überdeckt. (Die hinterste Kante projiziert in die Bildmitte — dort
  // schwebten die Zahlen über der Fläche.)
  const rX = -Math.sin(rad(sicht.azimuth));
  const rY = Math.cos(rad(sicht.azimuth));
  const zEckeX = rX > 0 ? -1 : 1;
  const zEckeY = rY > 0 ? -1 : 1;

  const kastenKanten = useMemo(() => {
    const e = quaderEcken(zA);
    const paare: [number, number][] = [
      [0, 1],
      [1, 3],
      [3, 2],
      [2, 0],
      [4, 5],
      [5, 7],
      [7, 6],
      [6, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];
    return paare.map(([a, b]) => [px(e[a]), px(e[b])] as [[number, number], [number, number]]);
  }, [px, zA]);

  const bodenGitter = useMemo(() => {
    const linien: [[number, number], [number, number]][] = [];
    for (const t of xTicks) {
      if (t < xDomain[0] || t > xDomain[1]) continue;
      linien.push([px([nx1(t), -1, -zA]), px([nx1(t), 1, -zA])]);
    }
    for (const t of yTicks) {
      if (t < yDomain[0] || t > yDomain[1]) continue;
      linien.push([px([-1, ny1(t), -zA]), px([1, ny1(t), -zA])]);
    }
    return linien;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xTicks, yTicks, xDomain[0], xDomain[1], yDomain[0], yDomain[1], px, nx1, ny1, zA]);

  const konturLinien = useMemo(() => {
    if (!gitter || !contours?.length) return [];
    const linien: [[number, number], [number, number]][] = [];
    for (const niveau of contours) {
      for (const s of hoehenlinie(gitter.xs, gitter.ys, gitter.v, niveau)) {
        linien.push([px([nx1(s.x1), ny1(s.y1), -zA]), px([nx1(s.x2), ny1(s.y2), -zA])]);
      }
    }
    return linien;
  }, [gitter, contours, px, nx1, ny1, zA]);

  /* ---------------------------------------------------- Tiefensortierung */
  const prims = useMemo(() => {
    const liste: Prim[] = [];

    if (gitter && surface) {
      const farbe = surface.color ?? "#0072B2";
      const deckkraft = surface.opacity ?? 0.92;
      const wire = surface.wire !== false;
      for (let i = 0; i + 1 < gitter.xs.length; i++) {
        for (let j = 0; j + 1 < gitter.ys.length; j++) {
          const ecken: Vec3[] = [
            [gitter.xs[i], gitter.ys[j], gitter.v[i][j]],
            [gitter.xs[i + 1], gitter.ys[j], gitter.v[i + 1][j]],
            [gitter.xs[i + 1], gitter.ys[j + 1], gitter.v[i + 1][j + 1]],
            [gitter.xs[i], gitter.ys[j + 1], gitter.v[i][j + 1]],
          ];
          if (ecken.some((e) => !Number.isFinite(e[2]))) continue;
          const w = ecken.map(welt) as [Vec3, Vec3, Vec3, Vec3];
          const n = vierecksNormale(w[0], w[1], w[2], w[3]);
          const zMitte = (ecken[0][2] + ecken[1][2] + ecken[2][2] + ecken[3][2]) / 4;
          const basis = typeof farbe === "function" ? farbe(zMitte) : farbe;
          const hell = schattiere(basis, lambert(n));
          liste.push({
            art: "flaeche",
            tiefe: (geo.tiefe(w[0]) + geo.tiefe(w[1]) + geo.tiefe(w[2]) + geo.tiefe(w[3])) / 4,
            punkte: w.map(px) as [number, number][],
            fuellung: hell,
            strich: wire ? schattiere(basis, 0.62) : hell,
            deckkraft,
          });
        }
      }
    }

    for (const e of planes ?? []) {
      const su = e.su ?? 1;
      const sv = e.sv ?? 1;
      const ecken: Vec3[] = [
        [-su, -sv],
        [su, -sv],
        [su, sv],
        [-su, sv],
      ].map(([a, b]) => [e.p0[0] + a * e.u[0] + b * e.v[0], e.p0[1] + a * e.u[1] + b * e.v[1], e.p0[2] + a * e.u[2] + b * e.v[2]] as Vec3);
      const w = ecken.map(welt);
      liste.push({
        art: "flaeche",
        tiefe: w.reduce((s, p) => s + geo.tiefe(p), 0) / w.length,
        punkte: w.map(px) as [number, number][],
        fuellung: e.color ?? "#009E73",
        strich: e.color ?? "#009E73",
        deckkraft: e.opacity ?? 0.3,
      });
    }

    for (const k of curves ?? []) {
      for (let i = 0; i + 1 < k.pts.length; i++) {
        const a = welt(k.pts[i]);
        const b = welt(k.pts[i + 1]);
        liste.push({
          art: "linie",
          tiefe: (geo.tiefe(a) + geo.tiefe(b)) / 2,
          a: px(a),
          b: px(b),
          farbe: k.color ?? "#D55E00",
          breite: k.width ?? 2,
          dash: k.dash,
          oben: k.onTop,
        });
      }
    }

    for (const p of arrows ?? []) {
      const a = welt(p.from);
      const b = welt(p.to);
      liste.push({
        art: "linie",
        tiefe: Math.max(geo.tiefe(a), geo.tiefe(b)),
        a: px(a),
        b: px(b),
        farbe: p.color ?? "#E69F00",
        breite: p.width ?? 2.2,
        pfeil: p.color ?? "#E69F00",
        oben: p.onTop,
      });
    }

    for (const p of points ?? []) {
      const w = welt(p.p);
      if (dropLines) {
        const fuss: Vec3 = [w[0], w[1], -zA];
        liste.push({
          art: "linie",
          tiefe: (geo.tiefe(w) + geo.tiefe(fuss)) / 2,
          a: px(w),
          b: px(fuss),
          farbe: p.color ?? "#6b7280",
          breite: 1,
          dash: "3 3",
          deckkraft: 0.7,
          oben: p.onTop,
        });
      }
      liste.push({ art: "punkt", tiefe: geo.tiefe(w), c: px(w), farbe: p.color ?? "#9E57D5", r: p.r ?? 4, oben: p.onTop });
    }

    // Erst nach „liegt oben", dann nach Tiefe: Malerverfahren mit Vorfahrt.
    liste.sort((a, b) => (a.oben ? 1 : 0) - (b.oben ? 1 : 0) || a.tiefe - b.tiefe);
    return liste;
  }, [gitter, surface, planes, curves, arrows, points, dropLines, welt, px, geo, zA]);

  const pfeilFarben = useMemo(() => Array.from(new Set((arrows ?? []).map((a) => a.color ?? "#E69F00"))), [arrows]);

  /* ------------------------------------------------------------ Ziehen */
  // Bewusst NICHT `useDrag` (src/lib/widgets/useDrag.tsx): der Hook rechnet
  // Zeigerpositionen in WELTKOORDINATEN um und ist damit für Griff- und
  // Flächen-Drags gedacht. Eine Kameradrehung braucht dagegen die DIFFERENZ
  // zweier Zeigerpositionen in Pixeln. Das Rezept ist identisch
  // (setPointerCapture, touch-action mit vertikalem Scrollen), der Dualpfad steht
  // als <ViewControls> daneben.
  // Der Blickwinkel wird IM REF mitgefuehrt, nicht aus `sicht` gelesen: bei
  // einem 40x40-Gitter kommen mehrere pointermove-Events auf ein Rendern, und
  // gegen das dann veraltete `sicht` gerechnet gehen Drehungen verloren
  // (gemessen: von -180 Grad blieben bei 5 Events pro Commit nur -36 Grad uebrig).
  // Ein funktionales setState hilft hier NICHT, weil Surface3D auch
  // KONTROLLIERT betrieben wird (S94Tensorbasis, S92Scheiben) — dort ist der
  // Prop genauso veraltet.
  const zieht = useRef<{ x: number; y: number; az: number; el: number } | null>(null);

  const zeigerAb = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Einige Browser verweigern Capture für bereits abgebrochene Touch-Pointer.
    }
    zieht.current = { x: e.clientX, y: e.clientY, az: sicht.azimuth, el: sicht.elevation };
  };
  const zeigerBewegt = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!zieht.current) return;
    const dx = e.clientX - zieht.current.x;
    const dy = e.clientY - zieht.current.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    // ungerundet akkumulieren, erst zur Anzeige runden: sonst verliert ein
    // langsamer 1-px-Zug bei jedem Event den Nachkommaanteil.
    const az = zieht.current.az - dx * 0.6;
    const el = clamp(zieht.current.el + dy * 0.5, 2, 88);
    zieht.current = { x: e.clientX, y: e.clientY, az, el };
    setzeSicht({ azimuth: Math.round(az), elevation: Math.round(el) });
  };
  const zeigerAuf = () => {
    zieht.current = null;
  };

  /* ----------------------------------------------------------- Zeichnen */
  const achse = "var(--w-axis, #64748b)";
  const gitterFarbe = "var(--w-grid, #e2e8f0)";
  const textFarbe = "var(--w-text, #334155)";

  const beschriftung = (t: number, achseNr: 0 | 1 | 2): { pos: [number, number]; text: string } => {
    const aus = 1.14;
    const p: Vec3 =
      achseNr === 0
        ? [nx1(t), yKante * aus, -zA * 1.04]
        : achseNr === 1
          ? [xKante * aus, ny1(t), -zA * 1.04]
          : [zEckeX * (aus + 0.08), zEckeY * (aus + 0.08), nz1(t)];
    return { pos: px(p), text: fmtTick(t) };
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className={`max-w-full h-auto select-none ${className ?? ""}`}
      style={{ touchAction: interactive ? "pan-y" : undefined, cursor: interactive ? "grab" : undefined }}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={zeigerAb}
      onPointerMove={zeigerBewegt}
      onPointerUp={zeigerAuf}
      onPointerCancel={zeigerAuf}
    >
      <defs>
        {pfeilFarben.map((f, i) => (
          <marker
            key={f}
            id={`s3d-${uid}-pfeil-${i}`}
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L7,3 L0,6 z" fill={f} />
          </marker>
        ))}
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="var(--w-bg, #ffffff)" />

      {/* Boden, Höhenlinien, Kasten — immer hinter der Fläche */}
      {bodenGitter.map(([a, b], i) => (
        <line key={`bg${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={gitterFarbe} strokeWidth={0.8} />
      ))}
      {konturLinien.map(([a, b], i) => (
        <line
          key={`kl${i}`}
          x1={a[0]}
          y1={a[1]}
          x2={b[0]}
          y2={b[1]}
          stroke={contourColor ?? "var(--w-grid-strong, #cbd5e1)"}
          strokeWidth={1.2}
          strokeOpacity={0.65}
        />
      ))}
      {kastenKanten.map(([a, b], i) => (
        <line key={`kk${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={gitterFarbe} strokeWidth={1} />
      ))}

      {/* tiefensortierte Geometrie */}
      {prims.map((p, i) => {
        if (p.art === "flaeche") {
          return (
            <polygon
              key={i}
              points={p.punkte.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ")}
              fill={p.fuellung}
              fillOpacity={p.deckkraft}
              stroke={p.strich}
              strokeWidth={0.5}
              strokeLinejoin="round"
            />
          );
        }
        if (p.art === "linie") {
          const idx = p.pfeil ? pfeilFarben.indexOf(p.pfeil) : -1;
          return (
            <line
              key={i}
              x1={p.a[0]}
              y1={p.a[1]}
              x2={p.b[0]}
              y2={p.b[1]}
              stroke={p.farbe}
              strokeWidth={p.breite}
              strokeOpacity={p.deckkraft ?? 1}
              strokeDasharray={p.dash}
              markerEnd={idx >= 0 ? `url(#s3d-${uid}-pfeil-${idx})` : undefined}
            />
          );
        }
        return (
          <g key={i}>
            <circle cx={p.c[0]} cy={p.c[1]} r={p.r + 2.5} fill="none" stroke={p.farbe} strokeWidth={1.6} />
            <circle cx={p.c[0]} cy={p.c[1]} r={p.r * 0.6} fill={p.farbe} />
          </g>
        );
      })}

      {/* Beschriftungen zuletzt, damit sie lesbar bleiben */}
      {ticks && (
        <g fontSize={9} fill={achse}>
          {xTicks
            .filter((t) => t >= xDomain[0] && t <= xDomain[1])
            .map((t) => {
              const b = beschriftung(t, 0);
              return (
                <text key={`tx${t}`} x={b.pos[0]} y={b.pos[1] + 3} textAnchor="middle">
                  {b.text}
                </text>
              );
            })}
          {yTicks
            .filter((t) => t >= yDomain[0] && t <= yDomain[1])
            .map((t) => {
              const b = beschriftung(t, 1);
              return (
                <text key={`ty${t}`} x={b.pos[0]} y={b.pos[1] + 3} textAnchor="middle">
                  {b.text}
                </text>
              );
            })}
          {zTicks
            .filter((t) => t >= z0 && t <= z1)
            .map((t) => {
              const b = beschriftung(t, 2);
              return (
                <text key={`tz${t}`} x={b.pos[0]} y={b.pos[1] + 3} textAnchor="middle">
                  {b.text}
                </text>
              );
            })}
        </g>
      )}
      <g fontSize={11} fill={textFarbe}>
        {labels?.x && (
          <text {...anker(px([0, yKante * 1.28, -zA * 1.08]))} textAnchor="middle">
            {labels.x}
          </text>
        )}
        {labels?.y && (
          <text {...anker(px([xKante * 1.28, 0, -zA * 1.08]))} textAnchor="middle">
            {labels.y}
          </text>
        )}
        {labels?.z && (
          <text
            x={px([zEckeX * 1.24, zEckeY * 1.24, zA])[0]}
            y={px([zEckeX * 1.24, zEckeY * 1.24, zA])[1] - 12}
            textAnchor="middle"
          >
            {labels.z}
          </text>
        )}
        {(points ?? [])
          .filter((p) => p.label)
          .map((p, i) => {
            const q = pxW(p.p);
            return (
              <text
                key={`pl${i}`}
                x={q[0] + 8}
                y={q[1] - 6}
                fill={p.color ?? "#9E57D5"}
                stroke="var(--w-bg, #ffffff)"
                strokeWidth={2.5}
                paintOrder="stroke"
              >
                {p.label}
              </text>
            );
          })}
        {(arrows ?? [])
          .filter((a) => a.label)
          .map((a, i) => {
            const q = pxW(a.to);
            const s0 = pxW(a.from);
            const dx = q[0] - s0[0];
            const dy = q[1] - s0[1];
            const l = Math.hypot(dx, dy) || 1;
            return (
              <text
                key={`al${i}`}
                x={q[0] + (dx / l) * 14}
                y={q[1] + (dy / l) * 14 + 3}
                textAnchor="middle"
                fill={a.color ?? "#E69F00"}
                stroke="var(--w-bg, #ffffff)"
                strokeWidth={2.5}
                paintOrder="stroke"
              >
                {a.label}
              </text>
            );
          })}
      </g>
    </svg>
  );
}

function anker(p: [number, number]) {
  return { x: p[0], y: p[1] + 4 };
}

/* --------------------------------------------------------- ViewControls */

/**
 * Dualpfad zu „Ziehen zum Drehen": zwei Regler plus Rücksetzknopf.
 * `reset` ist die Ansicht, auf die der Knopf zurückstellt (Standard 38°/26°).
 */
export function ViewControls({
  value,
  onChange,
  reset = { azimuth: 38, elevation: 26 },
  accent,
}: {
  value: Sicht3D;
  onChange: (s: Sicht3D) => void;
  reset?: Sicht3D;
  accent?: string;
}) {
  return (
    <div className="space-y-1">
      <Slider
        label="Azimut"
        value={Math.round(value.azimuth)}
        onChange={(v) => onChange({ ...value, azimuth: v })}
        min={0}
        max={359}
        step={1}
        unit="°"
        accent={accent}
        fmt={(v) => `${Math.round(v)}`}
      />
      <Slider
        label="Höhe"
        value={Math.round(value.elevation)}
        onChange={(v) => onChange({ ...value, elevation: v })}
        min={2}
        max={88}
        step={1}
        unit="°"
        accent={accent}
        fmt={(v) => `${Math.round(v)}`}
      />
      <button type="button" className={W_BUTTON} onClick={() => onChange(reset)}>
        Ansicht zurücksetzen
      </button>
    </div>
  );
}
