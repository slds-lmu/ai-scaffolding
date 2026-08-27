/**
 * TransformCanvas v2 — die Tafel für lineare Abbildungen x ↦ Ax (SVG).
 *
 * DIE EINE EINSICHT, die diese Komponente allen ~30 Aufrufern schenkt: eine
 * lineare Abbildung ist vollständig dadurch bestimmt, wohin sie das Gitter und
 * die Standardbasis schiebt — und das sieht man erst, wenn man den Vektor
 * selbst anfassen darf. Deshalb: ziehbare Vektoren (`draggable`), ziehbare
 * Spaltenbilder Ae₁/Ae₂ (`columnsDraggable`), Hover-Readout (x, Ax),
 * Unterräume als Geraden (`lines`) statt als Pfeile, und weiche Übergänge bei
 * diskreten Matrixwechseln (`transitionMs`).
 *
 * FARBROLLEN (kapitelübergreifend, Rest legen die Kapitel fest):
 *   Originalgitter/Achsen  var(--w-grid) / var(--w-axis)   — neutral
 *   transformiertes Gitter  FMM_COLORS.blau, 28 % Deckkraft — „Bild unter A"
 *   Einheitskreis           var(--w-axis), gestrichelt      — Urbild
 *   Bild des Kreises        FMM_COLORS.blau                 — Bild unter A
 *   Vektor (Default)        FMM_COLORS.rot                  — das Objekt in der Hand
 *   Ae₁ / Ae₂               FMM_COLORS.rot / FMM_COLORS.gruen (nur bei
 *                           columnsDraggable) — Spalten von A
 * Alle Flächen-/Textfarben kommen aus den CSS-Variablen --w-bg/--w-grid/
 * --w-grid-strong/--w-axis/--w-text/--w-border, die das dunkle Tooltip-Panel
 * (`.w-dark`) überschreibt. Deshalb braucht kein Aufrufer mehr `tickClass`.
 *
 * PROVENIENZ: Ersetzt die Canvas-Fassung (src/lib/widgets/TransformCanvas.tsx,
 * Stand 2026-08-05) und den DOM-Rahmen `LabeledFrame` aus Axes.tsx; Achsen,
 * Ticks und Achsennamen liegen jetzt im SVG. Zeiger-Rezept und Griffe kommen
 * aus ./useDrag (`useDrag`, `DragHandle`), die Matrix-Transition aus
 * ./useAnimatedValue (`useAnimatedMatrix`).
 *
 * PRÜFSTATUS (historische Notiz, 2026-08-19): Das ursprüngliche Skript ist nicht mehr vorhanden; die folgenden Zahlen sind derzeit nicht reproduzierbar nachgewiesen:
 * toPx/toWorld sind Inverse (max. Abweichung 2,7e−15 über 3200 Punkte);
 * max‖Ax‖ über dem Einheitskreis = sigmaMax(A) (Diff ≤ 6,5e−10 für fünf
 * Testmatrizen) — das rechtfertigt das Fenster-Idiom
 * worldHalf = max(3,2; 1,2·sigmaMax); Ae₁/Ae₂ sind exakt die Spalten von A
 * (Grundlage des Spalten-Drags); die Easing-Funktion der Transition ist
 * monoton mit ease(0)=0, ease(0,5)=0,5, ease(1)=1.
 */
import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { FMM_COLORS, clamp, fmtDe, fmtTick, labelPlacement, niceTicks } from "./util";
import { DragHandle, svgWorldMapper, useDrag, type Punkt } from "./useDrag";
import { useAnimatedMatrix } from "./useAnimatedValue";

export type Mat2 = [[number, number], [number, number]];

export interface Vec2 {
  v: [number, number];
  color?: string;
  label?: string;
  /** Spitze des Pfeils ist ein Ziehgriff (Doppelpfad-Regel: Slider daneben!). */
  draggable?: boolean;
  /** „unitCircle" hält den gezogenen Vektor auf der Länge 1. */
  dragConstraint?: "free" | "unitCircle";
}

