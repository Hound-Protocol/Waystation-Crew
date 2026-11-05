import { describe, it, expect } from "vitest";
import { buildStarterStation, TileKind } from "@wc/sim-core";
import { findGates, gateOpenTarget, GateModel } from "./gates";

describe("gateways: runs of airlock cells become one big door", () => {
  const st = buildStarterStation(1);
  const tiles: number[] = []; for (let y = 0; y < st.map.h; y++) for (let x = 0; x < st.map.w; x++) tiles.push(st.map.get(x, y));
  const gates = findGates(tiles, st.map.w, st.map.h);
  it("finds one 2x9 gateway between the ship's ramp and Arrivals, plus a 1x2 boarding gate on each hull", () => {
    const big = gates.filter((g) => Math.max(g.w, g.h) >= 9);
    expect(big.length).toBe(1);
    expect(big[0].h).toBe(9); expect(big[0].w).toBe(2);
    expect(gates.filter((g) => g.w * g.h === 2).length).toBeGreaterThanOrEqual(2);
  });
  it("covers every airlock cell exactly once", () => {
    let cells = 0; for (const t of tiles) if (t === TileKind.Airlock) cells++;
    expect(gates.reduce((n, g) => n + g.w * g.h, 0)).toBe(cells);
  });
  it("opens when someone is within 2 tiles of the gate rectangle, otherwise stays shut", () => {
    const g = { x: 10, y: 10, w: 2, h: 9 };
    expect(gateOpenTarget(g, [{ x: 13, y: 14 }])).toBe(1);
    expect(gateOpenTarget(g, [{ x: 30, y: 14 }])).toBe(0);
    expect(gateOpenTarget(g, [])).toBe(0);
  });
  it("eases open quickly and closes slower", () => {
    const m = new GateModel([{ x: 0, y: 0, w: 1, h: 2 }]);
    m.update(0.2, [{ x: 1, y: 0 }]); const opening = m.open[0];
    expect(opening).toBeGreaterThan(0.5);
    for (let i = 0; i < 60; i++) m.update(0.05, [{ x: 1, y: 0 }]);
    expect(m.open[0]).toBeGreaterThan(0.99);
    m.update(0.2, []); expect(m.open[0]).toBeGreaterThan(0.3);
    for (let i = 0; i < 200; i++) m.update(0.05, []);
    expect(m.open[0]).toBe(0);
  });
});
