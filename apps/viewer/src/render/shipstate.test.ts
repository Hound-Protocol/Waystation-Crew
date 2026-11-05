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

describe("shipState: the heavy gateways", () => {
  it("stay open the whole time the ship is docked, and shut only before departure", () => {
    for (let t = 0; t < 1140; t += 10) expect(shipState(t)).toMatchObject({ gate: 1, gateMoving: false });
    for (let t = 1200; t < 1500; t += 10) expect(shipState(t)).toMatchObject({ gate: 0, gateMoving: false });
    for (let t = 1560; t < CYCLE; t += 10) expect(shipState(t)).toMatchObject({ gate: 1, gateMoving: false });
  });
  it("opens in three beats: a small crack, a pause, then a slow heavy swing", () => {
    const g = (t: number) => shipState(t).gate;
    expect(g(1500)).toBe(0);
    expect(g(1504)).toBeGreaterThan(0); expect(g(1504)).toBeLessThan(0.1);               // cracking
    expect(g(1515)).toBeCloseTo(0.1, 5); expect(g(1517)).toBeCloseTo(0.1, 5);            // pause at the crack
    expect(g(1530)).toBeGreaterThan(0.2); expect(g(1530)).toBeLessThan(0.9);             // swinging
    expect(g(1560)).toBe(1);
    let prev = 0; for (let t = 1500; t <= 1560; t++) { expect(g(t)).toBeGreaterThanOrEqual(prev); prev = g(t); }
    for (let t = 1500; t < 1560; t++) expect(shipState(t).gateMoving).toBe(true);
  });
  it("closes the same way in reverse, ending in a small crack that thuds shut", () => {
    const g = (t: number) => shipState(t).gate;
    expect(g(1140)).toBe(1); expect(g(1200)).toBe(0);
    let prev = 1; for (let t = 1140; t <= 1200; t++) { expect(g(t)).toBeLessThanOrEqual(prev); prev = g(t); }
    expect(g(1185)).toBeCloseTo(0.1, 5);                                                  // the pause before the final crack closes
    for (let t = 1140; t < 1200; t++) expect(shipState(t).gateMoving).toBe(true);
  });
  it("is fully shut by the time the restraint bars start to lower", () => {
    expect(shipState(1200).gate).toBe(0); expect(shipState(1201).bars).toBeGreaterThan(0);
  });
});
