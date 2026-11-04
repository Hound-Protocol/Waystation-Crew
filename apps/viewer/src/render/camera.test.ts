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
  it("clamps scale to 1.5..64", () => {
    const c = new Camera(10);
    c.zoomAt(0, 0, 1000); expect(c.scale).toBe(64);
    c.zoomAt(0, 0, 1e-9); expect(c.scale).toBe(1.5);
  });
  it("pan moves by screen pixels", () => {
    const c = new Camera(10);
    const w = c.screenToWorld(0, 0);
    c.pan(20, 10);
    expect(c.screenToWorld(0, 0).x).toBeCloseTo(w.x - 2);
  });
});
