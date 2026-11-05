import { describe, it, expect } from "vitest";
import { TileKind, createTilemap } from "./tilemap";
import { findPath } from "./nav";
import { HUB } from "./layout";
import { buildStarterStation, interactionPoint } from "./starter";
import { FLOOR_STYLE, type ModuleKind } from "./modules";

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
  const W = st.map.w;
  const dockRoom = st.rooms.find((r) => r.name === "Arrivals")!;
  type R = typeof st.rooms[0];
  /** A floor tile that belongs to the module (its own floor style), not to a corridor passing through its bounding box. */
  const inside = (r: R) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++)
      if (st.map.get(x, y) === TileKind.Floor && st.floors![y * W + x] === FLOOR_STYLE[r.kind as ModuleKind]) return { x, y };
    throw new Error(`no floor in ${r.name}`);
  };
  const start = inside(dockRoom);
  it("has at least 100 beds across the Habitation modules", () => {
    const habs = new Set(st.rooms.filter((r) => r.name === "Habitation").map((r) => r.id));
    expect(st.furniture.filter((f) => f.kind === TileKind.Bed && habs.has(f.roomId)).length).toBeGreaterThanOrEqual(100);
  });
  it("starts with an Arrivals module that has airlocks", () => {
    let n = 0;
    for (let y = dockRoom.y; y < dockRoom.y + dockRoom.h; y++) for (let x = dockRoom.x; x < dockRoom.x + dockRoom.w; x++) if (st.map.get(x, y) === TileKind.Airlock) n++;
    expect(n).toBeGreaterThanOrEqual(6);
  });
  it("slaps modules together: most modules sit within a few tiles of a neighbour", () => {
    const gap = (a: R, b: R) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
    const touching = st.rooms.filter((a) => st.rooms.some((b) => b.id !== a.id && gap(a, b) <= 3));
    expect(touching.length).toBeGreaterThanOrEqual(st.rooms.length - 2);
  });
  it("is compact: every module within 50 tiles of the plaza and links stay short", () => {
    for (const r of st.rooms) expect(Math.hypot(r.x + r.w / 2 - HUB.x, r.y + r.h / 2 - HUB.y), r.name).toBeLessThan(50);
    let corridor = 0;
    for (let i = 0; i < st.map.tiles.length; i++) if (st.map.tiles[i] === TileKind.Floor && st.floors![i] === 0) corridor++;
    expect(corridor).toBeLessThan(900);
  });
  it.each([2, 3, 4, 5])("builds and connects every module for seed %i", (seed) => {
    const s2 = buildStarterStation(seed), plaza = { x: HUB.x - 4, y: HUB.y + 5 };
    for (const r of s2.rooms) {
      const f = s2.furniture.find((g) => g.roomId === r.id && g.kind === TileKind.Console) ?? s2.furniture.find((g) => g.roomId === r.id);
      if (!f) continue;
      expect(findPath(s2.map, plaza, interactionPoint(s2.map, f)!), `${r.name}@${r.x},${r.y}`).not.toBeNull();
    }
  });
  it("is organic: modules sit around a plaza at different distances and the outline is not a rectangle", () => {
    const dists = st.rooms.map((r) => Math.hypot(r.x + r.w / 2 - HUB.x, r.y + r.h / 2 - HUB.y));
    expect(Math.max(...dists) - Math.min(...dists)).toBeGreaterThan(2);
    let voidCount = 0, tiles = 0;
    for (let y = 0; y < st.map.h; y++) for (let x = 0; x < st.map.w; x++) { tiles++; if (st.map.get(x, y) === TileKind.Void) voidCount++; }
    expect(voidCount / tiles).toBeGreaterThan(0.4);
  });
  it("uses every habitation preset once (unique modules)", () => {
    const v = st.rooms.filter((r) => r.name === "Habitation").map((r) => r.variant);
    expect(new Set(v).size).toBe(Math.min(5, v.length));
  });
  it("has all required rooms reachable from Arrivals", () => {
    for (const name of ["Bridge", "Engineering", "Medbay", "Security", "Cargo", "Galley", "Habitation"])
      for (const r of st.rooms.filter((q) => q.name === name)) expect(findPath(st.map, start, inside(r)), `${name}@${r.x},${r.y}`).not.toBeNull();
  });
  it("every furniture has a reachable interaction point", () => {
    for (const f of st.furniture) {
      const ip = interactionPoint(st.map, f)!;
      expect(ip, `${f.kind}@${f.x},${f.y}`).not.toBeNull();
      expect(findPath(st.map, start, ip), `${f.style}@${f.x},${f.y}`).not.toBeNull();
    }
  });
  it("dresses walls with mounts and tags every solid prop in the map", () => {
    expect(st.deco!.filter((d) => d.layer === "wall").length).toBeGreaterThan(40);
    for (const d of st.deco!.filter((q) => q.layer === "prop")) expect(st.map.get(d.x, d.y), d.sprite).toBe(TileKind.Prop);
  });
});
