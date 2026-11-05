import { describe, it, expect } from "vitest";
import { ROOM_TYPES, WINGS, MODULE_KINDS, typeOf } from "./kit";
import { stampModule } from "./modules";
import { createTilemap, TileKind } from "./tilemap";
import { interactionPoint, type Room, type Furniture, type Deco } from "./starter";
import { findPath } from "./nav";
import { createRng } from "../rng";

const DIRS = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }];
const SEEDS = [1, 2, 3, 4, 5, 6];

function stamp(id: string, seed: number, facing = DIRS[0]) {
  const t = typeOf(id), map = createTilemap(60, 60), rooms: Room[] = [], furniture: Furniture[] = [], deco: Deco[] = [];
  const placed = stampModule({ map, rooms, furniture, deco, floors: new Uint8Array(3600) }, { kind: t.kind, variant: 0, blueprint: t.make(createRng(seed)) }, 30, 30, facing);
  furniture.forEach((f, i) => { f.id = i; });
  return { map, placed, furniture, deco };
}

describe("room kit", () => {
  it("covers every department with a wing of several room types", () => {
    for (const k of MODULE_KINDS) { expect(WINGS[k].length, k).toBeGreaterThanOrEqual(1); for (const id of WINGS[k]) expect(typeOf(id).kind, id).toBe(k); }
    for (const k of MODULE_KINDS.filter((x) => x !== "arrivals")) expect(new Set(WINGS[k]).size, k).toBeGreaterThanOrEqual(3);
  });
  it("is deterministic per seed and varies between seeds", () => {
    for (const t of ROOM_TYPES) {
      expect(t.make(createRng(7)).grid, t.id).toEqual(t.make(createRng(7)).grid);
      expect(new Set(SEEDS.map((s) => t.make(createRng(s)).grid.join("|"))).size, `${t.id} varies`).toBeGreaterThan(1);
    }
  });
  it("every room is walled, with its door open to the outside, in all four orientations", () => {
    for (const t of ROOM_TYPES) for (const s of SEEDS.slice(0, 3)) for (const facing of DIRS) {
      const { map, placed } = stamp(t.id, s, facing);
      expect(map.get(placed.door.x, placed.door.y), `${t.id} door`).toBe(TileKind.Door);
      expect(placed.out).toEqual(facing);
      for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) {
        const k = map.get(x, y);
        if (k === TileKind.Void || k === TileKind.Wall || k === TileKind.Door || k === TileKind.Airlock) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) expect(map.get(x + dx, y + dy), `${t.id} leak at ${x},${y}`).not.toBe(TileKind.Void);
      }
    }
  });
  it("every furniture piece is reachable from outside the door", () => {
    for (const t of ROOM_TYPES) for (const s of [...SEEDS, 7, 8, 9, 10, 11, 12]) for (const facing of DIRS) {
      const { map, placed, furniture } = stamp(t.id, s, facing);
      const outside = { x: placed.door.x + placed.out.x, y: placed.door.y + placed.out.y };
      map.set(outside.x, outside.y, TileKind.Floor);
      for (const f of furniture) {
        const ip = interactionPoint(map, f);
        expect(ip, `${t.id}/${s} ${f.kind}@${f.x},${f.y}`).not.toBeNull();
        expect(findPath(map, outside, ip!), `${t.id}/${s} ${f.style}`).not.toBeNull();
      }
    }
  });
  it("rooms hold what their work needs", () => {
    const n = (id: string, kind: TileKind) => SEEDS.map((s) => stamp(id, s).furniture.filter((f) => f.kind === kind).length);
    for (const id of ["bridge", "sec_office", "engine", "workshop", "cargo_bay", "office_cmd"]) for (const c of n(id, TileKind.Console)) expect(c, id).toBeGreaterThanOrEqual(1);
    for (const c of n("mess", TileKind.Table)) expect(c).toBeGreaterThanOrEqual(4);
    for (const c of n("ward", TileKind.Bed)) expect(c).toBeGreaterThanOrEqual(6);
    for (const c of n("bunkroom", TileKind.Bed)) expect(c).toBeGreaterThanOrEqual(8);
  });
  it("arrivals hall has airlocks on the far side", () => {
    for (const s of SEEDS) { const { map } = stamp("arrivals_hall", s); let n = 0; for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) if (map.get(x, y) === TileKind.Airlock) n++; expect(n).toBeGreaterThanOrEqual(6); }
  });
});
