import type { ReactNode } from "react";

/**
 * Kasten fuer ein interaktives Widget samt Aufgabe und Auswertung.
 *
 * Im Gegensatz zur `ExpandedReading`-Vertiefung ist das KEIN Zusatzstoff,
 * sondern Kernmaterial des Skripts — deshalb immer aufgeklappt und mit
 * eigener (blauer) Marke. Widgets duerfen trotzdem auch in einer
 * Vertiefung stehen: dann ist der umgebende Stoff optional, nicht das Widget.
 */
export function Interaktiv({
  title,
  label = "Interactive",
  children,
}: {
  title: string;
  /** badge text; German projects pass "Interaktiv" */
  label?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-interaktiv
      className="my-5 overflow-hidden rounded-lg border border-sky-700/30 bg-sky-50/60 dark:border-sky-400/25 dark:bg-sky-950/25"
    >
      <h4 className="m-0 flex items-center gap-2.5 px-4 py-2.5 font-display text-[15px] font-semibold text-sky-900 dark:text-sky-100">
        <span
          data-interaktiv-label
          className="rounded-full bg-sky-700/10 px-2.5 py-0.5 text-[11.5px] font-semibold uppercase tracking-wider text-sky-800 dark:bg-sky-400/15 dark:text-sky-200"
        >
          {label}
        </span>{" "}
        {title}
      </h4>
      <div className="border-t border-sky-700/20 px-4 py-3 dark:border-sky-400/20">{children}</div>
    </section>
  );
}