export interface SubspaceLine {
  /** Richtungsvektor; gezeichnet wird die ganze Gerade durch den Ursprung. */
  dir: [number, number];
  color?: string;
  label?: string;
  /** Position des Labels entlang der Geraden; ohne Angabe wird die freiere Seite gewählt. */
  labelT?: number;
  dash?: boolean | number[];
}

/** Ränder im viewBox-Koordinatensystem (Platz für Ticks und Achsennamen). */
const PAD_L = 28;
const PAD_R = 8;
const PAD_T = 14;
const PAD_B = 26;

const HIT_R = 13; // unsichtbarer Trefferkreis (craft.md: ≥ 12 px)
const DOT_R = 4; // sichtbarer Griffpunkt

const mul = (m: Mat2, x: number, y: number): [number, number] => [
  m[0][0] * x + m[0][1] * y,
  m[1][0] * x + m[1][1] * y,
];

const dash = (d: boolean | number[] | undefined): string | undefined => {
  if (!d) return undefined;
  return (Array.isArray(d) ? d : [6, 4]).join(" ");
};

/** Die zwei Spaltenbilder Ae₁, Ae₂ als fertige Vektorliste (Bequemlichkeit). */
export function ColumnArrows(matrix: Mat2, draggable = false): Vec2[] {
  return [
    {
      v: [matrix[0][0], matrix[1][0]],
      color: FMM_COLORS.rot,
      label: "Ae₁",
      draggable,
    },
    {
      v: [matrix[0][1], matrix[1][1]],
      color: FMM_COLORS.gruen,
      label: "Ae₂",
      draggable,
    },
  ];
}

