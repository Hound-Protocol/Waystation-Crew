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

const turns = (from: { x: number; y: number }, p: Array<{ x: number; y: number }>) => {
  let n = 0, prev = from, pd = "";
  for (const q of p) { const d = `${q.x - prev.x},${q.y - prev.y}`; if (pd && d !== pd) n++; pd = d; prev = q; }
  return n;
};
describe("findPath quality", () => {
  it("prefers straight runs: shortest path with a single turn, not a staircase", () => {
    const from = { x: 0, y: 0 }, p = findPath(open(12, 12), from, { x: 6, y: 5 })!;
    expect(p.length).toBe(11);
    expect(turns(from, p)).toBe(1);
  });
  it("walks around furniture-like beds when a floor detour exists", () => {
    const m = open(9, 3);
    for (const x of [2, 3, 4]) m.set(x, 1, TileKind.Bed);
    const p = findPath(m, { x: 0, y: 1 }, { x: 6, y: 1 })!;
    expect(p.some((q) => m.get(q.x, q.y) === TileKind.Bed)).toBe(false);
  });
  it("still crosses beds when that is the only way, and may end on one", () => {
    const m = open(5, 1); m.set(2, 0, TileKind.Bed);
    expect(findPath(m, { x: 0, y: 0 }, { x: 4, y: 0 })!.length).toBe(4);
    expect(findPath(m, { x: 0, y: 0 }, { x: 2, y: 0 })!.length).toBe(2);
  });
  it("routes around tiles the caller marks blocked, but never blocks the goal", () => {
    const m = open(5, 3);
    const blocked = (x: number, y: number) => x === 2 && y === 1;
    const p = findPath(m, { x: 0, y: 1 }, { x: 4, y: 1 }, blocked)!;
    expect(p.some((q) => q.x === 2 && q.y === 1)).toBe(false);
    expect(findPath(m, { x: 0, y: 1 }, { x: 2, y: 1 }, blocked)!.length).toBe(2);
  });
});

describe("starter station", () => {
  const st = buildStarterStation();
  const dockRoom = st.rooms.find((r) => r.name === "Arrivals")!;
  /** A floor tile just inside the module's door. */
  const inside = (r: { x: number; y: number; h: number; w: number; id: number }) => {
    for (const y of [r.y + 1, r.y + r.h - 2]) { const x = r.x + (r.w >> 1); if (st.map.get(x, y) === TileKind.Floor) return { x, y }; }
    throw new Error("no inside tile");
  };
  const start = inside(dockRoom);
  it("has at least 100 beds across the Habitation modules", () => {
    const habs = new Set(st.rooms.filter((r) => r.name === "Habitation").map((r) => r.id));
    expect(st.furniture.filter((f) => f.kind === TileKind.Bed && habs.has(f.roomId)).length).toBeGreaterThanOrEqual(100);
  });
  it("starts with an Arrivals module that has airlocks", () => {
    expect(dockRoom).toBeTruthy();
    expect(st.map.get(dockRoom.x + 7, dockRoom.y)).toBe(TileKind.Airlock);
  });
  it("uses every habitation preset once (unique modules)", () => {
    const v = st.rooms.filter((r) => r.name === "Habitation").map((r) => r.variant);
    expect(new Set(v).size).toBe(v.length);
  });
  it("has all required rooms reachable from Arrivals", () => {
    for (const name of ["Bridge", "Engineering", "Medbay", "Security", "Cargo", "Galley", "Habitation"]) {
      for (const r of st.rooms.filter((q) => q.name === name)) {
        expect(r, name).toBeTruthy();
        expect(findPath(st.map, start, inside(r)), `${name}@${r.x},${r.y}`).not.toBeNull();
      }
    }
  });
  it("every furniture has a reachable interaction point", () => {
    for (const f of st.furniture) {
      const ip = interactionPoint(st.map, f)!;
      expect(ip, `${f.kind}@${f.x},${f.y}`).not.toBeNull();
      expect(findPath(st.map, start, ip), `${f.kind}@${f.x},${f.y}`).not.toBeNull();
    }
  });
});
