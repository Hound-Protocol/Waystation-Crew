import { describe, it, expect } from "vitest";
import { buildStarterStation, TileKind } from "@wc/sim-core";
import { shipFixtures } from "./ship";

describe("shipFixtures: finds the animated parts in the baked station", () => {
  const st = buildStarterStation(1);
  const fx = shipFixtures(st.deco!, (x, y) => st.map.get(x, y));
  it("finds all 36 seats, half facing each way", () => {
    expect(fx.seats.length).toBe(36);
    expect(fx.seats.filter((s) => s.dir === 1).length).toBe(18);
    const mid = st.rooms.find((r) => r.name === "Cargo Ship")!.y + 17;
    for (const s of fx.seats) expect(s.dir).toBe(s.y < mid ? 1 : -1);               // north-wall seats face south, south-wall seats face north
  });
  it("finds four thrusters whose nozzle mouths sit on the stern wall and whose exhaust runs into open space", () => {
    expect(fx.thrusters.length).toBe(4);
    for (const t of fx.thrusters) {
      expect(st.map.get(t.x, t.y)).toBe(TileKind.Wall);
      expect({ dx: t.dx, dy: t.dy }).toEqual({ dx: 1, dy: 0 });                       // the ship's stern faces east
      expect(t.run).toBeGreaterThanOrEqual(1);
      expect(new Set(fx.thrusters.map((q) => `${q.x},${q.y}`)).size).toBe(4);   // every thruster has its own mouth
    }
  });
});
