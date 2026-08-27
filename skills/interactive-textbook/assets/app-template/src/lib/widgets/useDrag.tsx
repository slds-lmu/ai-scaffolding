/**
 * useDrag — das gemeinsame Zeiger-Rezept für alle ziehbaren Objekte in Widgets.
 *
 * Provenienz: destilliert aus den sieben bestehenden Drag-Implementierungen,
 * maßgeblich `11-konvexitaet/widgets/S113Sehne.tsx` (setPointerCapture,
 * vergrößerter Trefferkreis unter dem sichtbaren Punkt, PointerLeave als
 * zweites Drag-Ende, Constraint-ε beim Klemmen) sowie der vierfach kopierten
 * Koordinatenumrechnung aus `10-differentialrechnung/widgets/S102Gradient.tsx`,
 * `11-konvexitaet/widgets/S112KonvexTest.tsx`, `12-optim/widgets/S122Sattel.tsx`
 * und `12-optim/widgets/S125Lagrange.tsx`.
 *
 * Zwei Benutzungsarten:
 *
 *   1. GRIFF-DRAG — einzelne Punkte sind ziehbar (Regelfall):
 *
 *        const zieh = useDrag({
 *          feld: { x0: PAD_L, y0: 0, w: SIZE, h: SIZE },   // SVG-Nutzerkoordinaten
 *          welt: { x0: -3, x1: 3, y0: -2, y1: 2 },         // Datenfenster
 *          clamp: ([x, y]) => [clamp(x, -3, 3), clamp(y, -2, 2)],
 *          onDrag: ([x, y], id) => (id === "a" ? setA([x, y]) : setB([x, y])),
 *        });
 *        <svg viewBox={…} className="max-w-full h-auto" {...zieh.svgProps}>
 *          …
 *          <DragHandle x={px(a[0])} y={py(a[1])} farbe={BLAU} {...zieh.handleProps("a")} />
 *        </svg>
 *
 *   2. FLÄCHEN-DRAG — Klick irgendwo im Bild setzt den Punkt (Landkarten):
 *
 *        <svg {...zieh.svgProps} {...zieh.surfaceProps("p")}>…</svg>
 *
 * Beide Wege setzen `setPointerCapture`, damit ein schneller Zug den Griff
 * nicht „verliert", und `touch-action: none`, damit die Seite beim Ziehen
 * nicht scrollt. Constraints greifen WÄHREND des Zugs (`clamp`), gerastet
 * wird nur, wenn die Lektion diskret ist (`snap`).
 *
 * Doppelpfad-Regel (craft.md): jedes ziehbare Objekt braucht zusätzlich einen
 * <Slider> oder ein Zahlenfeld auf derselben Zustandsquelle. Der Hook erzwingt
 * das nicht, der Review prüft es.
 */
import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type SVGProps,
} from "react";
import { FMM_COLORS } from "./util";

export type Punkt = [number, number];

