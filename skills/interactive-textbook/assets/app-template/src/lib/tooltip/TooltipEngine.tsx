/**
 * Nested concept windows (Paradox-grand-strategy style).
 *
 * Interaction model (redesigned 2026-08-06 after reader reports of erratic
 * hover behavior — see the note at the bottom of this comment):
 *
 *  HOVER  a link for 120 ms  → a *preview* window opens. It is interactive
 *         from the first frame, so you can move the pointer into it and
 *         follow the links inside it. It closes 250 ms after the pointer
 *         leaves the link and the window (and everything it spawned), on
 *         page scroll, on window blur, or on Esc.
 *  CLICK  a link (or the 📌 button in a preview's title bar) → a *pinned*
 *         window. It stays until you close it, can be dragged around by its
 *         title bar, and ignores scrolling entirely. Tapping is a click, so
 *         touch devices get pinned windows directly.
 *  ESC    closes the newest window; press again to walk down the stack.
 *  Click outside every window closes the previews and leaves the pins alone.
 *
 * Windows form a forest: each entry remembers the `parent` it was spawned
 * from. A preview stays alive while itself or any descendant is hovered.
 * Pinning detaches an entry (`parent = null`): it becomes its own little
 * window, and the preview trail that led to it closes behind it.
 *
 * What the previous version did and why it was replaced: previews spawned
 * non-interactive and auto-"locked" after 900 ms, and liveness was decided by
 * a global mousemove hit test against cached rects plus a menu-aim corridor.
 * Three failure modes fell out of that. (1) On the first frame after spawn
 * the tooltip rect is still unmeasured, so a pointer that had drifted a few
 * pixels off the link pruned the window immediately: it flashed and vanished.
 * (2) A pointer coming to rest inside the corridor produced no further
 * mousemove events, so nothing ever pruned and the window hung around
 * indefinitely. (3) Every cached rect was in viewport coordinates, so any
 * page scroll had to dismiss the whole chain — which killed windows out from
 * under people mid-read. Hover liveness is now driven by real
 * mouseenter/mouseleave on the elements themselves, which is immune to all
 * three, and pinned windows are explicit rather than time-based.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { getConcept } from "../registry";
import type { ConceptId } from "../types";
import { contains, fromDom, inflate, placeTooltip, type Pt, type Rect } from "./geometry";

/** hover dwell before a preview opens */
const HOVER_MS = 120;
/** grace period after the pointer leaves everything, before previews close */
const GRACE_MS = 250;
/** longest preview chain; opening deeper drops the oldest unpinned ancestor */
const MAX_CHAIN = 5;
/** how much of a dragged window must stay inside the viewport */
const KEEP_VISIBLE = 48;

export interface TooltipLabels {
  /** title of the 📌 button in a preview */
  pin: string;
  /** title of the × button in a pinned window */
  close: string;
  /** title of the 📌 marker in a pinned window */
  pinned: string;
}

const DEFAULT_LABELS: TooltipLabels = {
  pin: "pin this window (stays open, drag it by its title bar)",
  close: "close",
  pinned: "pinned — drag by the title bar, close with × or Esc",
};

interface Entry {
  key: number;
  conceptId: ConceptId;
  /** key of the window this was spawned from; null = body text or pinned */
  parent: number | null;
  pinned: boolean;
  /** rect of the link that spawned this window (viewport coords) */
  sourceRect: Rect;
  /** cursor position at spawn time, used for placement */
  origin: Pt;
  /** measured window rect, null until the first layout pass */
  rect: Rect | null;
  pos: Pt;
  /** once the user has dragged it, never re-place it automatically */
  dragged: boolean;
  z: number;
}

interface WindowApi {
  entries: Entry[];
  /** open a window; returns the key it will get (minted synchronously) */
  open: (
    conceptId: ConceptId,
    parent: number | null,
    sourceRect: Rect,
    cursor: Pt,
    pinned: boolean
  ) => number;
  pin: (key: number) => void;
  close: (key: number) => void;
  /** hover bookkeeping: links report for the window they spawned */
  setHover: (key: number, on: boolean) => void;
  reportRect: (key: number, rect: Rect, pos: Pt) => void;
  move: (key: number, pos: Pt) => void;
  raise: (key: number) => void;
  /** concept ids of a window and all its ancestors (circular-ref detection) */
  ancestorIds: (key: number | null) => ConceptId[];
  labels: TooltipLabels;
}

const WinCtx = createContext<WindowApi | null>(null);
/** key of the window a ConceptLink lives in; null = main body text */
const EntryCtx = createContext<number | null>(null);

