import { describe, it, expect } from "vitest";
import { interpolatePath, Tracks } from "./interp";
import { WALK_SPEED } from "@wc/sim-core";

const P = (x: number, y: number) => ({ x, y });
describe("interpolatePath", () => {
  const path = [P(0, 0), P(1, 0), P(1, 1)]; // path[0] reached at startTick
  it("returns the exact midpoint at a fractional tick", () => {
    const r = interpolatePath(path, 10, 10.5)!;
    expect([r.x, r.y, r.dir]).toEqual([0.5, 0, "right"]);
  });
  it("clamps before the start and after the end", () => {
    expect(interpolatePath(path, 10, 5)).toMatchObject({ x: 0, y: 0 });
    expect(interpolatePath(path, 10, 99)).toMatchObject({ x: 1, y: 1, dir: "down" });
  });
  it("single point returns it; empty returns null", () => {
    expect(interpolatePath([P(3, 4)], 0, 7)).toMatchObject({ x: 3, y: 4 });
    expect(interpolatePath([], 0, 0)).toBeNull();
  });
});

describe("Tracks", () => {
  it("follows moves, holds the end, and prunes passed segments", () => {
    const t = new Tracks();
    t.reset([{ id: 0, x: 0, y: 0 }]);
    t.apply([{ id: 0, startTick: 0, from: P(0, 0), path: [P(1, 0), P(2, 0)] }, { id: 0, startTick: 5, from: P(2, 0), path: [P(2, 1)] }]);
    expect(t.positionAt(0, 1.5 / WALK_SPEED)).toMatchObject({ x: 1.5, y: 0 });
    expect(t.positionAt(0, 3)).toMatchObject({ x: 2, y: 0 });
    expect(t.positionAt(0, 5 + 0.5 / WALK_SPEED)).toMatchObject({ x: 2, y: 0.5 });
    expect(t.positionAt(0, 50)).toMatchObject({ x: 2, y: 1 });
    expect(t.segmentCount(0)).toBe(0);
  });
  it("prune drops segments that ended before the cutoff so a hidden tab cannot grow memory", () => {
    const t = new Tracks();
    t.reset([{ id: 0, x: 0, y: 0 }]);
    for (let i = 0; i < 1000; i++) t.apply([{ id: 0, startTick: i * 2, from: P(0, 0), path: [P(1, 0)] }]);
    expect(t.segmentCount(0)).toBe(1000);
    t.prune(1900);
    expect(t.segmentCount(0)).toBeLessThan(60);
    expect(t.positionAt(0, 1999)).not.toBeNull();
  });
  it("handles unknown ids and zero tracks", () => {
    const t = new Tracks();
    expect(t.positionAt(5, 1)).toBeNull();
  });
});

describe("rounded corners", () => {
  const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }];
  it("keeps straight runs exact and starts/ends exactly on the path", () => {
    expect(interpolatePath(path, 0, 0.25)).toMatchObject({ x: 0.25, y: 0 });
    expect(interpolatePath(path, 0, 0)).toMatchObject({ x: 0, y: 0 });
    expect(interpolatePath(path, 0, 4)).toMatchObject({ x: 2, y: 2 });
    expect(interpolatePath(path, 0, 3.5)).toMatchObject({ x: 2, y: 1.5 });
  });
  it("cuts the corner smoothly instead of a sharp turn", () => {
    const p = interpolatePath(path, 0, 2)!;
    expect(p.x).toBeLessThan(2); expect(p.y).toBeGreaterThan(0);
    expect(Math.hypot(p.x - 2, p.y - 0)).toBeLessThan(0.25);
  });
  it("moves continuously: no jumps and gentle heading changes through the turn", () => {
    let prev = interpolatePath(path, 0, 0)!, prevAng = 0;
    for (let t = 0.01; t <= 4; t += 0.01) {
      const p = interpolatePath(path, 0, t)!;
      const step = Math.hypot(p.x - prev.x, p.y - prev.y);
      expect(step).toBeLessThan(0.0125); expect(step).toBeGreaterThan(0.006);
      const ang = Math.atan2(p.y - prev.y, p.x - prev.x);
      if (t > 0.02) expect(Math.abs(ang - prevAng)).toBeLessThan(0.2);
      prev = p; prevAng = ang;
    }
  });
});

