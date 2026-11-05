import { describe, it, expect } from "vitest";
import { createWorld, seedPopulation, step } from "./index";
import { stationStats } from "./stats";
import { lampsOf, needsLight } from "./light/coverage";
import { TileKind } from "./station/tilemap";

describe("stationStats", () => {
  const w = createWorld(7); seedPopulation(w, 40);
  it("reports the mean of each need, between 0 and 1", () => {
    const s = stationStats(w);
    for (const k of ["hunger", "energy", "social", "hygiene", "fun"] as const) { expect(s.needs[k]).toBeGreaterThanOrEqual(0); expect(s.needs[k]).toBeLessThanOrEqual(1); }
    let sum = 0; for (let i = 0; i < w.chars.count; i++) sum += w.chars.hunger[i];
    expect(s.needs.hunger).toBeCloseTo(sum / w.chars.count, 9);
  });
  it("counts lamps, dark tiles, open lamp orders and lamps built", () => {
    const s = stationStats(w), m = w.station.map;
    let dark = 0; for (let i = 0; i < m.tiles.length; i++) if (needsLight(m.tiles[i] as TileKind) && w.light.cover[i] === 0) dark++;
    expect(s.dark).toBe(dark); expect(s.lamps).toBe(lampsOf(w.station).length); expect(s.orders).toBe(w.light.orders.length); expect(s.built).toBe(w.light.built);
    expect(s.rooms).toBe(w.station.rooms.length);
    let lightable = 0; for (let i = 0; i < m.tiles.length; i++) if (needsLight(m.tiles[i] as TileKind)) lightable++;
    expect(s.lightable).toBe(lightable); expect(s.dark).toBeLessThanOrEqual(s.lightable);
  });
  it("has all zeros of needs for an empty crew instead of NaN", () => {
    const e = createWorld(3); const s = stationStats(e);
    for (const v of Object.values(s.needs)) expect(v).toBe(0);
  });
  it("sees dark tiles go down as Engineering builds lamps", () => {
    const x = createWorld(7); seedPopulation(x, 60); const before = stationStats(x);
    for (let t = 0; t < 4800; t++) step(x);
    const after = stationStats(x);
    expect(after.built).toBeGreaterThan(0); expect(after.lamps).toBeGreaterThan(before.lamps); expect(after.dark).toBeLessThanOrEqual(before.dark);
  });
  it("reports the reactor and grid", () => {
    const w = createWorld(7), st = stationStats(w);
    expect(st.power.status).toBe("running"); expect(st.power.battery).toBe(1); expect(st.power.doorsPowered).toBe(true);
    for (const k of ["output", "demand", "fuel", "fuelStore", "temp", "field", "coolant", "feed", "wear", "supplyLevel"] as const) { expect(st.power[k]).toBeGreaterThanOrEqual(0); expect(Number.isFinite(st.power[k])).toBe(true); }
    w.power.reactor.status = "scram"; expect(stationStats(w).power.status).toBe("scram");
  });
});
