import { describe, it, expect } from "vitest";
import { createWorld, step, type World } from "../world";
import { addCharacter } from "../ecs";
import { Department } from "../org/departments";
import { Rank } from "../org/ranks";
import { ActionKind } from "../ai/affordances";
import { stepMovement } from "../ai/move";
import { isWalkable, TileKind } from "../station/tilemap";
import { stepGrid } from "./grid";
import { isDoorClosed, FORCE_TICKS } from "./doors";

/** A door with open floor straight through it, east-west. */
function findDoor(w: World) {
  const m = w.station.map;
  for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) if (m.get(x, y) === TileKind.Door && isWalkable(m.get(x - 1, y)) && isWalkable(m.get(x + 1, y)) && m.get(x - 1, y) !== TileKind.Door && m.get(x + 1, y) !== TileKind.Door) return { x, y };
  throw new Error("no door");
}
const blackout = (w: World) => { const r = w.power.reactor; r.status = "scram"; r.output = 0; r.fieldDraw = 0; r.feed = 0; w.power.battery = 0; stepGrid(w); };
const walker = (w: World, x: number, y: number, to: { x: number; y: number }[]) => {
  const id = addCharacter(w, { name: "W", dept: Department.Supply, rank: Rank.Technician, x, y });
  w.actions[id] = { kind: ActionKind.Wander, furnitureId: -1, path: to, ticksLeft: 0 }; return id;
};

describe("unpowered doors", () => {
  it("with power every door is passable", () => {
    const w = createWorld(7), d = findDoor(w); expect(isDoorClosed(w, d.x, d.y)).toBe(false);
  });
  it("without power a door is closed until forced, and walls and floor are not doors", () => {
    const w = createWorld(7), d = findDoor(w); blackout(w);
    expect(isDoorClosed(w, d.x, d.y)).toBe(true); expect(isDoorClosed(w, d.x - 1, d.y)).toBe(false);
  });
  it("the first character to reach it starts forcing and no second one does; forcing takes 10 ticks, then the door stays open", () => {
    const w = createWorld(7), d = findDoor(w); blackout(w);
    const a = walker(w, d.x - 1, d.y, [{ x: d.x, y: d.y }, { x: d.x + 1, y: d.y }]);
    const b = walker(w, d.x + 1, d.y, [{ x: d.x, y: d.y }, { x: d.x - 1, y: d.y }]);
    const idx = d.y * w.station.map.w + d.x;
    stepMovement(w); w.tick++;
    expect(w.power.forcing.get(idx)!.by).toBe(a);
    expect([w.chars.x[a], w.chars.x[b]]).toEqual([d.x - 1, d.x + 1]);               // neither has moved
    for (let i = 1; i < FORCE_TICKS - 1; i++) { stepMovement(w); w.tick++; expect(w.chars.x[a]).toBe(d.x - 1); }
    for (let i = 0; i < 6; i++) { stepMovement(w); w.tick++; }
    expect(w.power.forced.has(idx)).toBe(true); expect(isDoorClosed(w, d.x, d.y)).toBe(false);
    expect(w.chars.x[a]).toBeGreaterThanOrEqual(d.x);
  });
  it("power returning clears forced doors", () => {
    const w = createWorld(7), d = findDoor(w); blackout(w); w.power.forced.add(d.y * w.station.map.w + d.x);
    const r = w.power.reactor; r.status = "running"; r.feed = 0.6; r.temp = 0.62; stepGrid(w);
    expect(w.power.forced.size).toBe(0); expect(w.power.forcing.size).toBe(0);
  });
  it("the ship's gate is never a closed door", () => {
    const w = createWorld(7), m = w.station.map; blackout(w);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === TileKind.Airlock) expect(isDoorClosed(w, x, y)).toBe(false);
  });
  it("a blackout does not stop the sim, and the door state is deterministic", () => {
    const run = () => { const w = createWorld(7); blackout(w); for (let i = 0; i < 100; i++) step(w); return [w.power.forced.size, w.power.forcing.size]; };
    expect(run()).toEqual(run());
  });
});
