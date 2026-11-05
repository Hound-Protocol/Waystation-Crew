import { describe, it, expect } from "vitest";
import { buildStarterStation, TileKind } from "@wc/sim-core";
import { findGates, gateStrips, gateBeacons, strobe, beaconLevel } from "./gates";

describe("gateways: runs of airlock cells become one big door", () => {
  const st = buildStarterStation(1);
  const flat = (m: { w: number; h: number; get(x: number, y: number): TileKind }) => { const t: number[] = []; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) t.push(m.get(x, y)); return t; };
  const stationTiles = flat(st.map), shipTiles = flat(st.ship!.map), b = st.ship!.berth;
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) stationTiles[y * st.map.w + x] = 0;      // the viewer bakes the station with the ship's berth empty
  it("finds one 1x9 gateway on the station: the Arrivals airlocks facing the berth", () => {
    const gates = findGates(stationTiles, st.map.w, st.map.h);
    expect(gates.length).toBe(1);
    expect(gates[0]).toMatchObject({ w: 1, h: 9 });
  });
  it("finds a 1x9 stern gateway on the ship, plus 1x2 boarding gates on its hull", () => {
    const gates = findGates(shipTiles, st.ship!.map.w, st.ship!.map.h);
    const big = gates.filter((g) => Math.max(g.w, g.h) >= 9);
    expect(big.length).toBe(1); expect(big[0]).toMatchObject({ x: 35, w: 1, h: 9 });
    expect(gates.filter((g) => g.w * g.h === 2).length).toBeGreaterThanOrEqual(2);
  });
  it("covers every airlock cell exactly once", () => {
    for (const [tiles, m] of [[stationTiles, st.map], [shipTiles, st.ship!.map]] as const) {
      let cells = 0; for (const t of tiles) if (t === TileKind.Airlock) cells++;
      expect(findGates(tiles, m.w, m.h).reduce((n, g) => n + g.w * g.h, 0)).toBe(cells);
    }
  });
});

describe("gateway lights", () => {
  const stern = { x: 10, y: 20, w: 2, h: 9, inner: 0 as const }, side = { x: 5, y: 3, w: 2, h: 1, inner: 1 as const };
  it("puts one strobe strip on the interior side of the door only, across its full width", () => {
    expect(gateStrips(stern)).toEqual([{ x: 9, y: 20, w: 1, h: 9 }]);
    expect(gateStrips(side)).toEqual([{ x: 5, y: 4, w: 2, h: 1 }]);
  });
  it("knows which side of a gateway is the inside: the side with floor, not open space", () => {
    const W = 6, H = 5, t = new Array(W * H).fill(0);
    for (let y = 0; y < H; y++) { t[y * W + 2] = TileKind.Airlock; t[y * W + 3] = TileKind.Floor; t[y * W + 4] = TileKind.Floor; }   // floor on the east, void on the west
    expect(findGates(t, W, H)[0].inner).toBe(1);
    const u = new Array(W * H).fill(0);
    for (let y = 0; y < H; y++) { u[y * W + 3] = TileKind.Airlock; u[y * W + 2] = TileKind.Floor; u[y * W + 1] = TileKind.Floor; }   // floor on the west
    expect(findGates(u, W, H)[0].inner).toBe(0);
    const h = new Array(W * H).fill(0);
    for (let x = 0; x < W; x++) { h[1 * W + x] = TileKind.Airlock; h[2 * W + x] = TileKind.Floor; }      // floor below a horizontal gate
    expect(findGates(h, W, H)[0].inner).toBe(1);
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
