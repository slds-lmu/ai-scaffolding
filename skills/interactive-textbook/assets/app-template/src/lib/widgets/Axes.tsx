/**
 * Achsen-Wrapper um die geteilten Zeichenkomponenten der lib.
 *
 * HISTORIE: Diese Datei entstand, weil `Plot`/`TransformCanvas` als
 * Canvas-Komponenten „eingefroren" waren — Ticks und Achsennamen mussten
 * deshalb als DOM-`<span>`s um den Canvas herum gelegt werden (`LabeledFrame`).
 * Mit der SVG-Fassung von `TransformCanvas` (2026-08-19) liegen Achsen, Ticks
 * und Achsennamen dort im SVG; `LabeledTransformCanvas` ist nur noch ein
 * durchreichender Alias, damit die ~30 Aufrufstellen unverändert bleiben.
 * `tickClass` wird von allen Aufrufern noch übergeben, aber nicht mehr
 * gebraucht (die SVGs lesen die CSS-Variablen --w-text/--w-axis, die das
 * dunkle Tooltip-Panel `.w-dark` überschreibt) — die Prop bleibt aus
 * Kompatibilitätsgründen im Typ und wird ignoriert.
 *
 * `LabeledPlot` ist seit Plot v2 (SVG, 2026-08-19) ebenfalls ein Alias;
 * die numerischen Helfer niceTicks/sigmaMax/maxAbsCoord werden
 * aus ./util re-exportiert.
 */
import type { ComponentProps } from "react";
import { Plot } from "./Plot";
import { TransformCanvas } from "./TransformCanvas";

export { niceTicks, sigmaMax, maxAbsCoord } from "./util";

/**
 * Durchreichender Alias: Plot v2 zeichnet Achsen, Ticks und Achsennamen selbst
 * im SVG; `tickClass` bleibt im Typ und wird ignoriert.
 */
export function LabeledPlot({
  tickClass: _tickClass,
  ...rest
}: ComponentProps<typeof Plot> & { tickClass?: string; xLabel: string; yLabel: string }) {
  return <Plot {...rest} />;
}

/**
 * Alias auf die SVG-`TransformCanvas`: reicht alle Props durch (inklusive
 * xLabel/yLabel, die dort Achsennamen im SVG erzeugen) und verschluckt das
 * historische `tickClass`.
 */
export function LabeledTransformCanvas({
  tickClass: _tickClass,
  ...rest
}: ComponentProps<typeof TransformCanvas> & { tickClass?: string }) {
  return <TransformCanvas {...rest} />;
}
