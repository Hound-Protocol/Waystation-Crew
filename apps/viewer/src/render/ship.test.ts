import { describe, it, expect } from "vitest";
import { buildStarterStation, TileKind } from "@wc/sim-core";
import { shipFixtures } from "./ship";

describe("shipFixtures: finds the animated parts in the baked station", () => {
  const st = buildStarterStation(1);
  const fx = shipFixtures(st.deco!, (x, y) => st.map.get(x, y), st.rooms);
  it("finds all 36 seats, half facing each way", () => {
    expect(fx.seats.length).toBe(36);
    expect(fx.seats.filter((s) => s.dir === 1).length).toBe(18);
    const mid = st.rooms.find((r) => r.name === "Cargo Ship")!.y + 17;
    for (const s of fx.seats) expect(s.dir).toBe(s.y < mid ? 1 : -1);               // north-wall seats face south, south-wall seats face north
  });
  it("finds the nose canopy as one continuous 7-tile window, set into the hull wall", () => {
    expect(fx.canopy.length).toBe(1);
    const c = fx.canopy[0];
    expect(Math.max(c.w, c.h)).toBe(7); expect(Math.min(c.w, c.h)).toBe(1);
    for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) expect(st.map.get(x, y)).toBe(TileKind.Wall);
  });
  it("places four big external engines (5x2 tiles) outside the hull, two each side, all in open space with a free exhaust run", () => {
    expect(fx.thrusters.length).toBe(4);
    const ship = st.rooms.find((r) => r.name === "Cargo Ship")!;
    for (const t of fx.thrusters) {
      expect(t.w).toBe(5); expect(t.h).toBe(2);
      for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) expect(st.map.get(x, y), `engine tile ${x},${y}`).toBe(TileKind.Void);
      expect(t.y + t.h <= ship.y || t.y >= ship.y + ship.h).toBe(true);                // wholly beside the hull, none over it
      expect(t.run).toBeGreaterThanOrEqual(1);
    }
    expect(fx.thrusters.filter((t) => t.y < ship.y).length).toBe(2);
    expect(new Set(fx.thrusters.map((t) => `${t.x},${t.y}`)).size).toBe(4);
  });
});