let nextKey = 1;
let nextZ = 1;
const warnedUnknown = new Set<string>();

/** the entry and all its ancestors, root first */
function chainOf(list: Entry[], key: number | null): Entry[] {
  const byKey = new Map(list.map((e) => [e.key, e]));
  const out: Entry[] = [];
  const seen = new Set<number>();
  let cur = key !== null ? byKey.get(key) : undefined;
  while (cur && !seen.has(cur.key)) {
    seen.add(cur.key);
    out.unshift(cur);
    cur = cur.parent !== null ? byKey.get(cur.parent) : undefined;
  }
  return out;
}

export function TooltipProvider({
  children,
  labels,
}: {
  children: ReactNode;
  labels?: Partial<TooltipLabels>;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  /** keys of windows currently hovered (a link reports for the one it spawned) */
  const hovered = useRef(new Set<number>());
  const graceTimer = useRef<number | null>(null);
  const labelsRef = useRef<TooltipLabels>({ ...DEFAULT_LABELS, ...labels });
  labelsRef.current = { ...DEFAULT_LABELS, ...labels };

  const clearGrace = useCallback(() => {
    if (graceTimer.current !== null) {
      window.clearTimeout(graceTimer.current);
      graceTimer.current = null;
    }
  }, []);

  /** drop every preview that is neither hovered nor an ancestor of a survivor */
  const prune = useCallback(() => {
    setEntries((list) => {
      const byKey = new Map(list.map((e) => [e.key, e]));
      const keep = new Set<number>();
      for (const e of list) {
        if (!e.pinned && !hovered.current.has(e.key)) continue;
        let cur: Entry | undefined = e;
        while (cur && !keep.has(cur.key)) {
          keep.add(cur.key);
          cur = cur.parent !== null ? byKey.get(cur.parent) : undefined;
        }
      }
      return keep.size === list.length ? list : list.filter((e) => keep.has(e.key));
    });
  }, []);

  const schedulePrune = useCallback(() => {
    clearGrace();
    graceTimer.current = window.setTimeout(() => {
      graceTimer.current = null;
      prune();
    }, GRACE_MS);
  }, [clearGrace, prune]);

  const closeUnpinned = useCallback(() => {
    clearGrace();
    hovered.current.clear();
    setEntries((list) => (list.some((e) => !e.pinned) ? list.filter((e) => e.pinned) : list));
  }, [clearGrace]);

  const open = useCallback<WindowApi["open"]>(
    (conceptId, parent, sourceRect, cursor, pinned) => {
      clearGrace();
      // keys are minted OUTSIDE the updater: React may replay updaters
      // (StrictMode/concurrent) and an impure nextKey++ inside would skip keys
      const key = nextKey++;
      const z = nextZ++;
      setEntries((list) => {
        const ancestors = chainOf(list, parent);
        if (parent !== null && ancestors.length === 0) return list; // parent vanished
        if (ancestors.some((e) => e.conceptId === conceptId)) return list; // circular
        // a pinned window is detached, so it never inherits an ancestor trail
        const effectiveParent = pinned ? null : parent;
        // soft chain cap: drop the oldest UNPINNED ancestors
        const dropped = new Set<number>();
        let over = ancestors.length + 1 - MAX_CHAIN;
        for (const a of ancestors) {
          if (over <= 0) break;
          if (a.pinned) continue;
          dropped.add(a.key);
          over--;
        }
        const keepKeys = new Set(ancestors.map((e) => e.key));
        const base = list
          .filter((e) => (e.pinned || keepKeys.has(e.key)) && !dropped.has(e.key))
          .map((e) => (e.parent !== null && dropped.has(e.parent) ? { ...e, parent: null } : e));
        return [
          ...base,
          {
            key,
            conceptId,
            parent: effectiveParent !== null && dropped.has(effectiveParent) ? null : effectiveParent,
            pinned,
            sourceRect,
            origin: cursor,
            rect: null,
            // render hidden at (0,0) first: rendering at the cursor could
            // squeeze the box against the right viewport edge, and the
            // squeezed width would then poison the placement measurement
            pos: { x: 0, y: 0 },
            dragged: false,
            z,
          },
        ];
      });
      return key;
    },
    [clearGrace]
  );

  const pin = useCallback((key: number) => {
    setEntries((list) =>
      list.map((e) => (e.key === key ? { ...e, pinned: true, parent: null, z: nextZ++ } : e))
    );
  }, []);

  const close = useCallback((key: number) => {
    hovered.current.delete(key);
    // children of a closed window lose their anchor: close the subtree
    setEntries((list) => {
      const doomed = new Set([key]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const e of list) {
          if (!doomed.has(e.key) && e.parent !== null && doomed.has(e.parent)) {
            doomed.add(e.key);
            grew = true;
          }
        }
      }
      return list.filter((e) => !doomed.has(e.key));
    });
  }, []);

  const setHover = useCallback(
    (key: number, on: boolean) => {
      if (on) hovered.current.add(key);
      else hovered.current.delete(key);
      // re-arm on ENTER too, not just on leave: prune keeps whatever is
      // hovered plus its ancestors, so entering an ancestor is what cleans up
      // the descendant preview you just walked back out of. schedulePrune
      // clears the pending timer first, so an enter still cancels a dismissal.
      schedulePrune();
    },
    [schedulePrune]
  );

  const reportRect = useCallback((key: number, rect: Rect, pos: Pt) => {
    setEntries((list) => list.map((e) => (e.key === key ? { ...e, rect, pos } : e)));
  }, []);

  const move = useCallback((key: number, pos: Pt) => {
    setEntries((list) =>
      list.map((e) =>
        e.key === key
          ? {
              ...e,
              pos,
              dragged: true,
              rect: e.rect
                ? {
                    left: pos.x,
                    top: pos.y,
                    right: pos.x + (e.rect.right - e.rect.left),
                    bottom: pos.y + (e.rect.bottom - e.rect.top),
                  }
                : e.rect,
            }
          : e
      )
    );
  }, []);

  const raise = useCallback((key: number) => {
    setEntries((list) => {
      if (list.length === 0) return list;
      const top = Math.max(...list.map((e) => e.z));
      if (list.find((e) => e.key === key)?.z === top) return list;
      const z = nextZ++;
      return list.map((e) => (e.key === key ? { ...e, z } : e));
    });
  }, []);

  const ancestorIds = useCallback(
    (key: number | null) => chainOf(entriesRef.current, key).map((e) => e.conceptId),
    []
  );

  // global listeners, bound only while at least one window is open
  useEffect(() => {
    if (entries.length === 0) return;

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || entriesRef.current.length === 0) return;
      // close the newest window; pressing Esc again walks down the stack
      ev.preventDefault();
      ev.stopPropagation();
      const top = entriesRef.current.reduce((a, b) => (b.z > a.z ? b : a));
      close(top.key);
    };

    // click/tap outside every window dismisses the previews. Pinned windows
    // are explicit UI: only × or Esc closes them.
    const onPointerDown = (ev: PointerEvent) => {
      const p: Pt = { x: ev.clientX, y: ev.clientY };
      const inside =
        (ev.target instanceof Element && ev.target.closest("[data-tt-key]") !== null) ||
        entriesRef.current.some((e) => e.rect !== null && contains(inflate(e.rect, 4), p));
      // a ConceptLink handles its own click (it pins), so don't fight it
      const onLink = ev.target instanceof Element && ev.target.closest("[data-concept-link]") !== null;
      if (!inside && !onLink) closeUnpinned();
    };

    // Previews are anchored to a link's viewport position, so a page scroll
    // invalidates them. Pinned windows are position:fixed and stay put — this
    // is the whole point of pinning. Scrolling INSIDE a window scrolls only
    // its own body and must not close anything.
    const onScroll = (ev: Event) => {
      if (ev.target instanceof Element && ev.target.closest("[data-tt-key]")) return;
      if (entriesRef.current.some((e) => !e.pinned)) closeUnpinned();
    };

    const onResize = () => {
      closeUnpinned();
      // keep pinned windows reachable after the viewport shrinks
      setEntries((list) =>
        list.map((e) => {
          if (!e.rect) return e;
          const w = e.rect.right - e.rect.left;
          const h = e.rect.bottom - e.rect.top;
          const x = Math.max(
            KEEP_VISIBLE - w,
            Math.min(e.pos.x, window.innerWidth - KEEP_VISIBLE)
          );
          const y = Math.max(0, Math.min(e.pos.y, window.innerHeight - KEEP_VISIBLE));
          if (x === e.pos.x && y === e.pos.y) return e;
          return { ...e, pos: { x, y }, rect: { left: x, top: y, right: x + w, bottom: y + h } };
        })
      );
    };

    // the pointer left the window entirely: no mouseleave will arrive for a
    // window under it, so drop the hover set and let the grace timer decide
    const onWindowLeave = () => {
      hovered.current.clear();
      schedulePrune();
    };

    // capture phase so Esc reaches us before other handlers
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onResize);
    document.documentElement.addEventListener("mouseleave", onWindowLeave);
    window.addEventListener("blur", onWindowLeave);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onResize);
      document.documentElement.removeEventListener("mouseleave", onWindowLeave);
      window.removeEventListener("blur", onWindowLeave);
    };
    // deliberate deps: bind once per open↔closed transition; entriesRef keeps
    // the handlers fresh without rebinding on every state change
  }, [entries.length > 0, close, closeUnpinned, schedulePrune]);

  useEffect(() => clearGrace, [clearGrace]);

  const api: WindowApi = {
    entries,
    open,
    pin,
    close,
    setHover,
    reportRect,
    move,
    raise,
    ancestorIds,
    labels: labelsRef.current,
  };

  return (
    <WinCtx.Provider value={api}>
      {children}
      {entries.map((e) => (
        <ConceptWindow key={e.key} entry={e} depth={chainOf(entries, e.key).length - 1} />
      ))}
    </WinCtx.Provider>
  );
}

