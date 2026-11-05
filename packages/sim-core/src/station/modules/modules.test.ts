import { describe, it, expect } from "vitest";
import { MODULE_KINDS, MODULE_W, MODULE_H, presetsOf, pickPreset, stampModule, type ModuleKind } from "./index";
import { createTilemap, TileKind } from "../tilemap";
import { interactionPoint, type Room, type Furniture } from "../starter";
import { findPath } from "../nav";
import { createRng } from "../../rng";

function stamp(kind: ModuleKind, variant: number, flip: boolean) {
  const map = createTilemap(MODULE_W + 4, MODULE_H + 4), rooms: Room[] = [], furniture: Furniture[] = [];
  const room = stampModule({ map, rooms, furniture }, presetsOf(kind)[variant], 2, 2, flip);
  furniture.forEach((f, i) => { f.id = i; });
  return { map, room, furniture };
}

describe("module presets", () => {
  it("has 8 department modules with 5 distinct presets each", () => {
    expect(MODULE_KINDS.length).toBe(8);
    for (const k of MODULE_KINDS) {
      const ps = presetsOf(k);
      expect(ps.length, k).toBe(5);
      expect(new Set(ps.map((p) => p.rows.join("|"))).size, k).toBe(5);
    }
  });
  it("every preset is 13x12 with known glyphs", () => {
    for (const k of MODULE_KINDS) for (const p of presetsOf(k)) {
      expect(p.rows.length, `${k}#${p.variant} rows`).toBe(MODULE_H - 2);
      p.rows.forEach((r, i) => { expect(r.length, `${k}#${p.variant} row ${i}`).toBe(MODULE_W - 2); expect(r, `${k}#${p.variant} row ${i}`).toMatch(/^[.#CBTP]+$/); });
    }
  });
  it("every furniture piece is reachable from the door, flipped or not", () => {
    for (const k of MODULE_KINDS) for (let v = 0; v < 5; v++) for (const flip of [false, true]) {
      const { map, room, furniture } = stamp(k, v, flip);
      const door = { x: room.x + (MODULE_W >> 1), y: flip ? room.y : room.y + MODULE_H - 1 };
      expect(map.get(door.x, door.y)).toBe(TileKind.Door);
      for (const f of furniture) {
        const ip = interactionPoint(map, f);
        expect(ip, `${k}#${v} ${f.kind}@${f.x},${f.y}`).not.toBeNull();
        expect(findPath(map, door, ip!), `${k}#${v}${flip ? " flipped" : ""} ${f.kind}@${f.x},${f.y}`).not.toBeNull();
      }
    }
  });
  it("gives each department module what its work needs", () => {
    const count = (k: ModuleKind, v: number, kind: TileKind) => stamp(k, v, false).furniture.filter((f) => f.kind === kind).length;
    for (let v = 0; v < 5; v++) {
      for (const k of ["command", "security", "engineering", "supply", "galley"] as ModuleKind[]) expect(count(k, v, TileKind.Console), `${k}#${v}`).toBeGreaterThanOrEqual(3);
      expect(count("medical", v, TileKind.Bed), `medical#${v}`).toBeGreaterThanOrEqual(8);
      expect(count("habitation", v, TileKind.Bed), `habitation#${v}`).toBeGreaterThanOrEqual(24);
      expect(count("arrivals", v, TileKind.Console), `arrivals#${v}`).toBeGreaterThanOrEqual(1);
    }
  });
  it("arrivals has airlocks on the far wall", () => {
    const { map, room } = stamp("arrivals", 0, false);
    let n = 0; for (let x = room.x; x < room.x + MODULE_W; x++) if (map.get(x, room.y) === TileKind.Airlock) n++;
    expect(n).toBeGreaterThanOrEqual(6);
  });
  it("randomizer is seeded and prefers unused variants", () => {
    const a = pickPreset("medical", createRng(5)), b = pickPreset("medical", createRng(5));
    expect(a.variant).toBe(b.variant);
    const used = new Set([0, 1, 2, 3]);
    for (let s = 0; s < 20; s++) expect(pickPreset("medical", createRng(s), used).variant).toBe(4);
  });
});
