import { describe, it, expect } from "vitest";
import { findPath, ActionKind, WALK_SPEED } from "@wc/sim-core";
import { SimHost } from "../simhost";
import { Tracks } from "./interp";
import { ClockSync } from "./clock";

/** End-to-end: real sim host -> deltas once per second -> tracks -> 60 fps render clock. A walker must move evenly. */
function walkTrace(path: "straight" | "corner") {
  const host = new SimHost({ seed: 1, population: 3, budgetMs: Infinity });
  const w = host.world, id = 0;
  w.chars.x[id] = 59; w.chars.y[id] = 73;
  const goal = path === "straight" ? { x: 71, y: 73 } : { x: 70, y: 62 };
  const route = findPath(w.station.map, { x: 59, y: 73 }, goal)!;
  w.actions[id] = { kind: ActionKind.Wander, furnitureId: -1, path: route.slice(), ticksLeft: 0 };
  const snap = host.snapshot() as any;
  const tracks = new Tracks(); tracks.reset(snap.chars);
  const clock = new ClockSync(0); clock.reset(snap.tick);
  let latest = 0; const pts: Array<{ x: number; y: number; t: number }> = [];
  for (let frame = 0; frame < 60 * 60; frame++) {
    if (frame % 60 === 0) { const d = host.advanceReal(1); if (d) { tracks.apply(d.moves); latest = d.tick; } }
    const t = clock.update(1 / 60, latest, 1, false);
    const p = tracks.positionAt(id, t);
    if (p) pts.push({ x: p.x, y: p.y, t });
  }
  return { pts, route };
}

describe("walking looks even end to end", () => {
  it("moves at a steady speed with no pauses or jumps while walking a straight stretch of the plaza", () => {
    const { pts, route } = walkTrace("straight");
    const end = route[route.length - 1];
    const nominal = WALK_SPEED / 60;
    const steps: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      if (pts[i - 1].t < 0.1) continue;                          // the walk has not begun on the render timeline yet
      if (pts[i].x >= end.x - 0.6) break;                  // stop before the end: the rounded U-turn back (new wander path) legitimately slows
      steps.push(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    expect(steps.length).toBeGreaterThan(7 * 60);
    expect(Math.min(...steps)).toBeGreaterThan(nominal * 0.5);   // never pauses
    expect(Math.max(...steps)).toBeLessThan(nominal * 1.6);      // never jumps
  });
  it("has no jumps around corners either", () => {
    const { pts } = walkTrace("corner");
    const nominal = WALK_SPEED / 60;
    let maxStep = 0;
    for (let i = 1; i < pts.length; i++) maxStep = Math.max(maxStep, Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    expect(maxStep).toBeLessThan(nominal * 1.6);
  });
});
