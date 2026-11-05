import { describe, it, expect } from "vitest";
import { markerAlpha, separationAlpha, MARKER_FADE } from "./zoommarkers";

describe("zoom-out markers", () => {
  it("are invisible while the real sprites are big enough", () => {
    expect(markerAlpha(MARKER_FADE.start)).toBe(0); expect(markerAlpha(20)).toBe(0); expect(markerAlpha(56)).toBe(0);
  });
  it("are fully visible once the station is a speck", () => {
    expect(markerAlpha(MARKER_FADE.full)).toBe(1); expect(markerAlpha(0.15)).toBe(1);
  });
  it("fade smoothly and monotonically between", () => {
    let prev = 0;
    for (let s = MARKER_FADE.start; s >= MARKER_FADE.full; s -= 0.05) { const a = markerAlpha(s); expect(a).toBeGreaterThanOrEqual(prev); prev = a; }
    expect(markerAlpha((MARKER_FADE.start + MARKER_FADE.full) / 2)).toBeCloseTo(0.5, 5);
  });
  it("hide the ship tag when it sits on top of the station tag and show it once they separate", () => {
    expect(separationAlpha(0)).toBe(0); expect(separationAlpha(20)).toBe(0);
    expect(separationAlpha(200)).toBe(1);
    expect(separationAlpha(60)).toBeGreaterThan(0); expect(separationAlpha(60)).toBeLessThan(1);
  });
});
