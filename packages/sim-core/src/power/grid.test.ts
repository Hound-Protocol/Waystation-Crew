import { describe, it, expect } from "vitest";
import { createWorld, step, stepMany, hashWorld } from "../world";
import { seedPopulation } from "../population";
import { demand, stepGrid, GRID } from "./grid";

const fresh = () => createWorld(7);
const scram = (w: ReturnType<typeof fresh>) => { const r = w.power.reactor; r.status = "scram"; r.output = 0; r.fieldDraw = 0; r.feed = 0; };

describe("power grid", () => {
  it("a new station is demand-positive and fully supplied", () => {
    const w = fresh(); stepGrid(w);
    expect(demand(w)).toBeGreaterThan(GRID.base); expect(w.power.supplyLevel).toBe(1); expect(w.power.doorsPowered).toBe(true);
  });
  it("supplyLevel is clamped 0..1", () => {
    const w = fresh(); w.power.reactor.feed = 1; stepGrid(w);
    expect(w.power.supplyLevel).toBeLessThanOrEqual(1); expect(w.power.supplyLevel).toBeGreaterThanOrEqual(0);
  });
  it("no divide by zero when demand is 0", () => {
    const w = fresh(); w.station.furniture.length = 0; w.station.deco = []; (w.power as { cacheRev: number }).cacheRev = -1; const old = GRID.base; (GRID as { base: number }).base = 0;
    try { stepGrid(w); expect(Number.isFinite(w.power.supplyLevel)).toBe(true); } finally { (GRID as { base: number }).base = old; }
  });
  it("a brownout dims supply in proportion", () => {
    const w = fresh(); w.power.reactor.feed = 0.35; w.power.reactor.temp = 0.62; stepGrid(w);
    expect(w.power.supplyLevel).toBeGreaterThan(0); expect(w.power.supplyLevel).toBeLessThan(1);
  });
  it("a scram makes supply zero", () => {
    const w = fresh(); scram(w); stepGrid(w);
    expect(w.power.supply).toBe(0); expect(w.power.supplyLevel).toBe(0);
  });
  it("the battery drains only the life-support and door base load during a scram", () => {
    const w = fresh(); scram(w); const b0 = w.power.battery;
    for (let i = 0; i < 100; i++) stepGrid(w);
    expect(b0 - w.power.battery).toBeCloseTo(100 / GRID.batteryTicks, 6);
    expect(w.power.doorsPowered).toBe(true);
  });
  it("the battery recharges when supply exceeds demand", () => {
    const w = fresh(); w.power.battery = 0.5; stepGrid(w); stepGrid(w);
    expect(w.power.battery).toBeGreaterThan(0.5);
  });
  it("an empty battery during a scram unpowers the doors and flags life support", () => {
    const w = fresh(); scram(w); w.power.battery = 0; stepGrid(w);
    expect(w.power.doorsPowered).toBe(false); expect(w.power.lifeSupportDown).toBe(true);
  });
  it("power returning restores doors and clears the life-support flag", () => {
    const w = fresh(); scram(w); w.power.battery = 0; stepGrid(w);
    const r = w.power.reactor; r.status = "running"; r.feed = 0.6; r.temp = 0.62; stepGrid(w);
    expect(w.power.doorsPowered).toBe(true); expect(w.power.lifeSupportDown).toBe(false);
  });
  it("two worlds with the same seed hash equal after 5000 ticks with power", () => {
    const a = fresh(), b = fresh(); seedPopulation(a, 30); seedPopulation(b, 30); stepMany(a, 5000); stepMany(b, 5000);
    expect(hashWorld(a)).toBe(hashWorld(b));
  });
  it("the hash reflects the power state", () => {
    const a = fresh(), b = fresh(); b.power.battery = 0.3; expect(hashWorld(a)).not.toBe(hashWorld(b));
  });
});

import { stepShip } from "../ship/ops";
import { FUEL_DELIVERY } from "./grid";

describe("fuel delivery", () => {
  // the ship's cycle is shifted by 180 ticks, so tick 2820 is the first tick of a docked segment
  it("a ship arrival adds the fuel delivery to the store", () => {
    const w = fresh(); w.power.fuelStore = 0.2; w.tick = 2820; stepShip(w);
    expect(w.power.fuelStore).toBeCloseTo(0.2 + FUEL_DELIVERY, 9);
  });
  it("the store caps at 1", () => {
    const w = fresh(); w.power.fuelStore = 0.9; w.tick = 2820; stepShip(w);
    expect(w.power.fuelStore).toBe(1);
  });
  it("no arrival means no delivery", () => {
    for (const t of [2819, 2821, 100, 1500]) { const w = fresh(); w.power.fuelStore = 0.2; w.tick = t; stepShip(w); expect(w.power.fuelStore).toBe(0.2); }
  });
  it("a ship held at the door by missing pilots delivers nothing more", () => {
    const w = fresh(); w.power.fuelStore = 0.2; w.tick = 2820; stepShip(w); const after = w.power.fuelStore;
    for (let i = 0; i < 100; i++) { w.tick++; stepShip(w); }
    expect(w.power.fuelStore).toBe(after);
  });
});
