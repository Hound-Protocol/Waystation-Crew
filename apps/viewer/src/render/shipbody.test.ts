import { describe, it, expect } from "vitest";
import { shipPlacement, aboardPlace } from "./shipbody";

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

describe("aboardPlace: crew inside the ship ride the body", () => {
  const berth = { x: 100, y: 50, w: 36, h: 23 };
  it("leaves everyone outside the berth where they are", () => {
    const place = aboardPlace(berth, { x: 7, y: 8, rot: 1 });
    expect(place(99, 60)).toEqual({ x: 99, y: 60 }); expect(place(136, 60)).toEqual({ x: 136, y: 60 });
  });
  it("is the identity while the ship sits unturned at its berth", () => {
    const place = aboardPlace(berth, { x: 118, y: 61.5, rot: 0 });
    for (const [x, y] of [[100, 50], [110, 60], [135, 72]]) { const p = place(x, y); expect(p.x).toBeCloseTo(x, 9); expect(p.y).toBeCloseTo(y, 9); }
  });
  it("moves with the body and turns about its centre", () => {
    const moved = aboardPlace(berth, { x: 218, y: 161.5, rot: 0 })(110, 60);
    expect(moved.x).toBeCloseTo(210, 9); expect(moved.y).toBeCloseTo(160, 9);
    const turned = aboardPlace(berth, { x: 118, y: 61.5, rot: Math.PI / 2 })(118 + 5 - 0.5, 61.5 - 0.5);     // 5 tiles east of the centre, a quarter turn clockwise
    expect(turned.x).toBeCloseTo(118 - 0.5, 9); expect(turned.y).toBeCloseTo(61.5 + 5 - 0.5, 9);
  });
});
