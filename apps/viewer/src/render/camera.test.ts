import { describe, it, expect } from "vitest";
import { Camera } from "./camera";

describe("Camera", () => {
  it("zoomAt keeps the world point under the cursor fixed", () => {
    const c = new Camera(10);
    const before = c.screenToWorld(300, 200);
    c.zoomAt(300, 200, 2);
    const after = c.screenToWorld(300, 200);
    expect(after.x).toBeCloseTo(before.x); expect(after.y).toBeCloseTo(before.y);
    expect(c.scale).toBeCloseTo(20);
  });
  it("clamps scale to 0.012..64", () => {
    const c = new Camera(10);
    c.zoomAt(0, 0, 1000); expect(c.scale).toBe(64);
    c.zoomAt(0, 0, 1e-9); expect(c.scale).toBe(0.012);
  });
  it("pan moves by screen pixels", () => {
    const c = new Camera(10);
    const w = c.screenToWorld(0, 0);
    c.pan(20, 10);
    expect(c.screenToWorld(0, 0).x).toBeCloseTo(w.x - 2);
  });
});

describe("camera glideTo", () => {
  it("eases the view centre and zoom to the target without overshoot, then stops", async () => {
    const { Camera } = await import("./camera");
    const c = new Camera(10); c.centerOn(0, 0, 1000, 800);
    c.glideTo(-590, 630, 8, 1000, 800);
    let prev = Infinity;
    for (let i = 0; i < 600; i++) {
      c.update(1 / 60);
      const m = c.screenToWorld(500, 400), d = Math.hypot(m.x + 590, m.y - 630);
      expect(d).toBeLessThanOrEqual(prev + 1e-6); prev = d;
      expect(c.scale).toBeLessThanOrEqual(10 + 1e-9); expect(c.scale).toBeGreaterThanOrEqual(8 - 1e-9);
    }
    const m = c.screenToWorld(500, 400);
    expect(m.x).toBeCloseTo(-590, 1); expect(m.y).toBeCloseTo(630, 1); expect(c.scale).toBeCloseTo(8, 3);
  });
  it("is cancelled by a manual pan", async () => {
    const { Camera } = await import("./camera");
    const c = new Camera(10); c.centerOn(0, 0, 1000, 800); c.glideTo(500, 500, 10, 1000, 800); c.pan(5, 5);
    const tx = c.tx; c.update(1 / 60); expect(c.tx).toBe(tx);
  });
});
