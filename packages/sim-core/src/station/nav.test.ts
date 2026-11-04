import { describe, it, expect } from "vitest";
import { TileKind, createTilemap } from "./tilemap";
import { findPath } from "./nav";
import { buildStarterStation, interactionPoint } from "./starter";

function open(w: number, h: number) {
  const m = createTilemap(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m.set(x, y, TileKind.Floor);
  return m;
}

describe("findPath", () => {
  it("finds the shortest path across open floor", () => {
    const p = findPath(open(10, 10), { x: 0, y: 0 }, { x: 4, y: 3 })!;
    expect(p.length).toBe(7);
    expect(p[p.length - 1]).toEqual({ x: 4, y: 3 });
  });
  it("routes through a door but not a wall", () => {
    const m = open(7, 5);
    for (let y = 0; y < 5; y++) m.set(3, y, TileKind.Wall);
    expect(findPath(m, { x: 0, y: 2 }, { x: 6, y: 2 })).toBeNull();
    m.set(3, 2, TileKind.Door);
    expect(findPath(m, { x: 0, y: 2 }, { x: 6, y: 2 })!.length).toBe(6);
  });
  it("returns null for enclosed or blocked targets and out of bounds", () => {
    const m = open(5, 5);
    m.set(2, 2, TileKind.Console);
    expect(findPath(m, { x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull();
    expect(findPath(m, { x: 0, y: 0 }, { x: 9, y: 9 })).toBeNull();
  });
  it("returns empty path when already there", () => {
    expect(findPath(open(3, 3), { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([]);
  });
});

describe("starter station", () => {
  const st = buildStarterStation();
  it("has at least 100 beds in Habitation", () => {
    const hab = st.rooms.find((r) => r.name === "Habitation")!;
    expect(st.furniture.filter((f) => f.kind === TileKind.Bed && f.roomId === hab.id).length).toBeGreaterThanOrEqual(100);
  });
  it("has all required rooms reachable from Docking", () => {
    const dock = st.rooms.find((r) => r.name === "Docking")!;
    const start = { x: dock.x + 1, y: dock.y + 1 };
    for (const name of ["Bridge", "Engineering", "Medbay", "Security", "Cargo", "Galley", "Habitation"]) {
      const r = st.rooms.find((q) => q.name === name)!;
      expect(r, name).toBeTruthy();
      expect(findPath(st.map, start, { x: r.x + 1, y: r.y + 1 }), name).not.toBeNull();
    }
  });
  it("every non-bed furniture has a reachable interaction point", () => {
    const dock = st.rooms.find((r) => r.name === "Docking")!;
    for (const f of st.furniture) {
      const ip = interactionPoint(st.map, f)!;
      expect(ip, `${f.kind}@${f.x},${f.y}`).not.toBeNull();
      expect(findPath(st.map, { x: dock.x + 1, y: dock.y + 1 }, ip)).not.toBeNull();
    }
  });
});
