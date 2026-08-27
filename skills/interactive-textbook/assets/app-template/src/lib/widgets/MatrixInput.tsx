/**
 * Kleine Matrixeingabe und -anzeige.
 *
 * Einsicht: Eine Zahleneingabe muss Zwischenzustände beim Tippen bewahren;
 * erst eine vollständige endliche Zahl verändert die mathematische Matrix.
 * Farben: Oberfläche/Text/Rand kommen von --w-bg/--w-text/--w-border, damit
 * dieselbe Matrix auf Seite und im dunklen Tooltip lesbar bleibt.
 * Provenienz: String-State- und Tangle-Scrub-Muster nach
 * explorable-widgets/references/craft.md. Keine Verdiktzahlen (2026-08-19).
 */
import { useEffect, useRef, useState } from "react";
import { clamp, fmtDe } from "./util";

type MatrixInputProps = {
  value: number[][];
  onChange?: (m: number[][]) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Bildschirmleser-Label je Zelle; Standard ist a_{i,j}. */
  cellLabels?: string[][];
  /** Rendert dieselbe Klammernotation ohne editierbare Eingaben. */
  readOnly?: boolean;
  /** Horizontal ziehen verändert eine Zelle um einen Schritt pro vier Pixel. */
  scrub?: boolean;
};

/** Anzeige: kurze Dezimaldarstellung (Gleitkommarauschen 1,2000000000000002 wird weggerundet). */
const displayNumber = (value: number) => {
  if (!Number.isFinite(value)) return "";
  const r = Number(value.toFixed(10));
  return String(Object.is(r, -0) ? 0 : r).replace(".", ",").replace(/^-/, "−");
};
const draftsFor = (value: number[][]) => value.map((row) => row.map(displayNumber));

function parseDraft(draft: string): number | null {
  const normalized = draft.trim().replace(/,/g, ".").replace(/−/g, "-");
  if (!normalized || normalized === "-" || !/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function matrixStyle(columns: number) {
  return { gridTemplateColumns: `repeat(${columns}, minmax(0, 3.5rem))` };
}

/** Read-only matrix with the same bracket styling as <MatrixInput>. */
export function MatrixDisplay({
  value,
  fmt = fmtDe,
}: {
  value: number[][];
  fmt?: (value: number) => string;
}) {
  const columns = value[0]?.length ?? 0;
  return (
    <div
      aria-label="Matrix"
      className="inline-grid gap-1 rounded border-x-2 px-1.5 py-1 align-middle font-mono text-xs"
      style={{ ...matrixStyle(columns), borderColor: "var(--w-border)", color: "var(--w-text)" }}
    >
      {value.map((row, i) =>
        row.map((entry, j) => (
          <span key={`${i}-${j}`} className="min-w-0 px-1 py-0.5 text-center tabular-nums">
            {fmt(entry)}
          </span>
        ))
      )}
    </div>
  );
}

/** Editable numeric matrix (small, e.g. 2×2 / 3×3) with safe string drafts. */
export function MatrixInput({
  value,
  onChange,
  step = 0.1,
  min,
  max,
  cellLabels,
  readOnly = false,
  scrub = false,
}: MatrixInputProps) {
  const [drafts, setDrafts] = useState(() => draftsFor(value));
  const activeCell = useRef<string | null>(null);
  const dragging = useRef<{ i: number; j: number; x: number; value: number; scrubbing: boolean } | null>(null);
  const shape = value.map((row) => row.length).join(",");

  // Externe Änderungen (etwa ein Preset) werden übernommen. Der gerade
  // bearbeitete String bleibt dabei unangetastet, bis Blur ihn normalisiert.
  useEffect(() => {
    setDrafts((current) =>
      value.map((row, i) =>
        row.map((entry, j) => (activeCell.current === `${i}-${j}` ? current[i]?.[j] ?? "" : displayNumber(entry)))
      )
    );
  }, [value, shape]);

  if (readOnly) return <MatrixDisplay value={value} />;
  const columns = value[0]?.length ?? 0;

  const commit = (i: number, j: number, parsed: number) => {
    const bounded = clamp(parsed, min ?? -Infinity, max ?? Infinity);
    const next = value.map((row) => [...row]);
    next[i][j] = bounded;
    onChange?.(next);
    return bounded;
  };

  return (
    <div
      className="inline-grid gap-1 rounded border-x-2 px-1.5 py-1 align-middle"
      style={{ ...matrixStyle(columns), borderColor: "var(--w-border)" }}
    >
      {value.map((row, i) =>
        row.map((entry, j) => {
          const key = `${i}-${j}`;
          return (
            <input
              key={key}
              type="text"
              inputMode="decimal"
              aria-label={cellLabels?.[i]?.[j] ?? `a_{${i + 1},${j + 1}}`}
              value={drafts[i]?.[j] ?? displayNumber(entry)}
              onFocus={() => {
                activeCell.current = key;
              }}
              onChange={(event) => {
                const draft = event.target.value;
                setDrafts((current) => current.map((r, ri) => r.map((v, rj) => (ri === i && rj === j ? draft : v))));
                const parsed = parseDraft(draft);
                if (parsed !== null) commit(i, j, parsed);
              }}
              onBlur={(event) => {
                activeCell.current = null;
                const parsed = parseDraft(event.currentTarget.value);
                const normalized = parsed === null ? entry : commit(i, j, parsed);
                setDrafts((current) => current.map((r, ri) => r.map((v, rj) => (ri === i && rj === j ? displayNumber(normalized) : v))));
              }}
              onPointerDown={(event) => {
                if (!scrub) return;
                dragging.current = { i, j, x: event.clientX, value: entry, scrubbing: false };
              }}
              onPointerMove={(event) => {
                const drag = dragging.current;
                if (!drag || drag.i !== i || drag.j !== j) return;
                // Ein Klick bleibt ein normaler Texteingabe-Klick: Erst nach
                // einer klaren Horizontalbewegung beginnen wir zu scrubben.
                if (!drag.scrubbing) {
                  if (Math.abs(event.clientX - drag.x) < 5) return;
                  drag.scrubbing = true;
                  try {
                    event.currentTarget.setPointerCapture(event.pointerId);
                  } catch {
                    // Ein verlorener Pointer bleibt eine normale Texteingabe.
                    return;
                  }
                }
                const roh = drag.value + Math.round((event.clientX - drag.x) / 4) * step;
                const dez = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
                const next = commit(i, j, Number(roh.toFixed(Math.min(10, dez))));
                setDrafts((current) => current.map((r, ri) => r.map((v, rj) => (ri === i && rj === j ? displayNumber(next) : v))));
              }}
              onPointerUp={() => {
                dragging.current = null;
              }}
              onPointerCancel={() => {
                dragging.current = null;
              }}
              onLostPointerCapture={() => {
                dragging.current = null;
              }}
              className="w-full rounded border px-1 py-0.5 text-center font-mono text-xs tabular-nums"
              style={{
                backgroundColor: "var(--w-bg)",
                borderColor: "var(--w-border)",
                color: "var(--w-text)",
                cursor: scrub ? "ew-resize" : undefined,
              }}
            />
          );
        })
      )}
    </div>
  );
}
