import { describe, it, expect } from "vitest";
import { MODULE_KINDS, presetsOf, pickPreset, stampModule, type ModuleKind } from "./index";
import { createTilemap, TileKind } from "../tilemap";
import { interactionPoint, type Room, type Furniture, type Deco } from "../starter";
import { findPath } from "../nav";
import { createRng } from "../../rng";

const DIRS = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }];

function stamp(kind: ModuleKind, variant: number, facing = DIRS[0]) {
  const map = createTilemap(60, 60), rooms: Room[] = [], furniture: Furniture[] = [], deco: Deco[] = [];
  const placed = stampModule({ map, rooms, furniture, deco, floors: new Uint8Array(3600) }, presetsOf(kind)[variant], 30, 30, facing);
  furniture.forEach((f, i) => { f.id = i; });
  return { map, placed, furniture, deco };
}
const floorCells = (kind: ModuleKind, v: number) => presetsOf(kind)[v].blueprint.grid.join("").split("").filter((c) => c !== " " && c !== "d").length;

describe("module presets", () => {
  it("has 8 department modules with 5 distinct presets each", () => {
    expect(MODULE_KINDS.length).toBe(8);
    for (const k of MODULE_KINDS) {
      const ps = presetsOf(k);
      expect(ps.length, k).toBe(5);
      expect(new Set(ps.map((p) => p.blueprint.grid.join("|"))).size, k).toBe(5);
    }
  });
  it("shapes are shaped: no preset is a plain rectangle (chamfers, notches or wings)", () => {
    for (const k of MODULE_KINDS) for (let v = 0; v < 5; v++) {
      const g = presetsOf(k)[v].blueprint.grid, area = (g.length - 2) * (g[0].length - 2);
      expect(floorCells(k, v) - g.join("").split("").filter((c) => c === "A").length, `${k}#${v}`).toBeLessThan(area * 0.99);
    }
  });
  it("every module is walled, with its door open to the outside, in all four orientations", () => {
    for (const k of MODULE_KINDS) for (let v = 0; v < 5; v++) for (const facing of DIRS) {
      const { map, placed } = stamp(k, v, facing);
      expect(map.get(placed.door.x, placed.door.y), `${k}#${v} door`).toBe(TileKind.Door);
      expect(placed.out).toEqual(facing);
      const outside = { x: placed.door.x + placed.out.x, y: placed.door.y + placed.out.y };
      expect(map.get(outside.x, outside.y), `${k}#${v} outside the door is open`).toBe(TileKind.Void);
      // no floor tile may touch the void: every edge is closed by wall, door or airlock
      for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) {
        const t = map.get(x, y);
        if (t === TileKind.Void || t === TileKind.Wall || t === TileKind.Door || t === TileKind.Airlock) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) expect(map.get(x + dx, y + dy), `${k}#${v} leak at ${x},${y}`).not.toBe(TileKind.Void);
      }
    }
  });
  it("every furniture piece is reachable from outside the door", () => {
    for (const k of MODULE_KINDS) for (let v = 0; v < 5; v++) for (const facing of DIRS) {
      const { map, placed, furniture } = stamp(k, v, facing);
      const outside = { x: placed.door.x + placed.out.x, y: placed.door.y + placed.out.y };
      map.set(outside.x, outside.y, TileKind.Floor);
      for (const f of furniture) {
        const ip = interactionPoint(map, f);
        expect(ip, `${k}#${v} ${f.kind}@${f.x},${f.y}`).not.toBeNull();
        expect(findPath(map, outside, ip!), `${k}#${v} ${f.style} @${f.x},${f.y}`).not.toBeNull();
      }
    }
  });
  it("gives each department module what its work needs", () => {
    const count = (k: ModuleKind, v: number, kind: TileKind) => stamp(k, v).furniture.filter((f) => f.kind === kind).length;
    for (let v = 0; v < 5; v++) {
      for (const k of ["command", "security", "engineering", "supply", "galley"] as ModuleKind[]) expect(count(k, v, TileKind.Console), `${k}#${v} consoles`).toBeGreaterThanOrEqual(3);
      expect(count("medical", v, TileKind.Bed), `medical#${v} beds`).toBeGreaterThanOrEqual(6);
      expect(count("habitation", v, TileKind.Bed), `habitation#${v} beds`).toBeGreaterThanOrEqual(24);
      expect(count("galley", v, TileKind.Table), `galley#${v} tables`).toBeGreaterThanOrEqual(4);
      expect(count("arrivals", v, TileKind.Console), `arrivals#${v} consoles`).toBeGreaterThanOrEqual(1);
    }
  });
  it("carries department equipment, not just furniture", () => {
    const sprites = (k: ModuleKind) => new Set(presetsOf(k).flatMap((_, v) => stamp(k, v).deco.map((d) => d.sprite)));
    expect([...sprites("medical")]).toEqual(expect.arrayContaining(["prop:scanner"]));
    expect([...sprites("security")]).toEqual(expect.arrayContaining(["prop:bars", "prop:locker"]));
    expect([...sprites("engineering")]).toEqual(expect.arrayContaining(["prop:reactor", "prop:generator"]));
    expect([...sprites("galley")]).toEqual(expect.arrayContaining(["prop:fridge", "prop:counter"]));
    expect([...sprites("supply")]).toEqual(expect.arrayContaining(["prop:crate", "prop:shelf"]));
  });
  it("arrivals has airlocks on the far side", () => {
    for (let v = 0; v < 5; v++) {
      const { map } = stamp("arrivals", v);
      let n = 0; for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) if (map.get(x, y) === TileKind.Airlock) n++;
      expect(n, `arrivals#${v}`).toBeGreaterThanOrEqual(6);
    }
  });
  it("randomizer is seeded and prefers unused variants", () => {
    expect(pickPreset("medical", createRng(5)).variant).toBe(pickPreset("medical", createRng(5)).variant);
    for (let s = 0; s < 20; s++) expect(pickPreset("medical", createRng(s), new Set([0, 1, 2, 3])).variant).toBe(4);
  });
});
