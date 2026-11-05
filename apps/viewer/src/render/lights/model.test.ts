import { describe, it, expect } from "vitest";
import { LEVELS, AMBIENT, falloff, castLight, quantize, softness } from "./model";
import type { LightSource } from "./types";

const W = 12, H = 12;
const open = () => new Uint8Array(W * H);
const pt = (x: number, y: number, r = 6, i = 1): LightSource => ({ id: 1, kind: "point", x, y, r, i, c: [255, 255, 255] });

describe("constants", () => {
  it("exports levels and ambient", () => {
    expect(LEVELS).toEqual([0.16, 0.28, 0.44, 0.62, 0.82, 1.0]);
    expect(AMBIENT).toBe(0.5);
  });
});

describe("falloff", () => {
  it("is quadratic and zero at/after r", () => {
    expect(falloff(0, 4)).toBe(1);
    expect(falloff(2, 4)).toBeCloseTo(0.25);
    expect(falloff(4, 4)).toBe(0);
    expect(falloff(9, 4)).toBe(0);
  });
});

describe("castLight", () => {
  it("open line equals falloff", () => {
    const l = pt(2.5, 2.5);
    expect(castLight(open(), W, l, 5.5, 2.5)).toBeCloseTo(falloff(3, 6));
  });
  it("wall between gives 0", () => {
    const m = open();
    m[2 * W + 4] = 1;
    expect(castLight(m, W, pt(2.5, 2.5), 6.5, 2.5)).toBe(0);
  });
  it("a solid target cell or own cell does not block", () => {
    const m = open();
    m[2 * W + 2] = 1; m[2 * W + 5] = 1;
    expect(castLight(m, W, pt(2.5, 2.5), 5.5, 2.5)).toBeGreaterThan(0);
  });
  it("diagonal rays are blocked by a diagonal wall tile", () => {
    const m = open();
    m[4 * W + 4] = 1;
    expect(castLight(m, W, pt(2.5, 2.5, 10), 6.5, 6.5)).toBe(0);
  });
  it("closed room: 0 outside, positive through door gap", () => {
    const m = open();
    for (let x = 3; x <= 7; x++) for (let y = 3; y <= 7; y++) if (x === 3 || x === 7 || y === 3 || y === 7) m[y * W + x] = 1;
    const l = pt(5.5, 5.5, 8);
    expect(castLight(m, W, l, 10.5, 5.5)).toBe(0);
    expect(castLight(m, W, l, 5.5, 1.5)).toBe(0);
    m[5 * W + 7] = 0; // door
    expect(castLight(m, W, l, 10.5, 5.5)).toBeGreaterThan(0);
  });
  it("spot is 0 outside its cone, lit inside", () => {
    const l: LightSource = { ...pt(2.5, 5.5, 8), kind: "spot", dir: 0, cone: Math.PI / 3 };
    expect(castLight(open(), W, l, 6.5, 5.5)).toBeGreaterThan(0);
    expect(castLight(open(), W, l, 2.5, 8.5)).toBe(0);
    expect(castLight(open(), W, l, 0.5, 5.5)).toBe(0);
  });
  it("area uses nearest point on rectangle", () => {
    const l: LightSource = { ...pt(5, 5, 6), kind: "area", w: 4, h: 2 };
    expect(castLight(open(), W, l, 8, 5)).toBeCloseTo(falloff(1, 6));
    expect(castLight(open(), W, l, 5, 5)).toBeCloseTo(1);
  });
  it("sun ignores distance but is shadowed", () => {
    const l: LightSource = { ...pt(0, 0, 20, 0.8), kind: "sun", dir: Math.PI };
    expect(castLight(open(), W, l, 6.5, 5.5)).toBeCloseTo(0.8);
    expect(castLight(open(), W, l, 1.5, 5.5)).toBeCloseTo(0.8);
    const m = open();
    m[5 * W + 3] = 1;
    expect(castLight(m, W, l, 6.5, 5.5)).toBe(0);
  });
});

describe("quantize", () => {
  it("soft 0 returns an element of LEVELS", () => {
    for (const v of [0, 0.1, 0.3, 0.5, 0.7, 0.95, 1.4]) expect(LEVELS).toContain(quantize(v, 0));
  });
  it("snaps to the nearest level", () => {
    expect(quantize(0.3, 0)).toBe(0.28);
    expect(quantize(0.9, 0)).toBe(0.82);
  });
  it("soft > 0 on a band edge lands strictly between neighbours", () => {
    const edge = (LEVELS[1] + LEVELS[2]) / 2;
    const q = quantize(edge, 0.5);
    expect(q).toBeGreaterThan(LEVELS[1]);
    expect(q).toBeLessThan(LEVELS[2]);
    expect(quantize(LEVELS[3], 1)).toBe(LEVELS[3]);
  });
});

describe("softness", () => {
  it("clamps and is monotonic", () => {
    expect(softness(2)).toBe(0);
    expect(softness(3)).toBe(0);
    expect(softness(48)).toBe(1);
    expect(softness(100)).toBe(1);
    let prev = -1;
    for (let s = 0; s <= 60; s += 0.5) { const v = softness(s); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
    expect(softness(25)).toBeGreaterThan(0);
    expect(softness(25)).toBeLessThan(1);
  });
});
