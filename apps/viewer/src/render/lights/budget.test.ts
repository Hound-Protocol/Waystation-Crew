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
  it("drops shadows and most lights when zoomed far out, on any device", () => {
    for (const mobile of [false, true]) expect(lightBudget({ mobile, scale: 4.9 })).toEqual({ maxLights: 8, steps: 1, shadows: false });
    expect(lightBudget({ mobile: false, scale: 5 }).shadows).toBe(true);
  });
});
