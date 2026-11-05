import { describe, it, expect } from "vitest";
import { gaitOf, laneAt, swayAt, LANE_SPREAD } from "./gait";

describe("gait", () => {
  it("is deterministic per character and differs between characters", () => {
    expect(gaitOf(7)).toEqual(gaitOf(7));
    const phases = new Set(Array.from({ length: 40 }, (_, i) => gaitOf(i).phase.toFixed(3)));
    const freqs = new Set(Array.from({ length: 40 }, (_, i) => gaitOf(i).freq.toFixed(3)));
    expect(phases.size).toBeGreaterThan(30); expect(freqs.size).toBeGreaterThan(30);
  });
  it("keeps frequency and amplitude in a believable range", () => {
    for (let i = 0; i < 200; i++) { const g = gaitOf(i); expect(g.freq).toBeGreaterThanOrEqual(0.8); expect(g.freq).toBeLessThanOrEqual(1.25); expect(g.amp).toBeGreaterThanOrEqual(0.03); expect(g.amp).toBeLessThanOrEqual(0.08); }
  });
  it("lane drifts slowly within ±0.18 tile and spreads people across it", () => {
    expect(LANE_SPREAD).toBe(0.18);
    let lo = Infinity, hi = -Infinity; const at0 = new Set<string>();
    for (let i = 0; i < 100; i++) { at0.add(laneAt(i, 0).toFixed(2)); for (let t = 0; t < 600; t += 3) { const l = laneAt(i, t); lo = Math.min(lo, l); hi = Math.max(hi, l); } }
    expect(lo).toBeGreaterThanOrEqual(-0.18 - 1e-9); expect(hi).toBeLessThanOrEqual(0.18 + 1e-9);
    expect(hi - lo).toBeGreaterThan(0.3); expect(at0.size).toBeGreaterThan(10);
    expect(Math.abs(laneAt(3, 1) - laneAt(3, 0))).toBeLessThan(0.02);   // slow: no visible jitter between ticks
  });
  it("sways with the character's own frequency and phase", () => {
    expect(swayAt(1, 10)).not.toBeCloseTo(swayAt(2, 10), 3);
    for (let t = 0; t < 50; t += 0.37) expect(Math.abs(swayAt(5, t))).toBeLessThanOrEqual(gaitOf(5).amp + 1e-9);
  });
});
