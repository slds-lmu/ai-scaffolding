import { useState, type ReactNode } from "react";

/**
 * Expandable "Deep dive" accordion, rendered after key paragraphs /
 * original graphics (spec: "expanded readings"). Collapsed by default so the
 * happy-path reading flow is not interrupted.
 */
export function ExpandedReading({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-4 rounded-lg border border-amber-300 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2 text-left font-medium text-amber-900 dark:text-amber-200"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span
          className={`inline-block transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          ▶
        </span>
        <span className="text-amber-600 dark:text-amber-400">Deep dive:</span> {title}
      </button>
      {/* keep mounted when closed so widget state (sliders etc.) survives */}
      <div hidden={!open} className="border-t border-amber-200 px-4 py-3 dark:border-amber-800">
        {children}
      </div>
    </div>
  );
}