/** Datenfenster (Weltkoordinaten), y wächst nach OBEN. */
export interface WeltFenster {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Zeichenfläche innerhalb des SVG, in SVG-Nutzerkoordinaten (y wächst nach unten). */
export interface ZeichenFeld {
  x0: number;
  y0: number;
  w: number;
  h: number;
}

type SvgZiel = SVGSVGElement | null | { current: SVGSVGElement | null };

function alsSvg(ziel: SvgZiel | undefined): SVGSVGElement | null {
  if (!ziel) return null;
  return "current" in ziel ? ziel.current : ziel;
}

/** Das <svg>, in dem ein Element liegt (das Element selbst, falls es das <svg> ist). */
export function ownerSvg(el: Element | null | undefined): SVGSVGElement | null {
  if (!el) return null;
  if (el.tagName?.toLowerCase() === "svg") return el as SVGSVGElement;
  return (el as SVGElement).ownerSVGElement ?? null;
}

/**
 * Bildschirm- → SVG-Nutzerkoordinaten. Nutzt die CTM (respektiert viewBox,
 * preserveAspectRatio und jede Skalierung durch `max-w-full`); der Fallback
 * über getBoundingClientRect greift nur, wenn keine CTM verfügbar ist.
 */
export function clientToUser(svg: SVGSVGElement, clientX: number, clientY: number): Punkt {
  const ctm = svg.getScreenCTM?.();
  if (ctm) {
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return [p.x, p.y];
  }
  const r = svg.getBoundingClientRect();
  const vb = svg.viewBox?.baseVal;
  const w = vb && vb.width ? vb.width : r.width;
  const h = vb && vb.height ? vb.height : r.height;
  const ox = vb ? vb.x : 0;
  const oy = vb ? vb.y : 0;
  return [
    ox + (r.width ? (clientX - r.left) / r.width : 0) * w,
    oy + (r.height ? (clientY - r.top) / r.height : 0) * h,
  ];
}

/**
 * Baut die Umrechnung Bildschirm → Welt für ein SVG mit fester Zeichenfläche.
 * `ziel` darf das Element, ein Ref darauf oder null sein; ist nichts da,
 * liefert die Abbildung null (der Hook ignoriert den Event dann).
 */
export function svgWorldMapper(
  ziel: SvgZiel | undefined,
  feld: ZeichenFeld,
  welt: WeltFenster,
): (clientX: number, clientY: number) => Punkt | null {
  return (clientX, clientY) => {
    const svg = alsSvg(ziel);
    if (!svg || !feld.w || !feld.h) return null;
    const [ux, uy] = clientToUser(svg, clientX, clientY);
    return [
      welt.x0 + ((ux - feld.x0) / feld.w) * (welt.x1 - welt.x0),
      welt.y0 + ((feld.y0 + feld.h - uy) / feld.h) * (welt.y1 - welt.y0),
    ];
  };
}

export interface UseDragOptionen<Id extends string = string> {
  /** Eigene Umrechnung; Vorrang vor feld/welt. null = Event ignorieren. */
  toWorld?: (clientX: number, clientY: number, svg: SVGSVGElement | null) => Punkt | null;
  /** Zeichenfläche in SVG-Nutzerkoordinaten (Alternative zu toWorld). */
  feld?: ZeichenFeld;
  /** Datenfenster (Alternative zu toWorld). */
  welt?: WeltFenster;
  /** Wird bei jeder Zeigerbewegung mit dem fertig geklemmten Punkt gerufen. */
  onDrag: (p: Punkt, id: Id) => void;
  onStart?: (p: Punkt, id: Id) => void;
  onEnd?: (id: Id) => void;
  /** Constraints WÄHREND des Zugs (degenerierte Zustände unerreichbar machen). */
  clamp?: (p: Punkt, id: Id) => Punkt;
  /** Rasterweite; eine Zahl rastert beide Achsen gleich. Nur bei diskreten Lektionen. */
  snap?: number | Punkt;
  /**
   * Aktuelle Position des Griffs. Ist sie gesetzt, merkt sich der Hook beim
   * Anfassen den Greif-Versatz, sodass der Punkt nicht unter den Cursor springt.
   */
  greifPosition?: (id: Id) => Punkt;
  /** Cursor der Griffe (Default „grab" bzw. „grabbing" während des Zugs). */
  cursor?: string;
  /** Cursor der Fläche bei surfaceProps (Default „crosshair"). */
  flaechenCursor?: string;
  disabled?: boolean;
}

export interface DragApi<Id extends string = string> {
  /** id des gerade gezogenen Objekts, sonst null (für Hervorhebungen). */
  dragging: Id | null;
  /** an einen Griff (z. B. <DragHandle>) spreaden. */
  handleProps: (id: Id) => {
    onPointerDown: (e: ReactPointerEvent<SVGElement>) => void;
    style: CSSProperties;
  };
  /** an das <svg> spreaden, wenn die ganze Fläche der Griff ist. */
  surfaceProps: (id: Id) => {
    onPointerDown: (e: ReactPointerEvent<SVGElement>) => void;
    style: CSSProperties;
  };
  /** immer an das <svg> spreaden. */
  svgProps: {
    onPointerMove: (e: ReactPointerEvent<SVGElement>) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
    onLostPointerCapture: () => void;
    style: CSSProperties;
  };
}

export function useDrag<Id extends string = string>(opt: UseDragOptionen<Id>): DragApi<Id> {
  const {
    toWorld,
    feld,
    welt,
    onDrag,
    onStart,
    onEnd,
    clamp,
    snap,
    greifPosition,
    cursor = "grab",
    flaechenCursor = "crosshair",
    disabled = false,
  } = opt;

  const aktivRef = useRef<Id | null>(null);
  const zeigerRef = useRef<number | null>(null); // pointerId des aktiven Drags (zweiter Finger wird ignoriert)
  const versatzRef = useRef<Punkt>([0, 0]);
  const [dragging, setDragging] = useState<Id | null>(null);

  const abbilden = (e: ReactPointerEvent<SVGElement>): Punkt | null => {
    const svg = ownerSvg(e.currentTarget as unknown as Element);
    if (toWorld) return toWorld(e.clientX, e.clientY, svg);
    if (feld && welt) return svgWorldMapper(svg, feld, welt)(e.clientX, e.clientY);
    return null;
  };

  const aufbereiten = (p: Punkt, id: Id): Punkt => {
    let q: Punkt = [p[0] + versatzRef.current[0], p[1] + versatzRef.current[1]];
    if (snap !== undefined) {
      const [sx, sy] = typeof snap === "number" ? [snap, snap] : snap;
      q = [sx > 0 ? Math.round(q[0] / sx) * sx : q[0], sy > 0 ? Math.round(q[1] / sy) * sy : q[1]];
    }
    // Klemmen ZULETZT: der Constraint ist die Invariante, nicht das Raster.
    return clamp ? clamp(q, id) : q;
  };

  const beenden = (e?: ReactPointerEvent<SVGElement>) => {
    const id = aktivRef.current;
    if (id === null) return;
    if (e && zeigerRef.current !== null && e.pointerId !== zeigerRef.current) return;
    aktivRef.current = null;
    zeigerRef.current = null;
    versatzRef.current = [0, 0];
    setDragging(null);
    onEnd?.(id);
  };

  const starten = (id: Id, e: ReactPointerEvent<SVGElement>, sofortSetzen: boolean) => {
    if (disabled) return;
    if (aktivRef.current !== null && zeigerRef.current !== null && e.pointerId !== zeigerRef.current) return;
    const p = abbilden(e);
    zeigerRef.current = e.pointerId;
    try {
      (e.currentTarget as unknown as Element).setPointerCapture(e.pointerId);
    } catch {
      /* manche Zeiger lassen sich nicht fangen; der Drag funktioniert trotzdem */
    }
    aktivRef.current = id;
    setDragging(id);
    versatzRef.current = [0, 0];
    if (p && greifPosition) {
      const [hx, hy] = greifPosition(id);
      versatzRef.current = [hx - p[0], hy - p[1]];
    }
    if (p) {
      onStart?.(aufbereiten(p, id), id);
      if (sofortSetzen) onDrag(aufbereiten(p, id), id);
    }
  };

  return {
    dragging,
    handleProps: (id) => ({
      onPointerDown: (e) => starten(id, e, false),
      style: { cursor: dragging === id ? "grabbing" : cursor, touchAction: "none" },
    }),
    surfaceProps: (id) => ({
      onPointerDown: (e) => starten(id, e, true),
      style: { cursor: flaechenCursor, touchAction: "none" },
    }),
    svgProps: {
      onPointerMove: (e) => {
        const id = aktivRef.current;
        if (id === null) return;
        if (zeigerRef.current !== null && e.pointerId !== zeigerRef.current) return;
        const p = abbilden(e);
        if (p) onDrag(aufbereiten(p, id), id);
      },
      onPointerUp: beenden,
      onPointerLeave: beenden,
      onPointerCancel: beenden,
      onLostPointerCapture: beenden,
      // KEIN touch-action:none auf dem ganzen SVG: das wäre eine Scroll-Falle auf dem
      // Handy. Griffe (handleProps) und Flächen-Griffe (surfaceProps) setzen es selbst.
      style: {},
    },
  };
}

/**
 * Ziehbarer Punkt: unsichtbarer Trefferkreis (r ≥ 12, nimmt die Zeiger-Events)
 * unter einem kleinen sichtbaren Punkt (r = 4, `pointer-events: none`).
 * Die Füllung folgt der Widget-Oberfläche (`--w-bg`), damit der Punkt im
 * hellen Skript wie im dunklen Tooltip-Panel wie ein Loch im Kreis wirkt.
 */
export function DragHandle({
  x,
  y,
  r = 4,
  hitR = 12,
  farbe = FMM_COLORS.blau,
  fuellung = "var(--w-bg, #ffffff)",
  strichbreite = 2,
  label,
  labelDy = -12,
  labelDx = 8,
  aktiv = false,
  style,
  ...rest
}: {
  x: number;
  y: number;
  /** Radius des sichtbaren Punkts */
  r?: number;
  /** Radius der Trefferfläche (mindestens 12, craft.md) */
  hitR?: number;
  farbe?: string;
  fuellung?: string;
  strichbreite?: number;
  label?: string;
  labelDy?: number;
  labelDx?: number;
  /** wird gerade gezogen: Halo als Rückmeldung */
  aktiv?: boolean;
  style?: CSSProperties;
} & Omit<SVGProps<SVGCircleElement>, "cx" | "cy" | "r" | "style" | "x" | "y">) {
  return (
    <g>
      {aktiv && <circle cx={x} cy={y} r={r + 5} fill={farbe} opacity={0.18} pointerEvents="none" />}
      <circle
        cx={x}
        cy={y}
        r={Math.max(hitR, r)}
        fill="transparent"
        style={{ touchAction: "none", ...style }}
        {...rest}
      />
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={fuellung}
        stroke={farbe}
        strokeWidth={strichbreite}
        pointerEvents="none"
      />
      {label && (
        <text
          x={x + labelDx}
          y={y + labelDy}
          fontSize={12}
          fill={farbe}
          pointerEvents="none"
          textAnchor="middle"
        >
          {label}
        </text>
      )}
    </g>
  );
}
