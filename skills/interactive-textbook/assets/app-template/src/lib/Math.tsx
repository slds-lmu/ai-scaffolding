/**
 * MathJax wrappers backed by the BUNDLED MathJax (see src/mathjax-setup.ts +
 * the tex-svg import in main.tsx) — no CDN, works offline / from a single
 * self-contained HTML file.
 *
 * Each component renders its raw TeX (delimited) once; the element is then
 * OWNED imperatively (React only ever knows the initial text child, so it
 * never fights MathJax over the typeset DOM). When the TeX changes (live
 * widget readouts) the new formula is typeset in a hidden sibling and
 * swapped in atomically — the OLD rendering stays visible meanwhile, so
 * slider-driven updates never flash raw TeX or jump the layout twice.
 */
import { useEffect, useRef, type ReactNode, type RefObject } from "react";

/**
 * Lazy, BATCHED typesetting. Typesetting every <M>/<MD> individually on
 * mount froze the main thread for seconds on full-chapter pages ("page
 * unresponsive" in Chrome). Instead each element registers with a shared
 * IntersectionObserver and is typeset only when it approaches the viewport
 * (or becomes visible at all — collapsed Deep dives and unopened tooltips
 * cost nothing at load). Ready elements are typeset in small batches with
 * one macrotask gap between batches so the page stays responsive.
 */
const queue = new Set<Element>();
let flushScheduled = false;
let mjBusy = false;
let mjWaitTries = 0;
const BATCH = 48;

function schedule() {
  if (flushScheduled || mjBusy) return;
  flushScheduled = true;
  window.setTimeout(flush, 0);
}

function flush() {
  flushScheduled = false;
  if (mjBusy || queue.size === 0) return;
  const MJ = (window as { MathJax?: { typesetPromise?: (els: Element[]) => Promise<void> } })
    .MathJax;
  if (!MJ?.typesetPromise) {
    // MathJax bundle not initialized yet — retry briefly, but never forever
    // (a broken bundle would otherwise leave a 50 ms retry loop running for
    // the lifetime of the page)
    if (++mjWaitTries > 100) {
      console.error("MathJax failed to initialize — math left as raw TeX");
      queue.clear();
      return;
    }
    flushScheduled = true;
    window.setTimeout(flush, 50);
    return;
  }
  mjWaitTries = 0;
  const batch: Element[] = [];
  for (const el of queue) {
    // an element can be unmounted between enqueue and flush
    if (el.isConnected) batch.push(el);
    queue.delete(el);
    if (batch.length >= BATCH) break;
  }
  if (batch.length === 0) return; // all queued elements were disconnected
  mjBusy = true;
  // chainTypeset serializes against live-update typesets and converts a
  // synchronous throw into a caught rejection, so mjBusy can never latch
  void chainTypeset(() => MJ.typesetPromise!(batch)).then(() => {
    mjBusy = false;
    if (queue.size > 0) schedule();
  });
}

const io =
  typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver(
        (entries) => {
          let added = false;
          for (const en of entries) {
            if (en.isIntersecting) {
              io!.unobserve(en.target);
              queue.add(en.target);
              added = true;
            }
          }
          if (added) schedule();
        },
        // typeset well ahead of the viewport so scrolling rarely meets raw TeX
        { rootMargin: "1500px 0px 1500px 0px" }
      )
    : null;

type MJGlobal = {
  MathJax?: {
    typesetPromise?: (els: Element[]) => Promise<void>;
    typesetClear?: (els: Element[]) => void;
  };
};

// all typesetPromise calls (batch flush AND live updates) are serialized
// through one promise chain — MathJax v3 forbids concurrent typeset runs
let mjChain: Promise<void> = Promise.resolve();
function chainTypeset(job: () => Promise<void> | void): Promise<void> {
  mjChain = mjChain.then(job).catch((e: unknown) => console.error("MathJax:", e));
  return mjChain;
}

