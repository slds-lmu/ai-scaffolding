import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Expandable "Deep dive" accordion, rendered after key paragraphs /
 * original graphics (spec: "expanded readings"). Collapsed by default so the
 * happy-path reading flow is not interrupted.
 */
export function ExpandedReading({
  title,
  label = "Deep dive",
  children,
}: {
  title: string;
  /** badge text; German projects pass "Vertiefung" */
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const openForFragment = () => setOpen(true);
    root.addEventListener("fmm-open", openForFragment);
    return () => root.removeEventListener("fmm-open", openForFragment);
  }, []);

  return (
    <div ref={rootRef} data-deep className="my-5 overflow-hidden rounded-lg border border-amber-600/30 bg-amber-50/60 dark:border-amber-400/25 dark:bg-amber-950/25">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-display text-[15px] font-semibold text-amber-900 hover:bg-amber-600/5 dark:text-amber-100 dark:hover:bg-amber-400/5"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span
          className={`inline-block transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          ▶
        </span>
        <span
          data-deep-label
          className="rounded-full bg-amber-600/10 px-2.5 py-0.5 text-[11.5px] font-semibold uppercase tracking-wider text-amber-800 dark:bg-amber-400/15 dark:text-amber-200"
        >
          {label}
        </span>{" "}
        {title}
      </button>
      {/* keep mounted when closed so widget state (sliders etc.) survives */}
      <div hidden={!open} className="border-t border-amber-600/20 px-4 py-3 dark:border-amber-400/20">
        {children}
      </div>
    </div>
  );
}