function ConceptWindow({ entry, depth }: { entry: Entry; depth: number }) {
  const api = useContext(WinCtx)!;
  const ref = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const entryRef = useRef(entry);
  entryRef.current = entry;
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const def = getConcept(entry.conceptId);

  // measure + place after mount, and re-measure whenever the content resizes
  // (MathJax typesets asynchronously and widgets can grow the box late; a
  // stale rect would break hit-testing and the drag clamp)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let placed = false;
    const measure = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(el.offsetWidth, vw - 20);
      const h = el.offsetHeight;
      const e = entryRef.current;
      // a window the user has moved (or pinned) keeps its position; only its
      // measured size is refreshed, so dragging and hit tests stay honest
      const pos =
        placed && (e.dragged || e.pinned)
          ? e.pos
          : placeTooltip(e.origin, e.sourceRect, w, h, vw, vh);
      placed = true;
      api.reportRect(e.key, { left: pos.x, top: pos.y, right: pos.x + w, bottom: pos.y + h }, pos);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.key]);

  // a freshly pinned window takes focus so Esc, Tab and PageDown address it
  useEffect(() => {
    if (!entry.pinned) return;
    const ae = document.activeElement;
    if (ae === null || ae === document.body || ae?.closest?.("[data-concept-link]"))
      bodyRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.pinned]);

  const onHeaderPointerDown = (ev: ReactPointerEvent<HTMLDivElement>) => {
    api.raise(entry.key);
    if (!entry.pinned || ev.button !== 0) return;
    if (ev.target instanceof Element && ev.target.closest("button")) return;
    drag.current = { dx: ev.clientX - entry.pos.x, dy: ev.clientY - entry.pos.y };
    ev.currentTarget.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  };

  const onHeaderPointerMove = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const e = entryRef.current;
    if (!d || !e.rect) return;
    const w = e.rect.right - e.rect.left;
    const x = Math.max(
      KEEP_VISIBLE - w,
      Math.min(ev.clientX - d.dx, window.innerWidth - KEEP_VISIBLE)
    );
    const y = Math.max(0, Math.min(ev.clientY - d.dy, window.innerHeight - KEEP_VISIBLE));
    api.move(e.key, { x, y });
  };

  const endDrag = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    ev.currentTarget.releasePointerCapture?.(ev.pointerId);
  };

  if (!def) return null;

  return createPortal(
    <div
      ref={ref}
      className={[
        // constant border WIDTH: switching widths would shift the rendered
        // bounds away from the cached hit-test rect
        "fixed max-w-md rounded-lg border-2 bg-slate-800 text-slate-100 shadow-xl text-sm leading-relaxed",
        entry.pinned ? "border-amber-400 shadow-2xl" : "border-slate-500",
      ].join(" ")}
      style={{
        left: entry.pos.x,
        top: entry.pos.y,
        zIndex: 50 + entry.z,
        // hidden until measured: it must not swallow pointer events at (0,0)
        visibility: entry.rect ? "visible" : "hidden",
        pointerEvents: entry.rect ? undefined : "none",
      }}
      role={entry.pinned ? "dialog" : "tooltip"}
      aria-label={entry.pinned ? def.title : undefined}
      data-tt-key={entry.key}
      data-tt-depth={depth}
      data-tt-pinned={entry.pinned ? "true" : "false"}
      onMouseEnter={() => api.setHover(entry.key, true)}
      onMouseLeave={() => api.setHover(entry.key, false)}
      onPointerDown={() => api.raise(entry.key)}
    >
      <div
        className={[
          "flex items-center gap-2 border-b border-slate-600 px-3 py-1.5 font-semibold",
          entry.pinned ? "cursor-move select-none" : "",
        ].join(" ")}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="grow">{def.title}</span>
        {entry.pinned ? (
          <>
            <span title={api.labels.pinned} aria-hidden>
              📌
            </span>
            <button
              type="button"
              title={api.labels.close}
              aria-label={api.labels.close}
              className="-my-1 rounded px-1.5 py-0.5 text-slate-300 hover:bg-slate-700 hover:text-white focus:outline-2 focus:outline-amber-400"
              onClick={() => api.close(entry.key)}
            >
              ×
            </button>
          </>
        ) : (
          <button
            type="button"
            title={api.labels.pin}
            aria-label={api.labels.pin}
            className="-my-1 rounded px-1 py-0.5 opacity-60 hover:bg-slate-700 hover:opacity-100 focus:outline-2 focus:outline-amber-400"
            onClick={() => api.pin(entry.key)}
          >
            📌
          </button>
        )}
      </div>
      <EntryCtx.Provider value={entry.key}>
        {/* overscroll-contain: reaching the end of the window's own scroll
            must not chain-scroll the page behind it.
            tabIndex -1: focusable, so PageDown/arrows scroll this box */}
        <div
          ref={bodyRef}
          tabIndex={-1}
          data-tt-body
          className="max-h-[60vh] overflow-y-auto overscroll-contain px-3 py-2 outline-none [&_p]:my-1.5"
        >
          {def.body}
        </div>
      </EntryCtx.Provider>
    </div>,
    document.body
  );
}