function useLazyTypeset(ref: RefObject<Element | null>, tex: string) {
  // lastTex (not a boolean "initialized") distinguishes first mount from a
  // real TeX change — a StrictMode effect replay with unchanged TeX must
  // NOT take the live-update path
  const lastTex = useRef<string | null>(null);
  const gen = useRef(0);
  const pendingTmp = useRef<Element | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (lastTex.current === null) {
      // initial mount: raw TeX is in the DOM; typeset lazily near-viewport
      lastTex.current = tex;
      if (io) io.observe(el);
      else {
        queue.add(el);
        schedule();
      }
      return;
    }
    if (lastTex.current === tex) {
      // Effect replay with unchanged TeX — in practice only React StrictMode,
      // which mounts, tears down, and mounts again. The unmount cleanup below
      // already unobserved this element, so returning here would leave it
      // registered nowhere and it would NEVER be typeset. That is exactly why
      // `npm run dev` used to render raw TeX across the whole app while the
      // production build was fine (StrictMode only double-invokes in dev).
      // Re-registering is safe: once MathJax has replaced the children there is
      // no delimiter left to find, so a repeat typeset is a no-op.
      if (io) io.observe(el);
      else {
        queue.add(el);
        schedule();
      }
      return;
    }
    // live update: typeset the NEW formula in a hidden sibling while the old
    // rendering stays visible, then swap atomically — no raw-TeX flash, no
    // double layout jump. The sibling clones the element's shell so its
    // classes (and for display math its width) give faithful metrics.
    lastTex.current = tex;
    const g = ++gen.current;
    io?.unobserve(el); // a still-pending initial typeset is superseded
    queue.delete(el);
    pendingTmp.current?.remove(); // coalesce: drop a superseded hidden buffer
    const tmp = el.cloneNode(false) as HTMLElement;
    tmp.style.visibility = "hidden";
    tmp.style.position = "absolute";
    if (el.tagName === "DIV" && (el as HTMLElement).clientWidth > 0) {
      // display math: an absolute box would shrink-to-fit, changing the
      // container width MathJax sees — pin it to the target's width
      tmp.style.width = `${(el as HTMLElement).clientWidth}px`;
    }
    tmp.textContent = tex;
    el.parentNode?.insertBefore(tmp, el.nextSibling);
    pendingTmp.current = tmp;
    void chainTypeset(() => {
      const MJ = (window as MJGlobal).MathJax;
      const done = () => {
        MJ?.typesetClear?.([tmp]);
        tmp.remove();
        if (pendingTmp.current === tmp) pendingTmp.current = null;
      };
      // stale update (slider moved on) or unmounted: skip the work entirely
      if (g !== gen.current || !el.isConnected) {
        done();
        return;
      }
      if (!MJ?.typesetPromise) {
        // MathJax not initialized yet — hand the element back to the batch
        // path (whose bounded retry loop covers late init) instead of
        // leaving it orphaned with raw TeX forever
        done();
        queue.add(el);
        schedule();
        return;
      }
      return MJ.typesetPromise([tmp])
        .then(() => {
          if (g === gen.current && el.isConnected) {
            // release BOTH old and new MathItem bookkeeping before the move:
            // after replaceChildren the rendered SVG lives on as plain DOM
            // that MathJax no longer needs to track
            MJ.typesetClear?.([el]);
            MJ.typesetClear?.([tmp]);
            el.replaceChildren(...Array.from(tmp.childNodes));
          }
        })
        // cleanup must run on rejection too, or the hidden node leaks
        .finally(done);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tex]);

  // unmount cleanup only. The element is captured at SETUP time: React nulls
  // ref.current before useEffect cleanups run on unmount, so reading the ref
  // inside the cleanup would always see null and clean up nothing.
  useEffect(() => {
    const el = ref.current;
    return () => {
      gen.current++; // invalidate any in-flight live update
      pendingTmp.current?.remove(); // drop its hidden buffer synchronously
      pendingTmp.current = null;
      if (el) {
        io?.unobserve(el);
        queue.delete(el);
        // release MathJax's internal MathItem bookkeeping for this node
        (window as MJGlobal).MathJax?.typesetClear?.([el]);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function TypesetSpan({ tex, className }: { tex: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // React must never reconcile the children after mount (MathJax owns them),
  // so the rendered text child is frozen to the FIRST tex value
  const initialTex = useRef(tex);
  useLazyTypeset(ref, tex);
  return (
    <span ref={ref} className={className}>
      {initialTex.current}
    </span>
  );
}

function TypesetDiv({ tex, className }: { tex: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const initialTex = useRef(tex);
  useLazyTypeset(ref, tex);
  return (
    <div ref={ref} className={className}>
      {initialTex.current}
    </div>
  );
}

/** Inline math: <M>{"\\lambda_1 \\geq \\lambda_2"}</M> */
export function M({ children }: { children: string }) {
  return <TypesetSpan tex={`\\(${children}\\)`} />;
}

/** Display math: <MD>{"\\mathbf{A} = \\mathbf{P}\\mathbf{D}\\mathbf{P}^{-1}"}</MD> */
export function MD({ children }: { children: string }) {
  return <TypesetDiv tex={`\\[${children}\\]`} className="my-3 overflow-x-auto" />;
}

/** Numbered display equation with right-aligned tag, e.g. (4.12). */
export function Eq({ tag, children }: { tag?: string; children: string }) {
  return (
    <div className="relative my-3">
      <TypesetDiv tex={`\\[${children}\\]`} className="overflow-x-auto pr-14" />
      {tag && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500">({tag})</span>
      )}
    </div>
  );
}

/** Theorem/Definition/Example block in the book's style. */
export function EnvBlock({
  kind,
  label,
  children,
}: {
  kind:
    | "Definition"
    | "Theorem"
    | "Satz"
    | "Lemma"
    | "Korollar"
    | "Corollary"
    | "Example"
    | "Beispiel"
    | "Remark"
    | "Bemerkung"
    | "Algorithmus"
    | "Algorithm";
  label: string;
  children: ReactNode;
}) {
  const colors: Record<string, string> = {
    Definition: "border-sky-500 bg-sky-50 dark:bg-sky-950/40",
    Theorem: "border-violet-500 bg-violet-50 dark:bg-violet-950/40",
    Satz: "border-violet-500 bg-violet-50 dark:bg-violet-950/40",
    Lemma: "border-violet-400 bg-violet-50/70 dark:bg-violet-950/30",
    Korollar: "border-violet-400 bg-violet-50/70 dark:bg-violet-950/30",
    Corollary: "border-violet-400 bg-violet-50/70 dark:bg-violet-950/30",
    Beispiel: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
    Bemerkung: "border-slate-400 bg-slate-50 dark:bg-slate-800/40",
    Algorithmus: "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
    Algorithm: "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
    Example: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
    Remark: "border-slate-400 bg-slate-50 dark:bg-slate-800/40",
  };
  return (
    <div className={`my-4 rounded-r-md border-l-4 px-4 py-2 ${colors[kind]}`}>
      <p className="mb-1 font-semibold">
        {kind} {label}
      </p>
      <div className="[&>p]:my-1.5">{children}</div>
    </div>
  );
}
