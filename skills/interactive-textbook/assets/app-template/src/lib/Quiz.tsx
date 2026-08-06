/**
 * Selbsttest-Block (wahr/falsch) für die MDX-Autorenschicht.
 *
 *   ::::quiz
 *
 *   :::frage{wahr}
 *   Der Algorithmus ist *exakt*.
 *
 *   Es gilt $f(n) = \wt f(n)$: der Algorithmus liefert genau die definierten Zahlen.
 *   :::
 *
 *   ::::
 *
 * Der ERSTE Block einer Frage ist die Aussage, alles Weitere die Erklärung.
 * Ersetzt die bisher pro Kapitel kopierten QuizWidget-Varianten.
 */
import { Children, createContext, useContext, useId, useState, type ReactNode } from "react";

interface QuizApi {
  /** Antwort einer Frage; null = noch nicht beantwortet */
  answer: (key: string) => boolean | null;
  pick: (key: string, v: boolean) => void;
}

const Ctx = createContext<QuizApi | null>(null);

export function Quiz({ children }: { children: ReactNode }) {
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  // Schlüssel ist die von React vergebene useId der jeweiligen <Frage>, nicht
  // eine im Render hochgezählte Nummer: ein später montierendes <Frage>
  // bekäme sonst wieder 0 und teilte sich den Zustand mit der ersten.
  const api: QuizApi = {
    answer: (k) => (k in chosen ? chosen[k] : null),
    pick: (k, v) => setChosen((c) => ({ ...c, [k]: v })),
  };
  return (
    <Ctx.Provider value={api}>
      <div className="space-y-3">{children}</div>
    </Ctx.Provider>
  );
}

export function Frage({ wahr, children }: { wahr: boolean; children: ReactNode }) {
  const api = useContext(Ctx);
  const labelId = useId();
  const key = labelId;
  if (!api) throw new Error("<Frage> darf nur in <Quiz> stehen");

  const items = Children.toArray(children);
  const statement = items[0];
  const expl = items.slice(1);

  const c = api.answer(key);
  const answered = c !== null;
  const correct = answered && c === wahr;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="rounded border border-slate-200 p-3 dark:border-slate-700"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div id={labelId} className="grow [&>p]:m-0">
          {statement}
        </div>
        <span className="flex gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={answered && c === v}
              className={`rounded px-2 py-1 text-xs font-medium ${
                answered && c === v
                  ? correct
                    ? "bg-emerald-600 text-white"
                    : "bg-red-600 text-white"
                  : "bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600"
              }`}
              onClick={() => api.pick(key, v)}
            >
              {v ? "wahr" : "falsch"}
            </button>
          ))}
        </span>
      </div>
      {answered && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-2 text-sm ${
            correct ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
          }`}
        >
          <span className="font-medium">
            {correct ? "Richtig! " : `Leider nein, die Aussage ist ${wahr ? "wahr" : "falsch"}. `}
          </span>
          <div className="text-slate-600 dark:text-slate-300 [&>p]:my-1">
            {expl}
          </div>
        </div>
      )}
    </div>
  );
}
