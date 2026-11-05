import { describe, it, expect } from "vitest";
import { shipState, CYCLE } from "./shipstate";

describe("shipState: the docked ship's pre-departure routine (stand-in until real flights drive it)", () => {
  it("sits idle with open bars and cold engines most of the time", () => {
    for (const t of [0, 600, 1199, 1500, 1799]) expect(shipState(t)).toMatchObject({ phase: "docked", bars: 0, thrust: 0, glow: 0 });
  });
  it("lowers the shoulder bars before the burn, locks them, and raises them after", () => {
    const bars = (t: number) => shipState(t).bars;
    expect(bars(1200)).toBe(0);
    expect(bars(1230)).toBeGreaterThan(0); expect(bars(1230)).toBeLessThan(1);
    expect(bars(1260)).toBe(1); expect(bars(1400)).toBe(1);
    expect(bars(1470)).toBeGreaterThan(0); expect(bars(1470)).toBeLessThan(1);
    expect(bars(1500)).toBe(0);
    let prev = 0; for (let t = 1200; t <= 1260; t++) { expect(bars(t)).toBeGreaterThanOrEqual(prev); prev = bars(t); }
  });
  it("only fires the main thrusters while the bars are locked, ramping in and out", () => {
    for (let t = 0; t < CYCLE; t++) { const s = shipState(t); if (s.thrust > 0) expect(s.bars, `t=${t}`).toBe(1); }
    expect(shipState(1385).thrust).toBeGreaterThan(0); expect(shipState(1385).thrust).toBeLessThan(1);
    expect(shipState(1410).thrust).toBe(1);
    expect(shipState(1436).thrust).toBeGreaterThan(0); expect(shipState(1436).thrust).toBeLessThan(1);
  });
  it("warms the nozzles before the burn and cools them after (glow lingers)", () => {
    expect(shipState(1250).glow).toBeGreaterThan(0);
    expect(shipState(1410).glow).toBe(1);
    expect(shipState(1470).glow).toBeGreaterThan(0);
    expect(shipState(1470).glow).toBeLessThan(1);
  });
  it("repeats every cycle and stays within 0..1", () => {
    for (let t = 0; t < CYCLE; t += 7) { const a = shipState(t), b = shipState(t + CYCLE * 3); expect(b).toEqual(a); for (const v of [a.bars, a.thrust, a.glow]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); } }
  });
});
