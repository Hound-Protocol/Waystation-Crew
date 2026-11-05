import type { ZoomLevel } from "./lod";

/** The reticle: a circular zone in the middle of the screen. What it covers gets an outline and an overview card. */
export interface Pt { x: number; y: number }
/** Any tile footprint: a station of any shape (modular, grown, with holes), or the ship's deck. Tile coordinates, integer cells. */
export interface Grid { w: number; h: number; solid: (x: number, y: number) => boolean }
export interface Edge { x1: number; y1: number; x2: number; y2: number }
export interface Target { id: string; hit: (c: Pt, r: number) => boolean }

/** Zone radius in screen pixels: the circle's diameter is 20% of the screen height. */
export const zoneRadius = (viewH: number) => 0.1 * viewH;

/** The overview works from the whole-station view inward (zoom levels 1 to 4). */
export const overviewActive = (level: ZoomLevel) => level <= 4;

/** Outline thickness in tiles: about 1 screen pixel at any zoom (scale = pixels per tile), between 0.055 and 0.25 tile. */
export const outlineWidth = (scale: number) => Math.min(0.25, Math.max(0.055, 1.1 / scale));

/** True when the circle (centre c, radius r, in tiles) covers any solid cell. Works for every footprint shape. */
export function footprintHit(g: Grid, c: Pt, r: number): boolean {
  const x0 = Math.max(0, Math.floor(c.x - r)), x1 = Math.min(g.w - 1, Math.floor(c.x + r));
  const y0 = Math.max(0, Math.floor(c.y - r)), y1 = Math.min(g.h - 1, Math.floor(c.y + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!g.solid(x, y)) continue;
    const dx = c.x < x ? x - c.x : c.x > x + 1 ? c.x - (x + 1) : 0, dy = c.y < y ? y - c.y : c.y > y + 1 ? c.y - (y + 1) : 0;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

/** The boundary of a footprint as straight runs on tile edges: every border between a solid and a non-solid cell, with collinear neighbours merged. */
export function footprintEdges(g: Grid): Edge[] {
  const s = (x: number, y: number) => x >= 0 && y >= 0 && x < g.w && y < g.h && g.solid(x, y);
  const out: Edge[] = [];
  for (let y = 0; y <= g.h; y++) {                 // horizontal borders between row y-1 and row y
    let start = -1;
    for (let x = 0; x <= g.w; x++) {
      const on = x < g.w && s(x, y - 1) !== s(x, y);
      if (on && start < 0) start = x;
      if (!on && start >= 0) { out.push({ x1: start, y1: y, x2: x, y2: y }); start = -1; }
    }
  }
  for (let x = 0; x <= g.w; x++) {                 // vertical borders between column x-1 and column x
    let start = -1;
    for (let y = 0; y <= g.h; y++) {
      const on = y < g.h && s(x - 1, y) !== s(x, y);
      if (on && start < 0) start = y;
      if (!on && start >= 0) { out.push({ x1: x, y1: start, x2: x, y2: y }); start = -1; }
    }
  }
  return out;
}

/** A world point in the flying ship's own deck coordinates (the body is centred on `body`, turned clockwise by `rot`; deck is w x h tiles). */
export function shipLocal(p: Pt, body: { x: number; y: number; rot: number }, w: number, h: number): Pt {
  const dx = p.x - body.x, dy = p.y - body.y, cos = Math.cos(body.rot), sin = Math.sin(body.rot);
  return { x: dx * cos + dy * sin + w / 2, y: -dx * sin + dy * cos + h / 2 };
}

/** Round bodies (planets, the sun): the zone overlaps the disc. */
export const circleHit = (centre: Pt, radius: number, c: Pt, r: number) => Math.hypot(c.x - centre.x, c.y - centre.y) <= radius + r;

/** The first target (targets are listed in priority order) the zone covers, or null. */
export function pickTarget<T extends Target>(c: Pt, r: number, targets: T[]): T | null {
  for (const t of targets) if (t.hit(c, r)) return t;
  return null;
}
