import { describe, it, expect } from "vitest";
import { pickLights } from "./pick";
import type { LightSource } from "./types";

const L = (id: number, x: number, y: number, r = 3): LightSource => ({ id, kind: "point", x, y, r, i: 1, c: [255, 255, 255] });
const view = { x0: 0, y0: 0, x1: 20, y1: 10 };

describe("pickLights", () => {
  it("drops lights whose reach does not touch the view", () => {
    const got = pickLights([L(1, 10, 5), L(2, 40, 5), L(3, 22, 5, 3), L(4, 24, 5, 3)], view, 10).map((l) => l.id);
    expect(got).toContain(1); expect(got).toContain(3); expect(got).not.toContain(2); expect(got).not.toContain(4);
  });
  it("caps the count, keeping those nearest the view centre", () => {
    const all = Array.from({ length: 30 }, (_, i) => L(i, i * 0.6, 5));
    const got = pickLights(all, view, 5);
    expect(got).toHaveLength(5);
    expect(got.map((l) => l.id).sort((a, b) => a - b)).toEqual([15, 16, 17, 18, 19]);
  });
  it("is stable for equal distances (lowest id first) and never mutates its input", () => {
    const a = [L(7, 8, 5), L(3, 12, 5)], copy = a.slice();
    expect(pickLights(a, view, 1)[0].id).toBe(3);
    expect(a).toEqual(copy);
  });
  it("returns nothing for a zero cap", () => { expect(pickLights([L(1, 10, 5)], view, 0)).toEqual([]); });
  it("fades the lights nearest the cap so panning never snaps one on or off", () => {
    const all = Array.from({ length: 30 }, (_, i) => L(i, i * 0.6, 5));
    const got = pickLights(all, view, 5), byDist = got.slice().sort((a, b) => Math.abs(a.x - 10) - Math.abs(b.x - 10));
    expect(byDist[0].i).toBe(1);                                  // the nearest light is untouched
    expect(byDist[byDist.length - 1].i).toBeLessThan(0.6);        // the last one admitted is already dim
    const cut = pickLights(all, view, 5).length, more = pickLights(all, view, 6);
    expect(more.length).toBe(cut + 1);
  });
  it("leaves every light at full strength when they all fit", () => {
    for (const l of pickLights([L(1, 9, 5), L(2, 11, 5)], view, 5)) expect(l.i).toBe(1);
  });
});
