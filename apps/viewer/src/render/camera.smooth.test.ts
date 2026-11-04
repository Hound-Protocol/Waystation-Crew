import { describe, it, expect } from "vitest";
import { Camera } from "./camera";

describe("smooth camera", () => {
  it("smooth zoom converges monotonically, never overshoots, and keeps the anchor fixed", () => {
    const c = new Camera(10);
    const w = c.screenToWorld(300, 200);
    c.zoomAtSmooth(300, 200, 3);
    let last = c.scale;
    for (let i = 0; i < 120; i++) {
      c.update(1 / 60);
      expect(c.scale).toBeGreaterThanOrEqual(last - 1e-9); expect(c.scale).toBeLessThanOrEqual(30 + 1e-6);
      last = c.scale;
      const p = c.screenToWorld(300, 200);
      expect(p.x).toBeCloseTo(w.x, 3); expect(p.y).toBeCloseTo(w.y, 3);
    }
    expect(c.scale).toBeCloseTo(30, 1);
  });
  it("fling keeps moving after release and decays to rest", () => {
    const c = new Camera(10);
    c.fling(600, 0);
    const x0 = c.tx; c.update(1 / 60);
    expect(c.tx).toBeGreaterThan(x0);
    for (let i = 0; i < 600; i++) c.update(1 / 60);
    const x1 = c.tx; c.update(1 / 60);
    expect(Math.abs(c.tx - x1)).toBeLessThan(0.01);
  });
  it("follow eases toward the target without overshoot", () => {
    const c = new Camera(10);
    let prev = Infinity;
    for (let i = 0; i < 200; i++) {
      c.followToward(50, 30, 400, 300, 1 / 60);
      const d = Math.hypot(c.screenToWorld(200, 150).x - 50, c.screenToWorld(200, 150).y - 30);
      expect(d).toBeLessThanOrEqual(prev + 1e-9); prev = d;
    }
    expect(prev).toBeLessThan(0.05);
  });
});
