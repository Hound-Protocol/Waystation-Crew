import { describe, it, expect } from "vitest";
import { bakeLighting } from "./light";

describe("bakeLighting", () => {
  it("keeps emissive pixels, darkens others, and quantizes to six levels", () => {
    const W = 4, H = 1, d = new Uint8ClampedArray([77, 225, 255, 255, 100, 100, 100, 255, 100, 100, 100, 255, 0, 0, 0, 0]);
    bakeLighting(d, W, H, [], 0.5);
    expect([d[0], d[1], d[2]]).toEqual([77, 225, 255]);
    expect(d[4]).toBe(Math.min(255, 100 * 0.44)); // 0.5 snaps to level 0.44? nearest of 0.44/0.62 is 0.44
    expect(d[4]).toBeLessThan(100);
    expect(d[15]).toBe(0);
  });
  it("a light brightens nearby pixels more than far ones", () => {
    const W = 40, H = 1, d = new Uint8ClampedArray(W * 4);
    for (let i = 0; i < W; i++) d.set([100, 100, 100, 255], i * 4);
    bakeLighting(d, W, H, [{ x: 0, y: 0, r: 30, i: 1, c: [255, 255, 255] }], 0.3);
    expect(d[0]).toBeGreaterThan(d[35 * 4]);
  });
});
