import { describe, it, expect } from "vitest";
import { TileKind } from "@wc/sim-core";
import type { BakeInput } from "../tiles";
import { solidMask } from "./occluders";

const K = TileKind;
// 5x2 strip: one cell per kind under test
function inp(tiles: number[], extra: Partial<BakeInput> = {}): BakeInput {
  return { w: tiles.length, h: 1, tiles, rooms: [], ...extra };
}

describe("solidMask", () => {
  it("blocks wall, closed door, airlock, void", () => {
    expect(Array.from(solidMask(inp([K.Wall, K.Door, K.Airlock, K.Void])))).toEqual([1, 1, 1, 1]);
  });
  it("blocks console, table, bed", () => {
    expect(Array.from(solidMask(inp([K.Console, K.Table, K.Bed])))).toEqual([1, 1, 1]);
  });
  it("passes floor and plant", () => {
    expect(Array.from(solidMask(inp([K.Floor, K.Plant])))).toEqual([0, 0]);
  });
  it("passes an open door only when listed", () => {
    const i = inp([K.Door, K.Door]);
    expect(Array.from(solidMask(i, new Set([1])))).toEqual([1, 0]);
  });
  it("canopy cells pass light even over void or wall", () => {
    const i = inp([K.Void, K.Wall, K.Wall], { deco: [{ x: 0, y: 0, sprite: "wall:canopy", layer: "wall" }, { x: 1, y: 0, sprite: "wall:canopy", layer: "wall" }] });
    expect(Array.from(solidMask(i))).toEqual([0, 0, 1]);
  });
  it("floor decals do not block", () => {
    const i = inp([K.Floor], { deco: [{ x: 0, y: 0, sprite: "floor:stain", layer: "floor" }] });
    expect(solidMask(i)[0]).toBe(0);
  });
  it("big equipment props block, decor props do not", () => {
    const t = [K.Prop, K.Prop, K.Prop, K.Prop];
    const d = ["reactor", "generator", "rack", "beacon"].map((n, x) => ({ x, y: 0, sprite: `prop:${n}`, layer: "prop" as const }));
    expect(Array.from(solidMask(inp(t, { deco: d })))).toEqual([1, 1, 1, 0]);
  });
  it("furniture entries on floor tiles block when solid", () => {
    const i = inp([K.Floor, K.Floor], { furniture: [{ id: 1, kind: K.Console, x: 0, y: 0, roomId: 0 }, { id: 2, kind: K.Plant, x: 1, y: 0, roomId: 0 }] });
    expect(Array.from(solidMask(i))).toEqual([1, 0]);
  });
  it("indexes y*w+x", () => {
    const m = solidMask({ w: 2, h: 2, tiles: [K.Floor, K.Floor, K.Floor, K.Wall], rooms: [] });
    expect(Array.from(m)).toEqual([0, 0, 0, 1]);
  });
});

import { applyDoors } from "./occluders";
describe("applyDoors", () => {
  it("makes door cells as opaque as they are shut and leaves every other cell alone", () => {
    const bytes = new Uint8Array([255, 255, 0, 255]);                 // 4x1: wall, door, floor, door
    applyDoors(bytes, 4, [{ x: 1, y: 0 }, { x: 3, y: 0 }], [0, 1]);
    expect(Array.from(bytes)).toEqual([255, 255, 0, 0]);
    applyDoors(bytes, 4, [{ x: 1, y: 0 }], [0.5]);
    expect(bytes[1]).toBe(128); expect(bytes[0]).toBe(255); expect(bytes[2]).toBe(0);
  });
});
