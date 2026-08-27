/**
 * Einheitlicher Parameterregler.
 *
 * Einsicht: Ein nativer Regler bleibt der zugänglichste kontinuierliche
 * Steuerweg; seine Zahl muss dabei im deutschen Skriptformat lesbar sein.
 * Farben: accent färbt nur den zugehörigen Regler, Text bleibt --w-text.
 * Provenienz: Layout- und Formatmuster nach explorable-widgets/craft.md;
 * keine Verdiktzahlen (2026-08-19).
 */
import { useId } from "react";
import { decimalsFromStep, fmtDe } from "./util";

export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  fmt,
  accent,
  unit,
  marks,
  disabled,
  id,
  ariaLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  fmt?: (v: number) => string;
  accent?: string;
  unit?: string;
  marks?: number[];
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = marks?.length ? `${inputId}-marks` : undefined;
  const format = fmt ?? ((v: number) => fmtDe(v, decimalsFromStep(step)));
  return (
    <div className="my-1 [container-type:inline-size]">
      <label className="flex min-w-0 items-center gap-3 [@container(max-width:359px)]:flex-wrap" htmlFor={inputId}>
        <span className="w-28 shrink-0 min-w-0 text-right text-sm [@container(max-width:359px)]:text-left">{label}</span>
        <input
          id={inputId}
          type="range"
          className="min-w-0 grow accent-sky-600"
          min={min}
          max={max}
          step={step}
          value={value}
          list={listId}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-valuetext={`${format(value)}${unit ? ` ${unit}` : ""}`}
          style={accent ? { accentColor: accent } : undefined}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {marks?.length ? <datalist id={listId}>{marks.map((mark) => <option key={mark} value={mark} />)}</datalist> : null}
        <span className="w-14 shrink-0 font-mono text-xs tabular-nums">{format(value)}{unit ? ` ${unit}` : ""}</span>
      </label>
    </div>
  );
}
