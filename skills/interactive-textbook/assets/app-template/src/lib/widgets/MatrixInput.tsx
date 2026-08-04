/** Editable numeric matrix (small, e.g. 2x2 / 3x3) for widget inputs. */
export function MatrixInput({
  value,
  onChange,
  step = 0.1,
}: {
  value: number[][];
  onChange: (m: number[][]) => void;
  step?: number;
}) {
  return (
    <div
      className="inline-grid gap-1 rounded border-x-2 border-slate-500 px-1.5 py-1 align-middle"
      style={{ gridTemplateColumns: `repeat(${value[0].length}, minmax(0,3.5rem))` }}
    >
      {value.map((row, i) =>
        row.map((v, j) => (
          <input
            key={`${i}-${j}`}
            type="number"
            step={step}
            value={v}
            onChange={(e) => {
              const m = value.map((r) => [...r]);
              m[i][j] = Number(e.target.value);
              onChange(m);
            }}
            className="w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-center font-mono text-xs dark:border-slate-600 dark:bg-slate-800"
          />
        ))
      )}
    </div>
  );
}
