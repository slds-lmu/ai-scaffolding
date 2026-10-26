import { useEffect } from "react";

/**
 * Scrolls to `#fragment` targets (on load, on hashchange, and on clicks on
 * `a[href^="#"]`), ported from fmm-skript `src/App.tsx` (2026-09-28).
 *
 * Why the browser's own anchor jump is not enough here:
 *  - targets can appear only after lazily loaded content has mounted
 *    (`retries` frames of waiting);
 *  - targets inside collapsed deep dives: every `[data-deep]` ancestor gets an
 *    `fmm-open` event (ExpandedReading listens) before scrolling;
 *  - lazy MathJax, `content-visibility: auto` sections and self-sizing widgets
 *    keep shifting the layout for seconds after the jump, so the target is
 *    re-aligned a few times while it settles.
 *
 * Two failure modes this avoids (both shipped once in fmm-skript):
 *  1. `scrollIntoView({block: "center"})` on a `#sec-…` target centres the
 *     whole multi-screen <section>, landing mid-section. Targets taller than
 *     60 % of the viewport are aligned with `block: "start"` instead
 *     (honours `scroll-margin-top`); small targets (equations, boxes) centre.
 *  2. The settle loop re-aligning after the reader has started scrolling,
 *     yanking them back. It stops on the first wheel/touch/key/pointer input.
 *
 * `ready` should flip to true (or change) once the content is mounted, e.g.
 * the loaded chapter module. `resolveId` may map legacy ids to current ones.
 */
export function useFragmentNavigation(
  ready: unknown,
  resolveId: (id: string) => string = (id) => id
) {
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let navigation = 0;
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const revealFragment = async (hash: string, retries = 0) => {
      const thisNavigation = ++navigation;
      const raw = fragmentId(hash);
      if (!raw) return;
      const id = resolveId(raw);

      let target = document.getElementById(id);
      for (let attempt = 0; !target && attempt < retries; attempt += 1) {
        await nextFrame();
        if (cancelled || thisNavigation !== navigation) return;
        target = document.getElementById(id);
      }
      if (!target || cancelled || thisNavigation !== navigation) return;

      const containers: HTMLElement[] = [];
      let container = target.closest<HTMLElement>("[data-deep]");
      while (container) {
        containers.push(container);
        container = container.parentElement?.closest<HTMLElement>("[data-deep]") ?? null;
      }
      for (const deep of containers.reverse()) {
        deep.dispatchEvent(new Event("fmm-open"));
        await nextFrame();
        if (cancelled || thisNavigation !== navigation) return;
      }

      const el = target;
      const tall = () => el.getBoundingClientRect().height > window.innerHeight * 0.6;
      const align = () => el.scrollIntoView({ block: tall() ? "start" : "center" });
      // where align() puts the target: its scroll margin for "start", centred otherwise
      const wantedTop = () =>
        tall()
          ? parseFloat(getComputedStyle(el).scrollMarginTop) || 0
          : (window.innerHeight - el.getBoundingClientRect().height) / 2;
      align();
      highlightFragment(el);

      // Settle loop. With `scroll-behavior: smooth` the first scroll is still
      // animating for a few hundred ms, so ticks during any scroll motion are
      // skipped; an idle target away from its wanted position is re-aligned.
      // The reader's own input ends the loop (failure mode 2).
      let userScrolled = false;
      let lastScroll = performance.now();
      const stop = () => {
        userScrolled = true;
      };
      const onScroll = () => {
        lastScroll = performance.now();
      };
      const userInput = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
      for (const type of userInput) window.addEventListener(type, stop, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
      try {
        for (const delay of [250, 600, 1200, 2000, 3000]) {
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
          if (cancelled || thisNavigation !== navigation || userScrolled) return;
          if (performance.now() - lastScroll < 150) continue;
          // at the end of the page the wanted position may be unreachable;
          // align() is then a no-op, which is harmless
          if (Math.abs(el.getBoundingClientRect().top - wantedTop()) > 2) align();
        }
      } finally {
        for (const type of userInput) window.removeEventListener(type, stop);
        window.removeEventListener("scroll", onScroll);
      }
    };

    const onHashChange = () => void revealFragment(window.location.hash, 5);
    const onFragmentClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const origin = event.target instanceof Element ? event.target : null;
      const href = origin?.closest<HTMLAnchorElement>('a[href^="#"]')?.getAttribute("href");
      if (href) void revealFragment(href, 5);
    };

    window.addEventListener("hashchange", onHashChange);
    document.addEventListener("click", onFragmentClick, true);
    void revealFragment(window.location.hash, 8);

    return () => {
      cancelled = true;
      navigation += 1;
      window.removeEventListener("hashchange", onHashChange);
      document.removeEventListener("click", onFragmentClick, true);
    };
    // resolveId is expected to be stable (module-level function)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
}

const fragmentHighlights = new WeakMap<
  HTMLElement,
  { timer: number; outline: string; outlineOffset: string }
>();

/** Brief amber outline so the reader sees where the jump landed. */
function highlightFragment(target: HTMLElement) {
  const previous = fragmentHighlights.get(target);
  if (previous) window.clearTimeout(previous.timer);
  const original = previous ?? {
    timer: 0,
    outline: target.style.outline,
    outlineOffset: target.style.outlineOffset,
  };
  target.style.outline = "3px solid rgb(245 158 11)";
  target.style.outlineOffset = "4px";
  const timer = window.setTimeout(() => {
    target.style.outline = original.outline;
    target.style.outlineOffset = original.outlineOffset;
    fragmentHighlights.delete(target);
  }, 1500);
  fragmentHighlights.set(target, { ...original, timer });
}

function fragmentId(hash: string): string {
  try {
    return decodeURIComponent(hash.replace(/^#/, ""));
  } catch {
    return hash.replace(/^#/, "");
  }
}
