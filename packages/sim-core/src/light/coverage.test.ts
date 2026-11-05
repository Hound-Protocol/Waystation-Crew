import { describe, it, expect } from "vitest";
import { createTilemap, TileKind, type Tilemap } from "../station/tilemap";
import type { Station } from "../station/starter";
import { LAMP_REACH, isMountSpot, lights, buildCoverage, addLamp, lampsOf, needsLight } from "./coverage";

/** A room 12 wide, 5 tall: floor x 1..12, y 2..6, walls around; walls at y=1 (north) are mount spots. */
function room(): Station {
  const map: Tilemap = createTilemap(16, 10);
  for (let y = 1; y <= 7; y++) for (let x = 0; x <= 13; x++) map.set(x, y, y === 1 || y === 7 || x === 0 || x === 13 ? TileKind.Wall : TileKind.Floor);
  return { map, rooms: [], furniture: [], deco: [] };
}

describe("mount spots", () => {
  const st = room();
  it("are wall tiles with floor to the south, walls east and west, and no floor to the north", () => {
    expect(isMountSpot(st.map, 5, 1)).toBe(true);
    expect(isMountSpot(st.map, 0, 1)).toBe(false);        // corner: no wall to the west
    expect(isMountSpot(st.map, 5, 7)).toBe(false);        // south wall: floor is to its north
    expect(isMountSpot(st.map, 0, 4)).toBe(false);        // side wall
    expect(isMountSpot(st.map, 5, 3)).toBe(false);        // floor
  });
});

describe("what a lamp lights", () => {
  const st = room();
  it("reaches walkable tiles within LAMP_REACH that it can see", () => {
    expect(LAMP_REACH).toBe(5);
    expect(lights(st.map, 5, 1, 5, 2)).toBe(true);
    expect(lights(st.map, 5, 1, 5, 6)).toBe(true);        // 5 tiles straight down
    expect(lights(st.map, 5, 1, 12, 2)).toBe(false);      // 7 tiles away
  });
  it("is blocked by walls", () => {
    const s = room(); s.map.set(5, 4, TileKind.Wall); s.map.set(6, 4, TileKind.Wall); s.map.set(4, 4, TileKind.Wall);
    expect(lights(s.map, 5, 1, 5, 6)).toBe(false);        // behind the wall
    expect(lights(s.map, 5, 1, 5, 3)).toBe(true);
  });
  it("only floor and beds need light", () => {
    expect(needsLight(TileKind.Floor)).toBe(true); expect(needsLight(TileKind.Bed)).toBe(true);
    for (const k of [TileKind.Void, TileKind.Wall, TileKind.Door, TileKind.Airlock, TileKind.Prop]) expect(needsLight(k)).toBe(false);
  });
});

describe("coverage", () => {
  it("counts the lamps that light each tile and updates when one is added", () => {
    const st = room(); st.deco = [{ x: 3, y: 1, sprite: "wall:light", layer: "wall" }, { x: 9, y: 1, sprite: "wall:screen-map", layer: "wall" }];
    expect(lampsOf(st)).toHaveLength(1);
    const cov = buildCoverage(st);
    expect(cov[2 * 16 + 3]).toBe(1);                       // right below the lamp
    expect(cov[2 * 16 + 11]).toBe(0);                      // far side: nothing yet
    addLamp(cov, st, 9, 1); st.deco.push({ x: 9, y: 1, sprite: "wall:light", layer: "wall" });
    expect(cov[2 * 16 + 11]).toBe(1);
    expect(buildCoverage(st)).toEqual(cov);                // the incremental update equals a full rebuild
  });
});
