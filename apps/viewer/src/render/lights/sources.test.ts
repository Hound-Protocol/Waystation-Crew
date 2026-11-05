import { describe, it, expect } from "vitest";
import { TileKind } from "@wc/sim-core";
import { deriveLights } from "./sources";
import type { BakeInput } from "../tiles";

function station(w: number, h: number, extra: Partial<BakeInput> = {}): BakeInput {
  const tiles = new Array(w * h).fill(TileKind.Floor);
  return { w, h, tiles, rooms: [], ...extra };
}
const room = (id: number, x: number, y: number, w: number, h: number) => ({ id, name: `r${id}`, x, y, w, h });

describe("deriveLights", () => {
  it("wall:light becomes a 5-tile warm point light one tile in front of the wall", () => {
    const ls = deriveLights(station(12, 12, { deco: [{ x: 5, y: 2, sprite: "wall:light", layer: "wall" }] }));
    expect(ls).toHaveLength(1);
    const l = ls[0];
    expect(l.kind).toBe("point");
    expect(l.x).toBe(5.5); expect(l.y).toBe(3.5);
    expect(l.r).toBe(5);
    expect(l.i).toBe(0.9);
    expect(l.c[0]).toBeGreaterThan(l.c[2]);
  });

  it("a console is a cool cyan light, radius converted from px to tiles", () => {
    const ls = deriveLights(station(12, 12, { furniture: [{ id: 1, kind: TileKind.Console, x: 4, y: 4, roomId: 0, style: "console:habitation" }] }));
    expect(ls).toHaveLength(1);
    expect(ls[0].x).toBe(4.5); expect(ls[0].y).toBe(4.5);
    expect(ls[0].r).toBeCloseTo(34 / 16);
    const [r, g, b] = ls[0].c;
    expect(b).toBeGreaterThan(r); expect(g).toBeGreaterThan(r);
  });

  it("rooms get one ceiling light per 36 floor tiles", () => {
    expect(deriveLights(station(20, 20, { rooms: [room(1, 1, 1, 6, 6)] }))).toHaveLength(1);
    expect(deriveLights(station(20, 20, { rooms: [room(1, 1, 1, 6, 12)] }))).toHaveLength(2);
    expect(deriveLights(station(20, 20, { rooms: [room(1, 1, 1, 3, 3)] }))).toHaveLength(1);
  });

  it("ceiling lights lie inside the room and are spread apart", () => {
    const ls = deriveLights(station(20, 20, { rooms: [room(1, 1, 1, 6, 12)] }));
    for (const l of ls) { expect(l.x).toBeGreaterThan(1); expect(l.x).toBeLessThan(7); expect(l.y).toBeGreaterThan(1); expect(l.y).toBeLessThan(13); }
    expect(Math.abs(ls[0].y - ls[1].y)).toBeGreaterThan(4);
  });

  it("adds the sparse corridor grid on floor styles 0 and 8", () => {
    const floors = new Array(400).fill(0);
    const ls = deriveLights(station(20, 20, { floors }));
    expect(ls.map((l) => [l.x, l.y])).toContainEqual([3.5, 3.5]);
    expect(ls).toHaveLength(2 * 2);
    expect(deriveLights(station(20, 20, { floors: new Array(400).fill(3) }))).toHaveLength(0);
  });

  it("is deterministic with unique ids, independent of object identity and input order", () => {
    const mk = () => station(30, 30, {
      floors: new Array(900).fill(0),
      rooms: [room(1, 2, 2, 6, 12), room(2, 12, 2, 6, 6)],
      deco: [{ x: 5, y: 2, sprite: "wall:light", layer: "wall" }, { x: 9, y: 2, sprite: "wall:screen", layer: "wall" }, { x: 6, y: 6, sprite: "prop:reactor", layer: "prop" }],
      furniture: [{ id: 1, kind: TileKind.Console, x: 4, y: 4, roomId: 1, style: "console:habitation" }],
    });
    const a = deriveLights(mk()), b = deriveLights(mk());
    expect(a).toEqual(b);
    expect(new Set(a.map((l) => l.id)).size).toBe(a.length);
    const rev = mk(); rev.deco!.reverse();
    expect(deriveLights(rev)).toEqual(a);
  });
});
