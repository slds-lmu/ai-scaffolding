/** Labeled slider for widget parameters. */
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.01,
  fmt = (v: number) => v.toFixed(2),
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="my-1 flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-right">{label}</span>
      <input
        type="range"
        className="grow accent-sky-600"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-14 shrink-0 font-mono text-xs">{fmt(value)}</span>
    </label>
  );
}
