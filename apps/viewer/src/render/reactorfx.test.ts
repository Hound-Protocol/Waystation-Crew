import { describe, it, expect } from "vitest";
import { coreGlow, gaugeBars } from "./reactorfx";

describe("reactor core glow", () => {
  it("grows with output while running", () => {
    expect(coreGlow("running", 0.8, 0).a).toBeGreaterThan(coreGlow("running", 0.3, 0).a);
    expect(coreGlow("running", 0, 0).a).toBeGreaterThanOrEqual(0.12);
  });
  it("is bright cyan-white when healthy and shifts warm when starting", () => {
    const run = coreGlow("running", 1, 0).rgb, start = coreGlow("starting", 0, 0).rgb;
    expect(run[2]).toBeGreaterThan(run[0]); expect(start[0]).toBeGreaterThan(start[2]);
  });
  it("goes dark red and slow-pulses in a scram, never fully off", () => {
    const a = coreGlow("scram", 0, 0), b = coreGlow("scram", 0, 1.5);
    expect(a.rgb[0]).toBeGreaterThan(a.rgb[2]); expect(a.a).toBeLessThan(0.3); expect(a.a).toBeGreaterThan(0);
    expect(Math.abs(a.a - b.a)).toBeGreaterThan(0.02);
  });
  it("pulses gently when running so it reads as alive, within 0..1", () => {
    const vals = [0, 0.3, 0.6, 0.9, 1.2].map((t) => coreGlow("running", 0.6, t).a);
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.01); for (const v of vals) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
});

describe("console gauges", () => {
  it("shows feed, temperature, field and coolant as four bars clamped to 0..1", () => {
    const g = gaugeBars({ feed: 0.5, temp: 0.62, field: 1.4, coolant: -1 });
    expect(g.map((x) => x.key)).toEqual(["feed", "temp", "field", "coolant"]);
    expect(g.map((x) => x.v)).toEqual([0.5, 0.62, 1, 0]);
  });
  it("marks temperature outside the healthy band as a warning", () => {
    expect(gaugeBars({ feed: 0.5, temp: 0.62, field: 0.7, coolant: 0.5 })[1].warn).toBe(false);
    expect(gaugeBars({ feed: 0.5, temp: 0.9, field: 0.7, coolant: 0.5 })[1].warn).toBe(true);
    expect(gaugeBars({ feed: 0.5, temp: 0.2, field: 0.7, coolant: 0.5 })[1].warn).toBe(true);
  });
});
