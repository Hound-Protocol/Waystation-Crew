import { describe, it, expect } from "vitest";
import { SupplyEase, EMERGENCY_GAIN } from "./supply";

const run = (s: SupplyEase, seconds: number, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) s.step(dt); };

describe("supply easing for the lamps", () => {
  it("starts fully lit with no emergency tint", () => {
    const s = new SupplyEase(); expect(s.gain).toBe(1); expect(s.emergency).toBe(0);
  });
  it("lamp intensity scales with the supply level once it has settled", () => {
    const s = new SupplyEase(); s.set(0.5); run(s, 6);
    expect(s.gain).toBeCloseTo(0.5, 2); expect(s.emergency).toBeCloseTo(0, 3);
  });
  it("changes ease over time, never jump, and never overshoot", () => {
    const s = new SupplyEase(); s.set(0.4); s.step(1 / 60);
    expect(s.gain).toBeLessThan(1); expect(s.gain).toBeGreaterThan(0.95);
    let prev = s.gain;
    for (let i = 0; i < 600; i++) { s.step(1 / 60); expect(s.gain).toBeLessThanOrEqual(prev + 1e-12); expect(s.gain).toBeGreaterThanOrEqual(0.4 - 1e-9); prev = s.gain; }
  });
  it("a blackout fades to the dim emergency light with the emergency tint", () => {
    const s = new SupplyEase(); s.set(0); run(s, 6);
    expect(s.gain).toBeCloseTo(EMERGENCY_GAIN, 2); expect(s.emergency).toBeCloseTo(1, 2);
  });
  it("power returning eases back to normal", () => {
    const s = new SupplyEase(); s.set(0); run(s, 6); s.set(1); run(s, 8);
    expect(s.gain).toBeCloseTo(1, 2); expect(s.emergency).toBeCloseTo(0, 2);
  });
  it("is stable for dt = 0 and clamps nonsense input", () => {
    const s = new SupplyEase(); s.set(-3); s.step(0); expect(Number.isFinite(s.gain)).toBe(true);
    s.set(7); run(s, 6); expect(s.gain).toBeLessThanOrEqual(1);
  });
});
