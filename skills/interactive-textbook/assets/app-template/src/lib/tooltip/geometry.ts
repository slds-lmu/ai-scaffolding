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

function sign(p1: Pt, p2: Pt, p3: Pt): number {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

export function inTriangle(p: Pt, a: Pt, b: Pt, c: Pt): boolean {
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * "Safe corridor" (menu-aim) test: the triangle spanned by the point where
 * the cursor left the source link and the two corners of the tooltip edge
 * that faces it. Diagonal travel from link to tooltip stays inside this
 * triangle and must not dismiss the chain (spec 2.2.3).
 */
export function inCorridor(p: Pt, origin: Pt, tooltip: Rect): boolean {
  // degenerate: origin inside the tooltip — plain containment already covers it
  if (contains(tooltip, origin)) return false;
  const isLeft = origin.x < tooltip.left;
  const isRight = origin.x > tooltip.right;
  const isAbove = origin.y < tooltip.top;
  const isBelow = origin.y > tooltip.bottom;
  // the triangle must span the tooltip's SILHOUETTE as seen from the origin:
  // for diagonal approach that is two extremal corners across the rect, not a
  // single edge (a single edge leaves diagonal dead zones that dismiss the chain)
  let a: Pt, b: Pt;
  if (isLeft && isAbove) {
    a = { x: tooltip.right, y: tooltip.top };
    b = { x: tooltip.left, y: tooltip.bottom };
  } else if (isRight && isAbove) {
    a = { x: tooltip.left, y: tooltip.top };
    b = { x: tooltip.right, y: tooltip.bottom };
  } else if (isLeft && isBelow) {
    a = { x: tooltip.left, y: tooltip.top };
    b = { x: tooltip.right, y: tooltip.bottom };
  } else if (isRight && isBelow) {
    a = { x: tooltip.right, y: tooltip.top };
    b = { x: tooltip.left, y: tooltip.bottom };
  } else if (isLeft || isRight) {
    const x = isLeft ? tooltip.left : tooltip.right;
    a = { x, y: tooltip.top };
    b = { x, y: tooltip.bottom };
  } else {
    const y = isAbove ? tooltip.top : tooltip.bottom;
    a = { x: tooltip.left, y };
    b = { x: tooltip.right, y };
  }
  // small slack behind the origin so a 2px overshoot near the link survives
  const cx = (tooltip.left + tooltip.right) / 2;
  const cy = (tooltip.top + tooltip.bottom) / 2;
  const o: Pt = {
    x: origin.x - Math.sign(cx - origin.x) * 6,
    y: origin.y - Math.sign(cy - origin.y) * 6,
  };
  return inTriangle(p, o, a, b);
}

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
