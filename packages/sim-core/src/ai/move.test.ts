import { describe, it, expect } from "vitest";
import { createWorld } from "../world";
import { addCharacter } from "../ecs";
import { Department } from "../org/departments";
import { Rank } from "../org/ranks";
import { TileKind, createTilemap } from "../station/tilemap";
import { findPath } from "../station/nav";
import type { Station } from "../station/starter";
import { ActionKind } from "./affordances";
import { stepMovement } from "./move";

function openStation(): Station {
  const map = createTilemap(9, 5);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 9; x++) map.set(x, y, TileKind.Floor);
  map.set(8, 0, TileKind.Table);
  return { map, rooms: [], furniture: [{ id: 0, kind: TileKind.Table, x: 8, y: 0, roomId: 0 }] };
}
function setup() {
  const w = createWorld(1, openStation());
  const id = addCharacter(w, { name: "M", dept: Department.Service, rank: Rank.Trainee, x: 0, y: 2 });
  const path = findPath(w.station.map, { x: 0, y: 2 }, { x: 6, y: 2 })!;
  w.actions[id] = { kind: ActionKind.Wander, furnitureId: -1, path, ticksLeft: 0 };
  return { w, id };
}

describe("movement", () => {
  it("arrives after path.length ticks, one tile per tick", () => {
    const { w, id } = setup();
    for (let t = 0; t < 6; t++) stepMovement(w);
    expect([w.chars.x[id], w.chars.y[id]]).toEqual([6, 2]);
    expect(w.actions[id]!.path.length).toBe(0);
  });
  it("re-paths around a tile blocked mid-walk", () => {
    const { w, id } = setup();
    stepMovement(w); stepMovement(w);
    w.station.map.set(3, 2, TileKind.Wall);
    for (let t = 0; t < 10; t++) stepMovement(w);
    expect([w.chars.x[id], w.chars.y[id]]).toEqual([6, 2]);
  });
  it("cancels within one tick and frees the reservation when the target is gone", () => {
    const { w, id } = setup();
    w.actions[id]!.furnitureId = 0;
    w.reservations.set(0, id);
    stepMovement(w);
    w.station.map.set(6, 2, TileKind.Wall);
    stepMovement(w);
    expect(w.actions[id]).toBeNull();
    expect(w.reservations.has(0)).toBe(false);
  });
  it("emits move events only when recording", () => {
    const { w } = setup();
    stepMovement(w);
    expect(w.events.length).toBe(0);
    w.recordEvents = true;
    stepMovement(w);
    expect(w.events[0]).toMatchObject({ type: "moved" });
  });
});
