/**
 * Paradox-style nested tooltip engine.
 *
 * Implements the interaction spec:
 *  - 300 ms hover delay before a tooltip spawns
 *  - tooltips spawn non-interactive, auto-lock after a delay with a visible
 *    progress affordance; locked state is marked (border + pin)
 *  - "safe corridor" between link and tooltip so diagonal travel survives
 *  - grace timer (~250 ms) before dismissal / pruning
 *  - moving back to an ancestor prunes its descendants only
 *  - Esc closes the entire chain (and only the chain)
 *  - soft depth cap: spawning beyond MAX_DEPTH collapses the oldest
 *    ancestor beyond the chain root
 *  - circular references are disallowed and rendered distinctly
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { getConcept } from "../registry";
import type { ConceptId } from "../types";
import {
  contains,
  fromDom,
  inCorridor,
  inflate,
  placeTooltip,
  type Pt,
  type Rect,
} from "./geometry";

const HOVER_MS = 300;
const LOCK_MS = 900;
const GRACE_MS = 250;
const MAX_DEPTH = 5;

interface ChainEntry {
  key: number;
  conceptId: ConceptId;
  /** rect of the link that spawned this tooltip */
  sourceRect: Rect;
  /** cursor position when the tooltip spawned (corridor origin) */
  origin: Pt;
  locked: boolean;
  /** measured tooltip rect (set after mount) */
  rect: Rect | null;
  pos: Pt;
}

interface ChainApi {
  chain: ChainEntry[];
  /** spawn a tooltip for conceptId from a link at `depth` (-1 = body text) */
  spawn: (conceptId: ConceptId, depth: number, sourceRect: Rect, cursor: Pt) => void;
  /** ids of concepts currently open (for circular-reference detection) */
  openIds: ConceptId[];
  reportRect: (key: number, rect: Rect, pos: Pt) => void;
  reportLocked: (key: number) => void;
  /** keep-alive ping from a link hover inside a tooltip */
  touch: () => void;
}

const ChainCtx = createContext<ChainApi | null>(null);
/** depth of the tooltip a ConceptLink lives in; -1 = main body text */
const DepthCtx = createContext<number>(-1);