export function TransformCanvas({
  matrix,
  vectors = [],
  lines = [],
  showGrid = true,
  showUnitCircle = true,
  size = 340,
  worldHalf = 3.2,
  xLabel = "x₁",
  yLabel = "x₂",
  overlay,
  onVectorChange,
  columnsDraggable = false,
  onMatrixChange,
  readout,
  transitionMs = 0,
  ariaLabel,
}: {
  matrix: Mat2;
  vectors?: Vec2[];
  /** Unterräume (Kern, Bild, span) als Geraden durch den Ursprung. */
  lines?: SubspaceLine[];
  showGrid?: boolean;
  showUnitCircle?: boolean;
  /** Gesamtbreite des SVG in px (Obergrenze; das SVG schrumpft mit dem Container). */
  size?: number;
  worldHalf?: number;
  xLabel?: string;
  yLabel?: string;
  /** Zusätzliche SVG-Ebene über den Pfeilen; `toPx` rechnet Welt → viewBox-px. */
  overlay?: (toPx: (x: number, y: number) => [number, number]) => ReactNode;
  /** Wird beim Ziehen eines `draggable`-Vektors gerufen. */
  onVectorChange?: (index: number, v: [number, number]) => void;
  /** Ae₁ und Ae₂ (= die Spalten von A) werden zu Ziehgriffen. */
  columnsDraggable?: boolean;
  onMatrixChange?: (m: Mat2) => void;
  /** Hover-Readout „x = (…), Ax = (…)"; Default: an, sobald etwas ziehbar ist. */
  readout?: boolean;
  /** Weicher Übergang in ms, wenn sich `matrix` diskret ändert. */
  transitionMs?: number;
  ariaLabel?: string;
}) {
  const rawId = useId();
  const clipId = `tc-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<Punkt | null>(null);

  const interaktiv = columnsDraggable || vectors.some((v) => v.draggable);
  const zeigeReadout = readout ?? interaktiv;

  // ---- Geometrie ---------------------------------------------------------
  // `size` ist wie bisher die Zeichenfläche; Achsenrand kommt dazu (Gesamtbreite size + 36,
  // genau der Platz, den früher LabeledFrame um den Canvas legte).
  const inner = Math.max(60, size);
  const W = PAD_L + inner + PAD_R;
  const H = PAD_T + inner + PAD_B;
  const s = inner / (2 * worldHalf);
  const ox = PAD_L + inner / 2;
  const oy = PAD_T + inner / 2;

  const toPx = useCallback(
    (x: number, y: number): [number, number] => [ox + x * s, oy - y * s],
    [ox, oy, s]
  );

  const feld = { x0: PAD_L, y0: PAD_T, w: inner, h: inner };
  const welt = { x0: -worldHalf, x1: worldHalf, y0: -worldHalf, y1: worldHalf };
  const zeigerWelt = svgWorldMapper(svgRef, feld, welt);

  // ---- Ziehen (Griffe: "v<i>" = Vektorspitze, "c0"/"c1" = Spalten von A) ---
  const zieh = useDrag({
    feld,
    welt,
    disabled: !interaktiv,
    clamp: (p, id) => {
      const x = clamp(p[0], -worldHalf, worldHalf);
      const y = clamp(p[1], -worldHalf, worldHalf);
      if (id.startsWith("v") && vectors[Number(id.slice(1))]?.dragConstraint === "unitCircle") {
        const n = Math.hypot(x, y);
        return n < 1e-9 ? [1, 0] : [x / n, y / n];
      }
      return [x, y];
    },
    onDrag: (p, id) => {
      setHover(p);
      if (id.startsWith("v")) {
        onVectorChange?.(Number(id.slice(1)), [p[0], p[1]]);
      } else {
        const i = Number(id.slice(1));
        onMatrixChange?.(
          i === 0
            ? [
                [p[0], matrix[0][1]],
                [p[1], matrix[1][1]],
              ]
            : [
                [matrix[0][0], p[0]],
                [matrix[1][0], p[1]],
              ]
        );
      }
    },
  });

  // Während des Ziehens wird nie animiert — der Zug IST die Animation.
  const m = useAnimatedMatrix(matrix, zieh.dragging ? 0 : transitionMs);

  // ---- Gitter ------------------------------------------------------------
  const step = Math.max(1, Math.ceil(worldHalf / 6));
  const gitter = useMemo(() => {
    const ext = Math.ceil((2 * worldHalf) / step) * step;
    if (!showGrid) return { orig: [] as number[], bild: [] as number[], ext };
    const kMax = Math.ceil(worldHalf / step) * step;
    const orig: number[] = [];
    for (let k = -kMax; k <= kMax; k += step) orig.push(k);
    const bild: number[] = [];
    for (let k = -ext; k <= ext; k += step) bild.push(k);
    return { orig, bild, ext };
  }, [showGrid, worldHalf, step]);
  const ext = gitter.ext;

  const ticks = useMemo(() => niceTicks(-worldHalf, worldHalf), [worldHalf]);

  // Bild des Einheitskreises als Polygonzug
  const kreisBild = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 96; i++) {
      const t = (2 * Math.PI * i) / 96;
      const [x, y] = mul(m, Math.cos(t), Math.sin(t));
      const [px, py] = toPx(x, y);
      pts.push(`${px.toFixed(2)},${py.toFixed(2)}`);
    }
    return pts.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m[0][0], m[0][1], m[1][0], m[1][1], toPx]);

  const spalten: [number, number][] = [
    [m[0][0], m[1][0]],
    [m[0][1], m[1][1]],
  ];
  const beschriftetePfeilspitzen = [
    ...vectors.filter((v) => v.label).map((v) => toPx(v.v[0], v.v[1])),
    ...(columnsDraggable ? spalten.map((v) => toPx(v[0], v[1])) : []),
  ];

  // ---- aria --------------------------------------------------------------
  const beschriftung =
    ariaLabel ??
    `Lineare Abbildung x ↦ Ax mit A = (${fmtDe(m[0][0])}, ${fmtDe(m[0][1])}; ` +
      `${fmtDe(m[1][0])}, ${fmtDe(m[1][1])}). Gezeigt werden ` +
      `${showGrid ? "das Bild des Einheitsgitters, " : ""}` +
      `${showUnitCircle ? "der Einheitskreis und sein Bild " : ""}` +
      `sowie ${vectors.length} Vektorpfeil${vectors.length === 1 ? "" : "e"}` +
      `${lines.length > 0 ? ` und ${lines.length} Gerade${lines.length === 1 ? "" : "n"} durch den Ursprung` : ""}.`;

  // ---- Zeichnen ----------------------------------------------------------
  const pfeil = (
    key: string,
    x: number,
    y: number,
    color: string,
    label?: string,
    breite = 2.5
  ) => {
    const [px, py] = toPx(x, y);
    const laenge = Math.hypot(px - ox, py - oy);
    if (laenge < 1e-6) return null;
    const ang = Math.atan2(py - oy, px - ox);
    const hl = Math.min(9, laenge);
    const head = [
      [px, py],
      [px - hl * Math.cos(ang - 0.4), py - hl * Math.sin(ang - 0.4)],
      [px - hl * Math.cos(ang + 0.4), py - hl * Math.sin(ang + 0.4)],
    ]
      .map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`)
      .join(" ");
    return (
      <g key={key}>
        <line
          x1={ox}
          y1={oy}
          x2={px - 0.5 * hl * Math.cos(ang)}
          y2={py - 0.5 * hl * Math.sin(ang)}
          stroke={color}
          strokeWidth={breite}
          strokeLinecap="round"
        />
        <polygon points={head} fill={color} />
        {label ? (
          <text
            x={px + 6}
            y={py - 5}
            fill={color}
            style={{ fontSize: 12 }}
            className="select-none"
          >
            {label}
          </text>
        ) : null}
      </g>
    );
  };

  const griff = (key: string, x: number, y: number, color: string, id: string) => {
    const [px, py] = toPx(x, y);
    return (
      <DragHandle
        key={key}
        x={px}
        y={py}
        r={DOT_R}
        hitR={HIT_R}
        farbe={color}
        aktiv={zieh.dragging === id}
        {...zieh.handleProps(id)}
      />
    );
  };

  const hoverBild = hover ? mul(m, hover[0], hover[1]) : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="h-auto max-w-full select-none"
      role="img"
      aria-label={beschriftung}
      style={interaktiv && zieh.dragging !== null ? { touchAction: "none" } : undefined}
      onPointerMove={(e) => {
        if (interaktiv) zieh.svgProps.onPointerMove(e);
        if (zeigeReadout && !zieh.dragging) {
          const p = zeigerWelt(e.clientX, e.clientY);
          if (p) setHover([clamp(p[0], -worldHalf, worldHalf), clamp(p[1], -worldHalf, worldHalf)]);
        }
      }}
      onPointerUp={zieh.svgProps.onPointerUp}
      onPointerCancel={() => {
        zieh.svgProps.onPointerCancel();
        setHover(null);
      }}
      onLostPointerCapture={zieh.svgProps.onLostPointerCapture}
      onPointerLeave={() => {
        zieh.svgProps.onPointerLeave();
        setHover(null);
      }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={PAD_L} y={PAD_T} width={inner} height={inner} />
        </clipPath>
      </defs>

      <rect
        x={0.5}
        y={0.5}
        width={W - 1}
        height={H - 1}
        rx={6}
        fill="var(--w-bg)"
        stroke="var(--w-border)"
      />

      <g clipPath={`url(#${clipId})`}>
        {/* Originalgitter */}
        {showGrid &&
          gitter.orig.map((k) => (
            <g key={`g${k}`}>
              <line
                x1={toPx(k, -worldHalf)[0]}
                y1={toPx(k, -worldHalf)[1]}
                x2={toPx(k, worldHalf)[0]}
                y2={toPx(k, worldHalf)[1]}
                stroke="var(--w-grid)"
                strokeWidth={1}
              />
              <line
                x1={toPx(-worldHalf, k)[0]}
                y1={toPx(-worldHalf, k)[1]}
                x2={toPx(worldHalf, k)[0]}
                y2={toPx(worldHalf, k)[1]}
                stroke="var(--w-grid)"
                strokeWidth={1}
              />
            </g>
          ))}

        {/* transformiertes Gitter */}
        {showGrid &&
          gitter.bild.map((k) => {
            const a = toPx(...mul(m, k, -ext));
            const b = toPx(...mul(m, k, ext));
            const c = toPx(...mul(m, -ext, k));
            const d = toPx(...mul(m, ext, k));
            return (
              <g key={`t${k}`} stroke={FMM_COLORS.blau} strokeOpacity={0.28} strokeWidth={1}>
                <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
                <line x1={c[0]} y1={c[1]} x2={d[0]} y2={d[1]} />
              </g>
            );
          })}

        {/* Achsen */}
        <line
          x1={toPx(-worldHalf, 0)[0]}
          y1={toPx(-worldHalf, 0)[1]}
          x2={toPx(worldHalf, 0)[0]}
          y2={toPx(worldHalf, 0)[1]}
          stroke="var(--w-axis)"
          strokeWidth={1.2}
        />
        <line
          x1={toPx(0, -worldHalf)[0]}
          y1={toPx(0, -worldHalf)[1]}
          x2={toPx(0, worldHalf)[0]}
          y2={toPx(0, worldHalf)[1]}
          stroke="var(--w-axis)"
          strokeWidth={1.2}
        />

        {/* Unterräume als Geraden durch den Ursprung */}
        {lines.map((l, i) => {
          const n = Math.hypot(l.dir[0], l.dir[1]);
          if (!(n > 1e-9)) return null;
          const L = 3 * worldHalf;
          const a = toPx((l.dir[0] / n) * -L, (l.dir[1] / n) * -L);
          const b = toPx((l.dir[0] / n) * L, (l.dir[1] / n) * L);
          const labelT = l.labelT ?? [-0.78, 0.78].reduce((best, candidate) => {
            const point = toPx((l.dir[0] / n) * worldHalf * candidate, (l.dir[1] / n) * worldHalf * candidate);
            const distance = Math.min(...beschriftetePfeilspitzen.map(([x, y]) => Math.hypot(point[0] - x, point[1] - y)), Infinity);
            const bestPoint = toPx((l.dir[0] / n) * worldHalf * best, (l.dir[1] / n) * worldHalf * best);
            const bestDistance = Math.min(...beschriftetePfeilspitzen.map(([x, y]) => Math.hypot(bestPoint[0] - x, bestPoint[1] - y)), Infinity);
            return distance > bestDistance ? candidate : best;
          }, 0.78);
          const lp = toPx((l.dir[0] / n) * worldHalf * labelT, (l.dir[1] / n) * worldHalf * labelT);
          const label = labelPlacement(lp[0], ox);
          return (
            <g key={`l${i}`}>
              <line
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke={l.color ?? FMM_COLORS.violett}
                strokeWidth={2}
                strokeDasharray={dash(l.dash)}
              />
              {l.label ? (
                <text
                  x={label.x}
                  y={lp[1] - 5}
                  textAnchor={label.textAnchor}
                  fill={l.color ?? FMM_COLORS.violett}
                  style={{ fontSize: 12 }}
                >
                  {l.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* Einheitskreis und sein Bild */}
        {showUnitCircle && (
          <>
            <circle
              cx={ox}
              cy={oy}
              r={s}
              fill="none"
              stroke="var(--w-axis)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <polyline points={kreisBild} fill="none" stroke={FMM_COLORS.blau} strokeWidth={2} />
          </>
        )}

        {/* Hover-Fadenkreuz */}
        {zeigeReadout && hover && (
          <g stroke="var(--w-axis)" strokeWidth={1} strokeDasharray="3 3" strokeOpacity={0.8}>
            <line x1={toPx(hover[0], hover[1])[0]} y1={oy} x2={toPx(hover[0], hover[1])[0]} y2={toPx(hover[0], hover[1])[1]} />
            <line x1={ox} y1={toPx(hover[0], hover[1])[1]} x2={toPx(hover[0], hover[1])[0]} y2={toPx(hover[0], hover[1])[1]} />
          </g>
        )}
      </g>

      {/* Ticks */}
      {ticks.map((t) => (
        <g key={`tk${t}`}>
          <line
            x1={toPx(t, 0)[0]}
            y1={oy - 3}
            x2={toPx(t, 0)[0]}
            y2={oy + 3}
            stroke="var(--w-grid-strong)"
            strokeWidth={1}
          />
          <line
            x1={ox - 3}
            y1={toPx(0, t)[1]}
            x2={ox + 3}
            y2={toPx(0, t)[1]}
            stroke="var(--w-grid-strong)"
            strokeWidth={1}
          />
          <text
            x={toPx(t, 0)[0]}
            y={PAD_T + inner + 10}
            textAnchor="middle"
            fill="var(--w-text)"
            fillOpacity={0.75}
            style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
          >
            {fmtTick(t, ticks.length > 1 ? ticks[1] - ticks[0] : undefined)}
          </text>
          <text
            x={PAD_L - 4}
            y={toPx(0, t)[1] + 3}
            textAnchor="end"
            fill="var(--w-text)"
            fillOpacity={0.75}
            style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
          >
            {fmtTick(t, ticks.length > 1 ? ticks[1] - ticks[0] : undefined)}
          </text>
        </g>
      ))}

      {/* Achsennamen */}
      {yLabel ? (
        <text x={PAD_L} y={PAD_T - 4} fill="var(--w-text)" style={{ fontSize: 11 }}>
          {yLabel} ↑
        </text>
      ) : null}
      {xLabel ? (
        <text
          x={PAD_L + inner / 2}
          y={H - 3}
          textAnchor="middle"
          fill="var(--w-text)"
          style={{ fontSize: 11 }}
        >
          {xLabel} →
        </text>
      ) : null}

      {/* Vektorpfeile */}
      {vectors.map((eintrag, i) =>
        pfeil(`v${i}`, eintrag.v[0], eintrag.v[1], eintrag.color ?? FMM_COLORS.rot, eintrag.label)
      )}

      {/* Spaltenbilder Ae₁, Ae₂ */}
      {columnsDraggable &&
        spalten.map((sp, i) =>
          pfeil(
            `c${i}`,
            sp[0],
            sp[1],
            i === 0 ? FMM_COLORS.rot : FMM_COLORS.gruen,
            i === 0 ? "Ae₁" : "Ae₂",
            2
          )
        )}

      {overlay?.(toPx)}

      {/* Ziehgriffe zuletzt (SVG malt in Dokumentreihenfolge) */}
      {vectors.map((eintrag, i) =>
        eintrag.draggable
          ? griff(`hv${i}`, eintrag.v[0], eintrag.v[1], eintrag.color ?? FMM_COLORS.rot, `v${i}`)
          : null
      )}
      {columnsDraggable &&
        spalten.map((sp, i) =>
          griff(`hc${i}`, sp[0], sp[1], i === 0 ? FMM_COLORS.rot : FMM_COLORS.gruen, `c${i}`)
        )}

      {/* Readout */}
      {zeigeReadout && hover && hoverBild && (
        <g style={{ pointerEvents: "none" }}>
          <rect
            x={PAD_L + 2}
            y={PAD_T + 2}
            width={Math.min(inner - 4, 118)}
            height={26}
            rx={3}
            fill="var(--w-bg)"
            fillOpacity={0.85}
          />
          <text
            x={PAD_L + 6}
            y={PAD_T + 12}
            fill="var(--w-text)"
            style={{ fontSize: 9.5, fontFamily: "ui-monospace, monospace" }}
          >
            {`x  = (${fmtDe(hover[0])}; ${fmtDe(hover[1])})`}
          </text>
          <text
            x={PAD_L + 6}
            y={PAD_T + 23}
            fill={FMM_COLORS.blau}
            style={{ fontSize: 9.5, fontFamily: "ui-monospace, monospace" }}
          >
            {`Ax = (${fmtDe(hoverBild[0])}; ${fmtDe(hoverBild[1])})`}
          </text>
        </g>
      )}
    </svg>
  );
}
