import { describe, it, expect } from "vitest";
import { lightBudget } from "./budget";
import { MAX_LIGHTS, MAX_STEPS } from "./shader";

describe("lightBudget", () => {
  it("gives desktop the full budget with shadows", () => {
    expect(lightBudget({ mobile: false, scale: 48 })).toEqual({ maxLights: 48, steps: 24, shadows: true });
    expect(lightBudget({ mobile: false, scale: 48 }).maxLights).toBeLessThanOrEqual(MAX_LIGHTS);
    expect(lightBudget({ mobile: false, scale: 48 }).steps).toBeLessThanOrEqual(MAX_STEPS);
  });
  it("gives phones fewer lights and shorter shadow rays", () => {
    expect(lightBudget({ mobile: true, scale: 48 })).toEqual({ maxLights: 16, steps: 8, shadows: true });
  });
  it("eases shadow quality away as you zoom out instead of switching it off at one scale", () => {
    const steps = (scale: number) => lightBudget({ mobile: false, scale }).steps;
    expect(steps(4.9)).toBe(1); expect(lightBudget({ mobile: false, scale: 4.9 }).shadows).toBe(false);
    expect(steps(8)).toBe(24); expect(steps(40)).toBe(24);
    let prev = steps(4.9); for (let s = 4.9; s <= 8; s += 0.05) { const v = steps(s); expect(v).toBeGreaterThanOrEqual(prev); expect(v - prev).toBeLessThanOrEqual(2); prev = v; }
    expect(lightBudget({ mobile: true, scale: 8 }).steps).toBe(8);
  });
  it("keeps the light count constant across zoom (a count switch would pop)", () => {
    expect(lightBudget({ mobile: false, scale: 4 }).maxLights).toBe(48); expect(lightBudget({ mobile: true, scale: 4 }).maxLights).toBe(16);
  });
});
