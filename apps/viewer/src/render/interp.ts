import type { Move, Point } from "@wc/protocol";

export type Dir = "up" | "down" | "left" | "right";
export interface Pose { x: number; y: number; dir: Dir }

function dirOf(a: Point, b: Point, fallback: Dir): Dir {
  if (b.x > a.x) return "right"; if (b.x < a.x) return "left";
  if (b.y > a.y) return "down"; if (b.y < a.y) return "up";
  return fallback;
}

/** path[0] is reached at startTick, path[i] at startTick+i. Clamped at both ends. */
export function interpolatePath(path: Point[], startTick: number, nowTicks: number): Pose | null {
  if (path.length === 0) return null;
  if (path.length === 1) return { x: path[0].x, y: path[0].y, dir: "down" };
  const t = Math.min(path.length - 1, Math.max(0, nowTicks - startTick));
  const i = Math.min(path.length - 2, Math.floor(t)), f = t - i;
  const a = path[i], b = path[i + 1];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, dir: dirOf(a, b, "down") };
}

interface Seg { start: number; pts: Point[] } // pts[0] at start
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
      tr.segs.push({ start: m.startTick, pts: [m.from, ...m.path] });
    }
  }
  /** Drop segments that ended before `tick`, folding their end point into the base. Bounds memory when rendering is paused (hidden tab). */
  prune(tick: number) {
    for (const tr of this.t.values()) {
      while (tr.segs.length) {
        const s = tr.segs[0], end = s.start + s.pts.length - 1;
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
      const s = tr.segs[0], end = s.start + s.pts.length - 1;
      if (tick <= end) break;
      tr.base = s.pts[s.pts.length - 1];
      if (s.pts.length > 1) tr.dir = dirOf(s.pts[s.pts.length - 2], tr.base, tr.dir);
      tr.segs.shift();
    }
    const s = tr.segs[0];
    if (s && tick >= s.start) {
      const p = interpolatePath(s.pts, s.start, tick)!;
      tr.dir = p.dir;
      return p;
    }
    return { x: tr.base.x, y: tr.base.y, dir: tr.dir };
  }
}
