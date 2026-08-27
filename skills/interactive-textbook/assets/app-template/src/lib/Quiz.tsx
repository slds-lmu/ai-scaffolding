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
 *
 * Alle sichtbaren UI-Texte sind lokalisierbar (Muster wie beim
 * TooltipProvider): Defaults sind DEUTSCH, eine anderssprachige App setzt
 * eigene Labels per <QuizLabelsProvider labels={…}> um den Baum oder per
 * labels-Prop an einem einzelnen <Quiz>.
 */
import { Children, createContext, useContext, useId, useState, type ReactNode } from "react";
import { fmtDe } from "./widgets/util";
import { W_INPUT, W_MUTED } from "./widgets/surface";

export interface QuizLabels {
  /** Beschriftung des „wahr"-Knopfs */
  true: string;
  /** Beschriftung des „falsch"-Knopfs */
  false: string;
  /** Feedback bei richtiger Antwort */
  correct: string;
  /** Feedback bei falscher Antwort; bekommt gesagt, ob die Aussage wahr ist */
  incorrect: (statementIsTrue: boolean) => string;
  /** Beschriftung des Prüfen-Knopfs einer Zahlenfrage. */
  check: string;
  /** Rückmeldung für eine richtige Zahlenfrage. */
  numericCorrect: (deviation: string) => string;
  /** Rückmeldung für eine falsche Zahlenfrage. */
  numericIncorrect: (answer: string) => string;
  /** Rückmeldung, wenn die Eingabe keine endliche Zahl ist. */
  numericInvalid: string;
}

const DEFAULT_LABELS: QuizLabels = {
  true: "true",
  false: "false",
  correct: "Correct!",
  incorrect: (statementIsTrue) =>
    `Not quite — the statement is ${statementIsTrue ? "true" : "false"}.`,
  check: "Check",
  numericCorrect: (deviation) => `correct (deviation ${deviation})`,
  numericIncorrect: (answer) => `not quite: ${answer} is outside the tolerance`,
  numericInvalid: "Please enter a number.",
};

const LabelCtx = createContext<Partial<QuizLabels>>({});

/** Setzt Quiz-Labels app-weit (z. B. um App.tsx gelegt). */
export function QuizLabelsProvider({
  children,
  labels,
}: {
  children: ReactNode;
  labels: Partial<QuizLabels>;
}) {
  return <LabelCtx.Provider value={labels}>{children}</LabelCtx.Provider>;
}

interface QuizApi {
  /** Antwort einer Frage; null = noch nicht beantwortet */
  answer: (key: string) => boolean | null;
  pick: (key: string, v: boolean) => void;
  /** fertig gemergte Labels für die <Frage>-Kinder */
  labels: QuizLabels;
}

const Ctx = createContext<QuizApi | null>(null);

export function Quiz({
  children,
  labels,
}: {
  children: ReactNode;
  labels?: Partial<QuizLabels>;
}) {
  const inherited = useContext(LabelCtx);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  // Schlüssel ist die von React vergebene useId der jeweiligen <Frage>, nicht
  // eine im Render hochgezählte Nummer: ein später montierendes <Frage>
  // bekäme sonst wieder 0 und teilte sich den Zustand mit der ersten.
  const api: QuizApi = {
    answer: (k) => (k in chosen ? chosen[k] : null),
    pick: (k, v) => setChosen((c) => ({ ...c, [k]: v })),
    labels: { ...DEFAULT_LABELS, ...inherited, ...labels },
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
  const L = api.labels;

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
              {v ? L.true : L.false}
            </button>
          ))}
        </span>
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={answered ? `mt-2 text-sm ${correct ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}` : "sr-only"}
      >
        {answered && <>
          <span className="font-medium">
            {correct ? L.correct : L.incorrect(wahr)}{" "}
          </span>
          <div className="text-slate-600 dark:text-slate-300 [&>p]:my-1">
            {expl}
          </div>
        </>}
      </div>
    </div>
  );
}

/**
 * Zahlenfrage für Selbsttests, deren Lösung aus einem Widget abgelesen wird.
 * Der erste Kindblock ist die Frage, weitere Blöcke erscheinen erst nach
 * „Prüfen" als Erklärung.
 */
export function Zahlfrage({
  loesung,
  toleranz,
  einheit,
  children,
}: {
  loesung: number;
  toleranz: number;
  einheit?: string;
  children: ReactNode;
}) {
  const api = useContext(Ctx);
  const labelId = useId();
  const [draft, setDraft] = useState("");
  const [checked, setChecked] = useState(false);
  const [answer, setAnswer] = useState<number | null>(null);
  if (!api) throw new Error("<Zahlfrage> darf nur in <Quiz> stehen");
  const L = api.labels;
  const items = Children.toArray(children);
  const question = items[0];
  const expl = items.slice(1);
  const parsed = Number(draft.trim().replace(/,/g, ".").replace(/−/g, "-"));
  const valid = draft.trim() !== "" && Number.isFinite(parsed);
  const deviation = answer === null ? null : Math.abs(answer - loesung);
  const correct = deviation !== null && deviation <= toleranz;
  const unit = einheit ? ` ${einheit}` : "";
  const precision = Math.max(2, Math.min(10, toleranz > 0 ? Math.ceil(-Math.log10(toleranz)) : 2));

  return (
    <div role="group" aria-labelledby={labelId} className="rounded border border-slate-200 p-3 dark:border-slate-700">
      <div id={labelId} className="[&>p]:m-0">{question}</div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setChecked(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (!valid) return;
              setAnswer(parsed);
              setChecked(true);
            }
          }}
          aria-label={einheit ? `Antwort in ${einheit}` : "Numerische Antwort"}
          className={`w-28 font-mono tabular-nums ${W_INPUT}`}
        />
        {einheit ? <span className={`text-sm ${W_MUTED}`}>{einheit}</span> : null}
        <button
          type="button"
          disabled={!valid}
          aria-disabled={!valid}
          className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            if (!valid) return;
            setAnswer(parsed);
            setChecked(true);
          }}
        >
          {L.check}
        </button>
      </div>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={checked ? `mt-2 text-sm ${correct ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}` : "sr-only"}
      >
        {checked && <>
          <span className="font-medium">
            {!valid
              ? L.numericInvalid
              : correct
                ? L.numericCorrect(`${fmtDe(deviation!, precision)}${unit}`)
                : L.numericIncorrect(`${fmtDe(answer!, precision)}${unit}`)}
          </span>
          <div className="text-slate-600 dark:text-slate-300 [&>p]:my-1">{expl}</div>
        </>}
      </div>
    </div>
  );
}
