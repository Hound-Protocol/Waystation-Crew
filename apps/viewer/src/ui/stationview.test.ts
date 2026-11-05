import { describe, it, expect } from "vitest";
import { stationView, MOOD_KEYS, type StationCtx } from "./stationview";
import { GROWTH_INTERVAL, CYCLE } from "@wc/sim-core";

const base = (o: Partial<StationCtx> = {}): StationCtx => ({
  name: "Waystation Crew", tick: 86400 + 3600 * 5, shipTick: 100, slip: 0, holding: false, aboard: 0, crew: 60,
  deptCounts: [3, 14, 6, 8, 12, 12, 5], activity: { working: 30, eating: 5, sleeping: 10, relaxing: 5 }, footprint: 4200,
  stats: { needs: { hunger: 0.8, energy: 0.6, social: 0.5, hygiene: 0.9, fun: 0.4 }, lamps: 40, lightable: 1000, dark: 100, orders: 2, built: 5, rooms: 22 }, ...o,
});

describe("stationView", () => {
  it("splits the crew into departments whose shares add up to one", () => {
    const v = stationView(base());
    expect(v.depts.map((d) => d.name)).toEqual(["Command", "Engineering", "Medical", "Security", "Supply", "Service", "Flight"]);
    expect(v.depts.reduce((a, d) => a + d.share, 0)).toBeCloseTo(1, 9);
    expect(v.depts[1].count).toBe(14);
  });
  it("lists what the crew are doing and counts everyone else as on the move", () => {
    const v = stationView(base());
    expect(v.activity.map((a) => a.label)).toEqual(["Working", "Eating", "Sleeping", "Relaxing", "Moving"]);
    expect(v.activity[4].count).toBe(60 - 50);
  });
  it("gives mood as the mean of the needs, and each need on its own", () => {
    const v = stationView(base());
    expect(v.mood.items.map((m) => m.key)).toEqual(MOOD_KEYS);
    expect(v.mood.avg).toBeCloseTo((0.8 + 0.6 + 0.5 + 0.9 + 0.4) / 5, 9);
  });
  it("reports lighting as the share of lightable tiles that are lit", () => {
    const v = stationView(base());
    expect(v.lights.litShare).toBeCloseTo(0.9, 9); expect(v.lights.dark).toBe(100); expect(v.lights.orders).toBe(2);
    expect(stationView(base({ stats: { ...base().stats!, lightable: 0, dark: 0 } })).lights.litShare).toBe(1);
  });
  it("shows the ship's phase progress and the time to its next event", () => {
    const docked = stationView(base({ shipTick: 100 })).ship;
    expect(docked.status).toBe("Docked"); expect(docked.nextLabel).toBe("Lift-off in"); expect(docked.progress).toBeGreaterThan(0); expect(docked.progress).toBeLessThan(1);
    const c = (n: number) => n - 180;                              // a ship tick whose cycle position is n
    const flying = stationView(base({ shipTick: c(1740 + 150) })).ship;
    expect(flying.status).toBe("In flight, to the planet"); expect(flying.nextLabel).toBe("Arrives in"); expect(flying.progress).toBeCloseTo(0.5, 2);
    expect(stationView(base({ holding: true })).ship.status).toBe("Docked, waiting for pilots");
  });
  it("counts the day and how far the next growth review is", () => {
    const v = stationView(base({ tick: 86400 * 2 + GROWTH_INTERVAL / 2 }));
    expect(v.facts.day).toBe(3); expect(v.facts.growth).toBeCloseTo(((86400 * 2 + GROWTH_INTERVAL / 2) % GROWTH_INTERVAL) / GROWTH_INTERVAL, 9);
    expect(v.facts.rooms).toBe(22); expect(v.facts.footprint).toBe(4200);
    expect(CYCLE).toBe(3000);
  });
  it("copes with no stats yet", () => {
    const v = stationView(base({ stats: null }));
    expect(v.mood.avg).toBe(0); expect(v.lights.litShare).toBe(1); expect(v.facts.rooms).toBe(0);
  });
});
