import { describe, it, expect } from "vitest";
import { buildStarterStation, TileKind } from "@wc/sim-core";
import { findGates, gateStrips, gateBeacons, strobe, beaconLevel } from "./gates";

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
});

describe("gateway lights", () => {
  const stern = { x: 10, y: 20, w: 2, h: 9 }, side = { x: 5, y: 3, w: 2, h: 1 };
  it("puts a strobe strip on the floor right in front of and right behind the door, across its full width", () => {
    expect(gateStrips(stern)).toEqual([{ x: 9, y: 20, w: 1, h: 9 }, { x: 12, y: 20, w: 1, h: 9 }]);
    expect(gateStrips(side)).toEqual([{ x: 5, y: 2, w: 2, h: 1 }, { x: 5, y: 4, w: 2, h: 1 }]);
  });
  it("mounts yellow beacons on the wall at both ends of the door, one per cell across it", () => {
    expect(gateBeacons(stern).map((b) => `${b.x},${b.y},${b.end}`).sort()).toEqual(["10,19,0", "10,29,1", "11,19,0", "11,29,1"]);
    expect(gateBeacons(side).map((b) => `${b.x},${b.y},${b.end}`).sort()).toEqual(["4,3,0", "7,3,1"]);
  });
  it("strobes at 5 Hz, the front and rear strips taking turns", () => {
    expect(strobe(0.05, 0)).toBe(true); expect(strobe(0.15, 0)).toBe(false); expect(strobe(0.25, 0)).toBe(true);
    for (const t of [0.01, 0.12, 0.33, 0.77]) expect(strobe(t, 0)).not.toBe(strobe(t, 1));
  });
  it("flashes the two ends of the beacon bar alternately, always lit somewhere between 0 and 1", () => {
    for (const t of [0, 0.1, 0.33, 0.5, 0.9]) { for (const e of [0, 1] as const) { const v = beaconLevel(t, e); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); } }
    expect(beaconLevel(0.083, 0)).toBeGreaterThan(0.9); expect(beaconLevel(0.083, 1)).toBeLessThan(0.1);
  });
});
