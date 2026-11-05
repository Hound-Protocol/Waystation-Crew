import { describe, it, expect } from "vitest";
import { shipPlacement } from "./shipbody";

const A = { x: 100, y: 50, w: 36, h: 23 }, B = { x: 20, y: 300, w: 36, h: 23 };
const centre = (r: typeof A) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

describe("shipPlacement: the flying body's centre and rotation", () => {
  it("rests on the station berth and on the pad berth, unrotated (nose west)", () => {
    expect(shipPlacement({ s: 0, turn: 0, dir: 0 }, A, B)).toEqual({ ...centre(A), rot: 0 });
    expect(shipPlacement({ s: 1, turn: 0, dir: 0 }, A, B)).toEqual({ ...centre(B), rot: 0 });
  });
  it("moves along the straight line between the two berths", () => {
    const p = shipPlacement({ s: 0.25, turn: 0, dir: 1 }, A, B), a = centre(A), b = centre(B);
    expect(p.x).toBeCloseTo(a.x + (b.x - a.x) * 0.25, 9); expect(p.y).toBeCloseTo(a.y + (b.y - a.y) * 0.25, 9);
  });
  it("points the nose along the travel direction when fully turned, out and back", () => {
    const a = centre(A), b = centre(B), len = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    for (const dir of [1, -1] as const) {
      const rot = shipPlacement({ s: 0.5, turn: 1, dir }, A, B).rot, nose = { x: Math.cos(Math.PI + rot), y: Math.sin(Math.PI + rot) };   // the nose points west (angle pi) at rot 0
      expect(nose.x).toBeCloseTo(ux * dir, 9); expect(nose.y).toBeCloseTo(uy * dir, 9);
    }
  });
  it("turns by the short way out (under a quarter turn here) and eases in proportion to `turn`", () => {
    const full = shipPlacement({ s: 0.5, turn: 1, dir: 1 }, A, B).rot, half = shipPlacement({ s: 0.5, turn: 0.5, dir: 1 }, A, B).rot;
    expect(Math.abs(full)).toBeLessThan(Math.PI / 2); expect(half).toBeCloseTo(full / 2, 9);
    for (const dir of [1, -1] as const) for (const turn of [0, 0.3, 1]) expect(Math.abs(shipPlacement({ s: 0.5, turn, dir }, A, B).rot)).toBeLessThanOrEqual(Math.PI);
  });
});