/**
 * Inline link to a concept. Hovering opens a preview window, clicking opens a
 * pinned one. Use in body text, expanded readings, and inside window bodies
 * (nesting is what the whole thing is for).
 */
export function ConceptLink({ id, children }: { id: ConceptId; children: ReactNode }) {
  const api = useContext(WinCtx);
  const parent = useContext(EntryCtx);
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);
  const lastPos = useRef<Pt>({ x: 0, y: 0 });
  /** key of the window this link most recently opened */
  const mine = useRef<number | null>(null);
  // the hover timer fires up to HOVER_MS later, so read the parent through a
  // ref: a chain trim may have re-parented this link's window meanwhile
  const parentRef = useRef(parent);
  parentRef.current = parent;

  const def = getConcept(id);
  const circular = api !== null && api.ancestorIds(parent).includes(id);

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
    // already open further up this chain: no spawn, distinct rendering
    return (
      <span
        className="cursor-not-allowed text-slate-400 underline decoration-dashed"
        title={`„${def.title}" ist in diesem Fenster bereits geöffnet`}
      >
        {children} ↺
      </span>
    );
  }

  const isOpen = () => mine.current !== null && api!.entries.some((e) => e.key === mine.current);

  const openWindow = (pinned: boolean, cursor: Pt) => {
    const el = ref.current;
    if (!el || !api) return;
    cancel();
    const r = fromDom(el.getBoundingClientRect());
    if (pinned && isOpen()) {
      // hover already produced a preview here: pin that one instead of
      // stacking a second window on top of it
      api.pin(mine.current!);
      return;
    }
    mine.current = api.open(id, parentRef.current, r, cursor, pinned);
    // the pointer is still on the LINK, not on the new window, so register
    // the hover here or the grace timer would close it right back
    if (!pinned) api.setHover(mine.current, true);
  };

  return (
    <span
      ref={ref}
      tabIndex={0}
      role="button"
      data-concept-link={id}
      className="cursor-help rounded-sm px-0.5 font-medium text-sky-600 underline decoration-sky-400/60 decoration-dotted underline-offset-2 hover:bg-sky-100/60 focus:outline-2 focus:outline-sky-400 dark:text-sky-300 dark:hover:bg-sky-900/40"
      onMouseEnter={(ev) => {
        lastPos.current = { x: ev.clientX, y: ev.clientY };
        if (isOpen()) {
          api!.setHover(mine.current!, true);
          return;
        }
        cancel();
        timer.current = window.setTimeout(() => openWindow(false, lastPos.current), HOVER_MS);
      }}
      onMouseMove={(ev) => {
        lastPos.current = { x: ev.clientX, y: ev.clientY };
      }}
      onMouseLeave={() => {
        cancel();
        if (mine.current !== null) api?.setHover(mine.current, false);
      }}
      onClick={(ev) => {
        lastPos.current = { x: ev.clientX, y: ev.clientY };
        openWindow(true, lastPos.current);
      }}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          const r = ref.current?.getBoundingClientRect();
          ev.preventDefault();
          openWindow(true, r ? { x: r.left + r.width / 2, y: r.bottom } : lastPos.current);
        }
      }}
    >
      {children}
    </span>
  );
}
