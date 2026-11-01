// Rectangles in screenshot space (CSS px of the captured viewport, e.g. 1920×1080).
export type Box = { x: number; y: number; w: number; h: number };

export const pad = (b: Box, p: number): Box => ({ x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p });
export function union(...bs: Box[]): Box {
  const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
  return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
}
export const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
export const inside = (b: Box, page: { w: number; h: number }) => b.x >= -1 && b.y >= -1 && b.x + b.w <= page.w + 1 && b.y + b.h <= page.h + 1;

/**
 * The camera window for a target: grown to the frame's aspect ratio, kept on the page, never smaller than
 * `minW` (so a tiny field is not blown up into a blur). `room` leaves the bottom part of the frame free for captions:
 * the target is placed in the top (1 - room) of the window.
 */
export function frameTarget(b: Box, page: { w: number; h: number }, aspect: number, opts: { minW?: number; room?: number } = {}): Box {
  const room = opts.room ?? 0, minW = Math.min(page.w, opts.minW ?? page.w * 0.28);
  const needH = b.h / (1 - room);
  let w = Math.max(b.w, needH * aspect, minW), h = w / aspect;
  if (w > page.w) { w = page.w; h = w / aspect; }
  if (h > page.h) { h = page.h; w = h * aspect; }
  const cx = b.x + b.w / 2, cyTarget = b.y + b.h / 2;
  // put the target's centre in the middle of the usable (top) part of the window
  let x = cx - w / 2, y = cyTarget - (h * (1 - room)) / 2;
  x = Math.max(0, Math.min(page.w - w, x)); y = Math.max(0, Math.min(page.h - h, y));
  return { x, y, w, h };
}