let nextKey = 1;
const warnedUnknown = new Set<string>();

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [chain, setChain] = useState<ChainEntry[]>([]);
  const chainRef = useRef(chain);
  chainRef.current = chain;
  const graceTimer = useRef<number | null>(null);
  const graceTarget = useRef<number>(0);

  const clearGrace = () => {
    if (graceTimer.current !== null) {
      window.clearTimeout(graceTimer.current);
      graceTimer.current = null;
    }
  };

  const truncate = useCallback((len: number) => {
    setChain((c) => (c.length > len ? c.slice(0, len) : c));
  }, []);

  const spawn = useCallback(
    (conceptId: ConceptId, depth: number, sourceRect: Rect, cursor: Pt) => {
      clearGrace();
      // key must be minted OUTSIDE the updater: React may replay updaters
      // (StrictMode/concurrent), and impure `nextKey++` inside would skip keys
      const key = nextKey++;
      setChain((c) => {
        // spawning from depth d prunes everything deeper than d
        let base = c.slice(0, depth + 1);
        if (base.some((e) => e.conceptId === conceptId)) return c; // circular: refuse
        // soft depth cap: collapse the oldest ancestor beyond the root.
        // Survivors' source links lived inside the removed tooltip, so their
        // anchors are orphaned — re-anchor them to their own rects so hit
        // tests and corridors never reference phantom regions.
        if (base.length >= MAX_DEPTH && base.length > 1) {
          const [root, , ...rest] = base;
          base = [
            root,
            ...rest.map((e) =>
              e.rect
                ? {
                    ...e,
                    sourceRect: e.rect,
                    origin: {
                      x: (e.rect.left + e.rect.right) / 2,
                      y: (e.rect.top + e.rect.bottom) / 2,
                    },
                  }
                : e
            ),
          ];
        }
        return [
          ...base,
          {
            key,
            conceptId,
            sourceRect,
            origin: cursor,
            locked: false,
            rect: null,
            // render hidden at (0,0) first: rendering at the cursor could
            // squeeze the box against the right viewport edge, and the
            // squeezed width would then poison the placement measurement
            pos: { x: 0, y: 0 },
          },
        ];
      });
    },
    []
  );

  const reportRect = useCallback((key: number, rect: Rect, pos: Pt) => {
    setChain((c) => c.map((e) => (e.key === key ? { ...e, rect, pos } : e)));
  }, []);

  const reportLocked = useCallback((key: number) => {
    setChain((c) => c.map((e) => (e.key === key ? { ...e, locked: true } : e)));
  }, []);

  // global cursor tracking: decide which suffix of the chain survives
  useEffect(() => {
    if (chain.length === 0) return;

    const onMove = (ev: MouseEvent) => {
      const p: Pt = { x: ev.clientX, y: ev.clientY };
      const c = chainRef.current;
      let alive = -1;
      for (let d = c.length - 1; d >= 0; d--) {
        const e = c[d];
        const inTip = e.rect !== null && contains(inflate(e.rect, 6), p);
        const inSrc = contains(inflate(e.sourceRect, 4), p);
        const inCorr = e.rect !== null && inCorridor(p, e.origin, e.rect);
        if (inTip || inSrc || inCorr) {
          alive = d;
          break;
        }
      }
      const targetLen = alive + 1;
      if (targetLen >= c.length) {
        clearGrace();
        return;
      }
      schedulePrune(targetLen);
    };

    // schedule pruning to targetLen after the grace period
    const schedulePrune = (targetLen: number) => {
      if (graceTimer.current === null || graceTarget.current !== targetLen) {
        clearGrace();
        graceTarget.current = targetLen;
        graceTimer.current = window.setTimeout(() => {
          graceTimer.current = null;
          truncate(graceTarget.current);
        }, GRACE_MS);
      }
    };

    // cursor left the window / window lost focus: no more mousemoves will
    // arrive, so the chain would otherwise persist forever
    const onWindowLeave = () => schedulePrune(0);

    // click/tap outside the whole chain dismisses it (also the only
    // dismissal path on touch devices, which have no mousemove stream)
    const onPointerDown = (ev: PointerEvent) => {
      const p: Pt = { x: ev.clientX, y: ev.clientY };
      const hit = chainRef.current.some(
        (e) =>
          (e.rect !== null && contains(inflate(e.rect, 6), p)) ||
          contains(inflate(e.sourceRect, 4), p)
      );
      if (!hit) {
        clearGrace();
        truncate(0);
      }
    };

    const onKey = (ev: KeyboardEvent) => {
      if (chainRef.current.length === 0) return;
      if (ev.key === "Escape") {
        // close the chain and only the chain
        ev.preventDefault();
        ev.stopPropagation();
        clearGrace();
        truncate(0);
        return;
      }
      // scrolling keys: scroll the deepest LOCKED tooltip's body ourselves.
      // Browsers are inconsistent about keyboard-scrolling a focused div, and
      // once its end is reached they chain to the page — which dismisses the
      // chain mid-read. Never hijack keys a focused control actually uses:
      // text-editing surfaces own everything; sliders/checkboxes/buttons own
      // arrows and space but not PageUp/PageDown.
      if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ae !== document.body) {
        if (ae.isContentEditable) return;
        const role = ae.getAttribute("role");
        if (role && /^(slider|spinbutton|listbox|combobox|textbox|menu|menuitem|tree|grid)$/.test(role))
          return;
        const tag = ae.tagName;
        if (tag === "TEXTAREA" || tag === "SELECT" || tag === "SUMMARY") return;
        if (tag === "INPUT") {
          const t = (ae as HTMLInputElement).type;
          if (!/^(range|checkbox|radio|button)$/.test(t)) return; // text-like input
          if (!/^Page(Up|Down)$/.test(ev.key)) return;
        } else if ((tag === "BUTTON" || role === "button") && ev.key === " ") {
          // Space activates buttons AND ConceptLinks (<span role="button">) —
          // never steal it from them; arrows/PgDn on a focused button/link
          // have no native use, so those may scroll the tooltip
          return;
        }
      }
      const deepest = chainRef.current[chainRef.current.length - 1];
      if (!deepest?.locked) return;
      // select the host by its depth attribute — DOM order of portals is not
      // a contract the chain state guarantees
      const host = document.querySelector<HTMLElement>(
        `[data-tt-depth="${chainRef.current.length - 1}"]`
      );
      const body = host?.querySelector<HTMLElement>("[data-tt-body]");
      if (!body || body.scrollHeight <= body.clientHeight) return;
      const pageStep = body.clientHeight * 0.85;
      const lineStep = 48;
      let handled = true;
      switch (ev.key) {
        case "PageDown":
          body.scrollTop += pageStep;
          break;
        case "PageUp":
          body.scrollTop -= pageStep;
          break;
        case "ArrowDown":
          body.scrollTop += lineStep;
          break;
        case "ArrowUp":
          body.scrollTop -= lineStep;
          break;
        case " ":
          body.scrollTop += ev.shiftKey ? -pageStep : pageStep;
          break;
        case "Home":
          body.scrollTop = 0;
          break;
        case "End":
          body.scrollTop = body.scrollHeight;
          break;
        default:
          handled = false;
      }
      if (handled) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    };

    // scroll/resize invalidate every cached viewport rect (source links,
    // tooltip rects, corridor origins) — safest correct behavior: dismiss.
    // EXCEPTION: scrolling a tooltip's own overflowing body must NOT kill
    // the chain (the tooltip itself doesn't move). It only goes stale for
    // DESCENDANT tooltips, whose source links live in the scrolled content —
    // close those, keep the scrolled tooltip and its ancestors.
    const onInvalidate = (ev?: Event) => {
      const t = ev?.target;
      if (t instanceof Element) {
        const host = t.closest<HTMLElement>("[data-tt-depth]");
        if (host) {
          // a pending corridor-prune from before this scroll would otherwise
          // fire against the chain we just decided to keep
          clearGrace();
          const d = Number(host.dataset.ttDepth);
          if (Number.isFinite(d) && chainRef.current.length > d + 1) truncate(d + 1);
          return;
        }
      }
      clearGrace();
      truncate(0);
    };

    window.addEventListener("mousemove", onMove);
    // capture phase so Esc reaches us before other handlers (input priority)
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onInvalidate, { capture: true, passive: true });
    window.addEventListener("resize", onInvalidate);
    document.documentElement.addEventListener("mouseleave", onWindowLeave);
    window.addEventListener("blur", onWindowLeave);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onInvalidate, { capture: true });
      window.removeEventListener("resize", onInvalidate);
      document.documentElement.removeEventListener("mouseleave", onWindowLeave);
      window.removeEventListener("blur", onWindowLeave);
      window.removeEventListener("pointerdown", onPointerDown);
    };
    // deliberate deps: bind listeners once per chain lifecycle (empty↔non-empty);
    // chainRef supplies fresh entries without rebinding — do NOT "fix" to [chain]
  }, [chain.length > 0, truncate]);

  useEffect(() => clearGrace, []);

  const api: ChainApi = {
    chain,
    spawn,
    openIds: chain.map((e) => e.conceptId),
    reportRect,
    reportLocked,
    touch: clearGrace,
  };

  return (
    <ChainCtx.Provider value={api}>
      {children}
      {chain.map((e, d) => (
        <TooltipView key={e.key} entry={e} depth={d} />
      ))}
    </ChainCtx.Provider>
  );
}

