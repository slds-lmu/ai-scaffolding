import { useMemo, useState, type KeyboardEvent } from "react";

/**
 * Interaktiver Abhängigkeitsgraph (Konzept- und Kurskarten).
 *
 * Knotenpositionen werden von Hand vergeben — wie bei allen SVG-Widgets des
 * Skripts. Automatisches Layout (dagre & Co.) wäre eine weitere Abhängigkeit
 * und legt gerade die didaktisch gemeinten Karten selten gut aus.
 *
 * Interaktion: Zeigen (Maus/Fokus) hebt einen Knoten samt direkten Vorgängern
 * und Nachfolgern hervor, Klick/Enter heftet die Auswahl fest; die Zeile unter
 * dem Graphen benennt „baut auf" / „führt zu" und verlinkt ggf. das Kapitel.
 * Auf Touch-Geräten ersetzt das Antippen das Zeigen — Navigation passiert
 * bewusst NICHT direkt am Knoten, sondern über den Link in der Zeile.
 */

export interface FlowNode {
  id: string;
  /** Titelzeilen im Kasten (meist eine). */
  label: string[];
  /** Kleine farbige Zeile über dem Titel, z. B. "Kap. 7" bei Anker-Knoten. */
  kicker?: string;
  /** Nummer im farbigen Plättchen links vom Titel (Kurskarte). */
  badge?: string;
  x: number; // Mittelpunkt
  y: number;
  w?: number;
  h?: number;
  group: string;
  /** Ziel-URL des Kapitels; erscheint als Link in der Detailzeile. */
  href?: string;
  /** Anzeigename in der Detailzeile, falls nicht Badge + Label. */
  name?: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  /**
   * Verlauf: "down" = Bezier von Unterkante zu Oberkante (Schichtlayout);
   * "left"/"right" = Bogen über den Seitenrand (Wirbelsäulen-Layout).
   */
  side?: "down" | "left" | "right";
}

export interface FlowGroup {
  key: string;
  label: string;
  color: string;
}

const DIM = 0.22;

