/** Geometry helpers for the nested-tooltip engine. */

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function inflate(r: Rect, px: number): Rect {
  return { left: r.left - px, top: r.top - px, right: r.right + px, bottom: r.bottom + px };
}

export function contains(r: Rect, p: Pt): boolean {
  return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
}

export function fromDom(r: DOMRect): Rect {
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

/*
 * The "safe corridor" (menu-aim triangle) that used to live here is gone:
 * window liveness is now decided by real mouseenter/mouseleave on the windows
 * themselves plus a grace timer, which needs no geometry and cannot get stuck
 * on a pointer that stops moving inside the corridor. See TooltipEngine.tsx.
 */

/**
 * Choose a position for a tooltip of size (w,h), anchored near the cursor but
 * biased away from the source rect so it never occludes it (spec 1.2.1),
 * clamped to the viewport.
 */
export function placeTooltip(
  cursor: Pt,
  source: Rect,
  w: number,
  h: number,
  vw: number,
  vh: number
): Pt {
  const pad = 10;
  const off = 14;
  // default: below-right of the cursor
  let x = cursor.x + off;
  let y = source.bottom + 8;
  // if the source sits in the right half, open to the left instead
  if ((source.left + source.right) / 2 > vw / 2) x = cursor.x - w - off;
  // if not enough room below, open above the source
  if (y + h + pad > vh) y = source.top - h - 8;
  // clamp
  x = Math.max(pad, Math.min(x, vw - w - pad));
  y = Math.max(pad, Math.min(y, vh - h - pad));
  return { x, y };
}