function TooltipView({ entry, depth }: { entry: ChainEntry; depth: number }) {
  const api = useContext(ChainCtx)!;
  const ref = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const def = getConcept(entry.conceptId);

  // measure + place after mount; re-measure whenever the content resizes
  // (MathJax typesets async, widgets/images can grow the tooltip late — a
  // stale rect breaks hit-testing, corridors, and dismissal)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(el.offsetWidth, vw - 20);
      const h = el.offsetHeight;
      const pos = placeTooltip(entry.origin, entry.sourceRect, w, h, vw, vh);
      api.reportRect(
        entry.key,
        { left: pos.x, top: pos.y, right: pos.x + w, bottom: pos.y + h },
        pos
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.key]);

  // auto-lock with progress affordance
  useEffect(() => {
    const t = window.setTimeout(() => api.reportLocked(entry.key), LOCK_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.key]);

  // once locked, move keyboard focus into the tooltip body (only if nothing
  // else holds focus) so PgDn/arrows scroll the tooltip's overflowing
  // content instead of the page — a page scroll would dismiss the chain
  useEffect(() => {
    if (!entry.locked) return;
    const ae = document.activeElement;
    if (ae === null || ae === document.body) bodyRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.locked]);

  // wheel over the tooltip: swallow whatever its body cannot consume.
  // overscroll-contain only blocks chaining when the body actually has
  // scrollable overflow — a short tooltip (or one already at its end) would
  // otherwise chain-scroll the page, which dismisses the chain mid-read.
  // Needs a native non-passive listener; wheel inside a nested scrollable
  // widget region is left to the browser.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      const body = bodyRef.current;
      if (!body) return;
      // horizontal intent: leave it to inner overflow-x regions (equations)
      if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;
      const canConsume =
        body.scrollHeight > body.clientHeight &&
        (ev.deltaY > 0
          ? body.scrollTop + body.clientHeight < body.scrollHeight - 1
          : body.scrollTop > 0);
      if (!canConsume) ev.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  if (!def) return null;

  return createPortal(
    <div
      ref={ref}
      className={[
        // constant border WIDTH: switching widths at lock would shift the
        // rendered bounds away from the cached hit-test rect
        "fixed z-50 max-w-md rounded-lg border-2 bg-slate-800 text-slate-100 shadow-xl text-sm leading-relaxed",
        entry.locked
          ? "border-amber-400 pointer-events-auto"
          : "border-slate-500 pointer-events-none",
      ].join(" ")}
      style={{ left: entry.pos.x, top: entry.pos.y, visibility: entry.rect ? "visible" : "hidden" }}
      role="tooltip"
      data-tt-depth={depth}
    >
      {/* lock progress affordance along the top edge */}
      {!entry.locked && (
        <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-lg bg-slate-600">
          <div
            className="h-full bg-amber-400"
            style={{ animation: `ttlock ${LOCK_MS}ms linear forwards` }}
          />
        </div>
      )}
      <div className="flex items-center gap-2 border-b border-slate-600 px-3 py-1.5 font-semibold">
        <span className="grow">{def.title}</span>
        {entry.locked && (
          <span title="pinned — links inside this tooltip are now hoverable" aria-label="pinned">
            📌
          </span>
        )}
      </div>
      <DepthCtx.Provider value={depth}>
        {/* overscroll-contain: reaching the end of the tooltip's scroll must
            not chain-scroll the page (which would dismiss the chain);
            tabIndex -1: focusable so keyboard scrolling targets this box */}
        <div
          ref={bodyRef}
          tabIndex={-1}
          data-tt-body
          className="max-h-[60vh] overflow-y-auto overscroll-contain px-3 py-2 outline-none [&_p]:my-1.5"
        >
          {def.body}
        </div>
      </DepthCtx.Provider>
    </div>,
    document.body
  );
}

