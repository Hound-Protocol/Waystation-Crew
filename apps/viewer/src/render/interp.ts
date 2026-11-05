import type { Move, Point } from "@wc/protocol";

export type Dir = "up" | "down" | "left" | "right";
export interface Pose { x: number; y: number; dir: Dir }

function dirOf(a: Point, b: Point, fallback: Dir): Dir {
  if (b.x > a.x) return "right"; if (b.x < a.x) return "left";
  if (b.y > a.y) return "down"; if (b.y < a.y) return "up";
  return fallback;
}

const CORNER = 0.5; // corner cut radius in tiles (0.5: round as possible while neighbouring corners still never overlap)
const sgn = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const domDir = (dx: number, dy: number, fallback: Dir): Dir =>
  Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : dx < 0 ? "left" : fallback) : dy > 0 ? "down" : "up";

/**
 * path[0] is reached at startTick, path[i] at startTick+i. Clamped at both ends.
 * Straight runs move at a constant 1 tile/tick; turns follow a quadratic curve that cuts each corner.
 */
export function interpolatePath(path: Point[], startTick: number, nowTicks: number): Pose | null {
  if (path.length === 0) return null;
  if (path.length === 1) return { x: path[0].x, y: path[0].y, dir: "down" };
  const t = Math.min(path.length - 1, Math.max(0, nowTicks - startTick));
  const v = Math.round(t);
  if (v > 0 && v < path.length - 1 && Math.abs(t - v) < CORNER) {
    const V = path[v], A = path[v - 1], B = path[v + 1];
    const dix = sgn(V.x - A.x), diy = sgn(V.y - A.y), dox = sgn(B.x - V.x), doy = sgn(B.y - V.y);
    if (dix !== dox || diy !== doy) {
      const u = (t - (v - CORNER)) / (2 * CORNER), r = CORNER, q = 1 - u;
      const p0x = V.x - r * dix, p0y = V.y - r * diy, p2x = V.x + r * dox, p2y = V.y + r * doy;
      const x = q * q * p0x + 2 * q * u * V.x + u * u * p2x, y = q * q * p0y + 2 * q * u * V.y + u * u * p2y;
      const tx = 2 * q * (V.x - p0x) + 2 * u * (p2x - V.x), ty = 2 * q * (V.y - p0y) + 2 * u * (p2y - V.y);
      return { x, y, dir: domDir(tx, ty, "down") };
    }
  }
  const i = Math.min(path.length - 2, Math.floor(t)), f = t - i;
  const a = path[i], b = path[i + 1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dir: dirOf(a, b, "down") };
}

import { WALK_SPEED } from "@wc/sim-core";
/** pts[0] is reached at `start`; pts[i] at start + i / WALK_SPEED (characters walk WALK_SPEED tiles per tick). */
interface Seg { start: number; pts: Point[] }
const endTick = (s: Seg) => s.start + (s.pts.length - 1) / WALK_SPEED;
interface Track { base: Point; dir: Dir; segs: Seg[] }

/** Per-character movement tracks fed by snapshots/deltas, sampled every frame. */
export class Tracks {
  private t = new Map<number, Track>();
  reset(chars: Array<{ id: number; x: number; y: number }>) {
    this.t.clear();
    for (const c of chars) this.t.set(c.id, { base: { x: c.x, y: c.y }, dir: "down", segs: [] });
  }
  apply(moves: Move[]) {
    for (const m of moves) {
      let tr = this.t.get(m.id);
      if (!tr) { tr = { base: m.from, dir: "down", segs: [] }; this.t.set(m.id, tr); }
      // A walker that keeps walking arrives as one small Move per delta. Chain those onto the running segment so the
      // whole walk is one constant-speed timeline; separate segments would restart the clock each time (pauses, jumps).
      const last = tr.segs[tr.segs.length - 1];
      const tail = last && last.pts[last.pts.length - 1];
      if (last && tail && tail.x === m.from.x && tail.y === m.from.y && m.startTick - endTick(last) < 1) last.pts.push(...m.path);
      else tr.segs.push({ start: m.startTick, pts: [m.from, ...m.path] });
    }
  }
  /** Drop segments that ended before `tick`, folding their end point into the base. Bounds memory when rendering is paused (hidden tab). */
  prune(tick: number) {
    for (const tr of this.t.values()) {
      while (tr.segs.length) {
        const s = tr.segs[0], end = endTick(s);
        if (end >= tick) break;
        tr.base = s.pts[s.pts.length - 1];
        tr.segs.shift();
      }
    }
  }
  segmentCount(id: number) { return this.t.get(id)?.segs.length ?? 0; }
  positionAt(id: number, tick: number): Pose | null {
    const tr = this.t.get(id);
    if (!tr) return null;
    while (tr.segs.length) {
      const s = tr.segs[0], end = endTick(s);
      if (tick <= end) break;
      tr.base = s.pts[s.pts.length - 1];
      if (s.pts.length > 1) tr.dir = dirOf(s.pts[s.pts.length - 2], tr.base, tr.dir);
      tr.segs.shift();
    }
    const s = tr.segs[0];
    if (s && tick >= s.start) {
      const p = interpolatePath(s.pts, s.start, s.start + (tick - s.start) * WALK_SPEED)!;
      tr.dir = p.dir;
      return p;
    }
    return { x: tr.base.x, y: tr.base.y, dir: tr.dir };
  }
}
