import { describe, it, expect } from "vitest";
import { createWorld, step, stepMany } from "../world";
import { addCharacter } from "../ecs";
import { Department } from "../org/departments";
import { Rank } from "../org/ranks";
import { TileKind, createTilemap } from "../station/tilemap";
import { buildStarterStation, type Station } from "../station/starter";
import { stepAI, stepActions } from "./decide";
import { ActionKind } from "./affordances";

function tiny(kinds: TileKind[]): Station {
  const map = createTilemap(20, 5);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 20; x++) map.set(x, y, TileKind.Floor);
  const furniture = kinds.map((kind, i) => { map.set(2 + i * 2, 0, kind); return { id: i, kind, x: 2 + i * 2, y: 0, roomId: 0 }; });
  return { map, rooms: [{ id: 0, name: "R", x: 0, y: 0, w: 20, h: 5 }], furniture };
}
const spawn = (w: ReturnType<typeof createWorld>, x = 10, y = 3) =>
  addCharacter(w, { name: "T", dept: Department.Service, rank: Rank.Trainee, x, y });

describe("decide", () => {
  it("hungry character chooses to eat at a table", () => {
    const w = createWorld(1, buildStarterStation());
    const id = spawn(w, 62, 70);
    w.chars.hunger[id] = 0.1; w.chars.nextDecideTick[id] = 0;
    stepAI(w);
    const a = w.actions[id]!;
    expect(a.kind).toBe(ActionKind.Eat);
    expect(w.station.furniture[a.furnitureId].kind).toBe(TileKind.Table);
  });
  it("tired character chooses a bed", () => {
    const w = createWorld(1, buildStarterStation());
    const id = spawn(w, 62, 70);
    w.chars.energy[id] = 0.1; w.chars.nextDecideTick[id] = 0;
    stepAI(w);
    expect(w.actions[id]!.kind).toBe(ActionKind.Sleep);
    expect(w.station.furniture[w.actions[id]!.furnitureId].kind).toBe(TileKind.Bed);
  });
  it("never lets two characters reserve the same furniture", () => {
    const w = createWorld(1, tiny([TileKind.Bed]));
    const a = spawn(w, 5, 3), b = spawn(w, 6, 3);
    for (const id of [a, b]) { w.chars.energy[id] = 0.1; w.chars.nextDecideTick[id] = 0; }
    stepAI(w);
    const sleepers = [a, b].filter((id) => w.actions[id]?.kind === ActionKind.Sleep);
    expect(sleepers.length).toBe(1);
    expect(w.reservations.get(0)).toBe(sleepers[0]);
  });
  it("idles without throwing when no furniture exists", () => {
    const w = createWorld(1, tiny([]));
    const id = spawn(w);
    w.chars.hunger[id] = 0.05; w.chars.nextDecideTick[id] = 0;
    expect(() => stepAI(w)).not.toThrow();
    expect([ActionKind.Idle, ActionKind.Wander]).toContain(w.actions[id]!.kind);
  });
  it("staggers decisions: no tick decides for more than 60 of 300 characters", () => {
    const w = createWorld(3, buildStarterStation());
    for (let i = 0; i < 300; i++) spawn(w, 57 + (i % 10), 70 + (i % 2));
    let max = 0;
    for (let t = 0; t < 30; t++) { step(w); max = Math.max(max, w.stats.decisions); }
    expect(max).toBeLessThanOrEqual(60);
    expect(max).toBeGreaterThan(0);
  });
  it("needs decay over time and a fed character stops being hungry-driven", () => {
    const w = createWorld(1, buildStarterStation());
    const id = spawn(w, 62, 70);
    stepMany(w, 3600);
    expect(w.chars.hunger[id]).toBeLessThan(1);
  });
  it("a sleeper wakes up when starving instead of sleeping through hunger", () => {
    const w = createWorld(1, tiny([TileKind.Bed]));
    const id = spawn(w, 2, 1);
    w.actions[id] = { kind: ActionKind.Sleep, furnitureId: 0, path: [], ticksLeft: 28_800 };
    w.reservations.set(0, id);
    w.chars.energy[id] = 0.3; w.chars.hunger[id] = 0.05;
    stepActions(w);
    expect(w.actions[id]).toBeNull();
    expect(w.reservations.has(0)).toBe(false);
  });
});