/**
 * Inline link to a concept. Hovering ≥300 ms spawns the concept's tooltip.
 * Use in body text, expanded readings, and inside tooltip bodies (nesting).
 */
export function ConceptLink({ id, children }: { id: ConceptId; children: ReactNode }) {
  const api = useContext(ChainCtx);
  const depth = useContext(DepthCtx);
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);
  const lastPos = useRef<Pt>({ x: 0, y: 0 });
  // hover timer fires up to 300ms later — by then a depth-cap collapse may
  // have shifted this link's tooltip down an index; a ref avoids the stale
  // closure spawning at the wrong level
  const depthRef = useRef(depth);
  depthRef.current = depth;

  const def = getConcept(id);
  const circular = api !== null && api.openIds.slice(0, depth + 1).includes(id);

  const cancel = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => cancel, []);

  if (!def) {
    // unknown concept id: render plainly but visibly flagged (warn once,
    // not per render — render-time side effects spam under StrictMode)
    if (!warnedUnknown.has(id)) {
      warnedUnknown.add(id);
      console.warn(`[ConceptLink] unknown concept "${id}"`);
    }
    return <span className="underline decoration-dotted decoration-red-400">{children}</span>;
  }

  if (circular) {
    // circular reference: no spawn, distinct rendering (spec 3.2.2)
    return (
      <span
        className="cursor-not-allowed text-slate-400 underline decoration-dashed"
        title={`"${def.title}" is already open in this tooltip chain`}
      >
        {children} ↺
      </span>
    );
  }

  // immediate spawn for keyboard focus / click / tap (no hover timer)
  const spawnNow = () => {
    const el = ref.current;
    if (!el || !api) return;
    cancel();
    const r = el.getBoundingClientRect();
    api.spawn(id, depthRef.current, fromDom(r), { x: r.left + r.width / 2, y: r.bottom });
  };

  return (
    <span
      ref={ref}
      tabIndex={0}
      role="button"
      className="cursor-help rounded-sm px-0.5 font-medium text-sky-600 underline decoration-sky-400/60 decoration-dotted underline-offset-2 hover:bg-sky-100/60 focus:outline-2 focus:outline-sky-400 dark:text-sky-300 dark:hover:bg-sky-900/40"
      onMouseEnter={(ev) => {
        lastPos.current = { x: ev.clientX, y: ev.clientY };
        // keep-alive ping only for links INSIDE the chain — an unrelated
        // body link must not cancel a pending prune of a dying chain
        if (depthRef.current >= 0) api?.touch();
        cancel();
        timer.current = window.setTimeout(() => {
          const el = ref.current;
          if (!el || !api) return;
          api.spawn(id, depthRef.current, fromDom(el.getBoundingClientRect()), lastPos.current);
        }, HOVER_MS);
      }}
      onMouseMove={(ev) => {
        lastPos.current = { x: ev.clientX, y: ev.clientY };
      }}
      onMouseLeave={cancel}
      onClick={spawnNow}
      onFocus={spawnNow}
      onBlur={cancel}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          spawnNow();
        }
      }}
    >
      {children}
    </span>
  );
}