export function ConceptFlow({
  nodes,
  edges,
  groups,
  ariaLabel,
  hint = "Zeigen oder Antippen hebt hervor, worauf ein Kasten aufbaut und wohin er führt; Klick heftet die Auswahl fest.",
  openLabel = "öffnen",
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  groups: FlowGroup[];
  ariaLabel: string;
  hint?: string;
  openLabel?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = pinned ?? hover;

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const color = useMemo(() => new Map(groups.map((g) => [g.key, g.color])), [groups]);
  const validEdges = useMemo(() => {
    const valid = edges.filter((e) => byId.has(e.from) && byId.has(e.to));
    if (import.meta.env?.DEV && valid.length !== edges.length) {
      const invalid = edges.filter((e) => !byId.has(e.from) || !byId.has(e.to));
      console.warn("[ConceptFlow] Kanten mit unbekanntem Knoten ignoriert", invalid);
    }
    return valid;
  }, [edges, byId]);

  const size = (n: FlowNode) => ({
    w: n.w ?? 168,
    h: n.h ?? (n.kicker ? 30 + n.label.length * 16 : 16 + n.label.length * 17),
  });

  const box = useMemo(() => {
    let mx = 0;
    let my = 0;
    for (const n of nodes) {
      const { w, h } = size(n);
      mx = Math.max(mx, n.x + w / 2);
      my = Math.max(my, n.y + h / 2);
    }
    return { w: mx + 8, h: my + 10 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // Mehrere Kanten am selben Ankerpunkt fächern auf, statt sich zu stapeln.
  const anchorShift = useMemo(() => {
    const buckets = new Map<string, FlowEdge[]>();
    const keyOf = (e: FlowEdge, end: "s" | "t") => {
      const kind = e.side ?? "down";
      const node = end === "s" ? e.from : e.to;
      return `${node}|${end}|${kind}`;
    };
    for (const e of validEdges) {
      for (const end of ["s", "t"] as const) {
        const k = keyOf(e, end);
        buckets.set(k, [...(buckets.get(k) ?? []), e]);
      }
    }
    const shift = new Map<string, number>();
    for (const [k, list] of buckets) {
      // stabil sortieren, damit sich die Fächer nicht kreuzen: nach y bzw. x
      // des jeweils anderen Endes
      const sorted = [...list].sort((a, b) => {
        const [nodeId, end] = k.split("|");
        const other = (e: FlowEdge) => byId.get((end === "s" ? e.to : e.from) as string)!;
        void nodeId;
        const ka = other(a);
        const kb = other(b);
        return ka.y - kb.y || ka.x - kb.x;
      });
      sorted.forEach((e, i) => {
        shift.set(`${validEdges.indexOf(e)}|${k.split("|")[1]}`, (i - (sorted.length - 1) / 2) * 13);
      });
    }
    return shift;
  }, [validEdges, byId]);

  const paths = useMemo(() => {
    return validEdges.map((e, i) => {
      const s = byId.get(e.from)!;
      const t = byId.get(e.to)!;
      const ss = size(s);
      const ts = size(t);
      const ds = anchorShift.get(`${i}|s`) ?? 0;
      const dt = anchorShift.get(`${i}|t`) ?? 0;
      const kind = e.side ?? "down";

      if (kind === "left" || kind === "right") {
        const dir = kind === "left" ? -1 : 1;
        const sx = s.x + (dir * ss.w) / 2;
        const sy = s.y + ds;
        const tx = t.x + (dir * ts.w) / 2;
        const ty = t.y + dt;
        const span = Math.abs(t.y - s.y);
        const bulge = Math.min(26 + span * 0.28, 165);
        const rand = dir === -1 ? Math.min(sx, tx) : Math.max(sx, tx);
        const cx = rand + dir * bulge;
        return {
          e,
          d: `M ${sx} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${tx} ${ty}`,
          tip: `M ${tx} ${ty} l ${dir * 9} -4.5 l 0 9 Z`,
        };
      }

      const sx = s.x + ds;
      const sy = s.y + ss.h / 2;
      const tx = t.x + dt;
      const ty = t.y - ts.h / 2;
      const c = Math.max((ty - sy) * 0.5, 16);
      return {
        e,
        d: `M ${sx} ${sy} C ${sx} ${sy + c}, ${tx} ${ty - c}, ${tx} ${ty}`,
        tip: `M ${tx} ${ty} l -4.5 -9 l 9 0 Z`,
      };
    });
  }, [validEdges, byId, anchorShift]);

  const neighbors = useMemo(() => {
    if (!active) return null;
    const set = new Set([active]);
    const pre: string[] = [];
    const post: string[] = [];
    for (const e of validEdges) {
      if (e.to === active) {
        set.add(e.from);
        pre.push(e.from);
      }
      if (e.from === active) {
        set.add(e.to);
        post.push(e.to);
      }
    }
    return { set, pre, post };
  }, [active, validEdges]);

  const nodeName = (id: string) => {
    const n = byId.get(id);
    if (!n) return id;
    if (n.name) return n.name;
    return n.badge ? `${n.badge} · ${n.label.join(" ")}` : n.label.join(" ");
  };

  const onKey = (ev: KeyboardEvent, id: string) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      setPinned((p) => (p === id ? null : id));
    }
    if (ev.key === "Escape") setPinned(null);
  };

  const sel = active ? byId.get(active) : null;

  return (
    <div className="text-slate-800 dark:text-slate-100">
      <p className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {groups.map((g) => (
          <span key={g.key} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: g.color }}
            />
            {g.label}
          </span>
        ))}
      </p>

      <svg
        viewBox={`0 0 ${box.w} ${box.h}`}
        role="group"
        aria-label={ariaLabel}
        className="w-full"
        onMouseLeave={() => setHover(null)}
      >
        {paths.map(({ e, d, tip }, i) => {
          const on = active !== null && (e.from === active || e.to === active);
          const col = color.get(byId.get(e.from)?.group ?? "") ?? "currentColor";
          return (
            <g
              key={i}
              opacity={active === null ? 0.42 : on ? 0.95 : 0.1}
              style={{ transition: "opacity 120ms" }}
            >
              <path d={d} fill="none" stroke={col} strokeWidth={on ? 2.2 : 1.4} />
              <path d={tip} fill={col} />
            </g>
          );
        })}

        {nodes.map((n) => {
          const { w, h } = size(n);
          const col = color.get(n.group) ?? "currentColor";
          const on = active === null || neighbors?.set.has(n.id);
          const isActive = n.id === active;
          const lineY0 = n.y - ((n.label.length - 1) * (n.kicker ? 16 : 17)) / 2 + (n.kicker ? 7 : 0);
          return (
            <g
              key={n.id}
              role="button"
              tabIndex={0}
              aria-pressed={pinned === n.id}
              aria-label={nodeName(n.id)}
              className="cursor-pointer focus:outline-none"
              opacity={on ? 1 : DIM}
              style={{ transition: "opacity 120ms" }}
              onMouseEnter={() => setHover(n.id)}
              onFocus={() => setHover(n.id)}
              onBlur={() => setHover((x) => (x === n.id ? null : x))}
              onClick={() => setPinned((p) => (p === n.id ? null : n.id))}
              onKeyDown={(ev) => onKey(ev, n.id)}
            >
              <rect
                x={n.x - w / 2}
                y={n.y - h / 2}
                width={w}
                height={h}
                rx={8}
                fill={col}
                fillOpacity={isActive ? 0.22 : 0.1}
                stroke={col}
                strokeWidth={isActive ? 2.4 : 1.5}
              />
              {n.kicker && (
                <text
                  x={n.x}
                  y={n.y - h / 2 + 13}
                  textAnchor="middle"
                  fontSize={9.5}
                  fontWeight={650}
                  letterSpacing={0.6}
                  fill={col}
                >
                  {n.kicker.toUpperCase()}
                </text>
              )}
              {n.badge && (
                <>
                  <rect
                    x={n.x - w / 2 + 7}
                    y={n.y - 10.5}
                    width={25}
                    height={21}
                    rx={5}
                    fill={col}
                  />
                  <text
                    x={n.x - w / 2 + 19.5}
                    y={n.y + 4.5}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={700}
                    fill="#fff"
                  >
                    {n.badge}
                  </text>
                </>
              )}
              {n.label.map((line, i) => (
                <text
                  key={`${n.id}-${i}`}
                  x={n.badge ? n.x - w / 2 + 40 : n.x}
                  y={lineY0 + i * (n.kicker ? 16 : 17) + 4.5}
                  textAnchor={n.badge ? "start" : "middle"}
                  fontSize={12.5}
                  fontWeight={isActive ? 600 : 450}
                  fill="currentColor"
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </svg>

      <div className="mt-1 min-h-16 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] leading-snug text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
        {sel && neighbors ? (
          <>
            <p>
              <strong className="text-slate-800 dark:text-slate-100">{nodeName(sel.id)}</strong>
              {sel.href && (
                <>
                  {" · "}
                  <a href={sel.href} className="text-sky-700 underline dark:text-sky-400">
                    {openLabel} →
                  </a>
                </>
              )}
            </p>
            {neighbors.pre.length > 0 && (
              <p>
                <span className="text-slate-400 dark:text-slate-500">baut auf:</span>{" "}
                {neighbors.pre.map(nodeName).join(" · ")}
              </p>
            )}
            {neighbors.post.length > 0 && (
              <p>
                <span className="text-slate-400 dark:text-slate-500">führt zu:</span>{" "}
                {neighbors.post.map(nodeName).join(" · ")}
              </p>
            )}
          </>
        ) : (
          <p className="italic text-slate-400 dark:text-slate-500">{hint}</p>
        )}
      </div>
    </div>
  );
}
