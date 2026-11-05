import { describe, it, expect } from "vitest";
import { ZOOM_STOPS, nextStop, WheelStepper } from "./zoomsteps";
import { zoomLevel } from "./lod";
import { MAX_SCALE, MIN_SCALE } from "./camera";

describe("zoom stops", () => {
  it("has exactly one stop in each of the six zoom levels, closest first, inside the camera limits", () => {
    expect(ZOOM_STOPS.map(zoomLevel)).toEqual([1, 2, 3, 4, 5, 6]);
    for (let i = 1; i < ZOOM_STOPS.length; i++) expect(ZOOM_STOPS[i]).toBeLessThan(ZOOM_STOPS[i - 1]);
    expect(ZOOM_STOPS[0]).toBeLessThanOrEqual(MAX_SCALE); expect(ZOOM_STOPS[5]).toBeGreaterThanOrEqual(MIN_SCALE);
  });
  it("one step in goes to the next closer stop, one step out to the next farther one", () => {
    expect(nextStop(ZOOM_STOPS[3], 1)).toBe(ZOOM_STOPS[2]);
    expect(nextStop(ZOOM_STOPS[3], -1)).toBe(ZOOM_STOPS[4]);
  });
  it("from between stops, the first step lands on the adjacent stop in that direction", () => {
    const mid = Math.sqrt(ZOOM_STOPS[2] * ZOOM_STOPS[3]);
    expect(nextStop(mid, 1)).toBe(ZOOM_STOPS[2]); expect(nextStop(mid, -1)).toBe(ZOOM_STOPS[3]);
  });
  it("stays put at the ends", () => {
    expect(nextStop(ZOOM_STOPS[0], 1)).toBe(ZOOM_STOPS[0]); expect(nextStop(ZOOM_STOPS[5], -1)).toBe(ZOOM_STOPS[5]);
    expect(nextStop(MAX_SCALE, 1)).toBe(ZOOM_STOPS[0]);
  });
});

describe("WheelStepper", () => {
  it("turns one mouse notch into exactly one step, scrolling toward you zooming out", () => {
    const w = new WheelStepper();
    expect(w.feed(-100, 0)).toBe(1); expect(new WheelStepper().feed(100, 0)).toBe(-1);
  });
  it("ignores the rest of a spinning trackpad or fast wheel until it settles", () => {
    const w = new WheelStepper(); expect(w.feed(-100, 0)).toBe(1);
    for (let t = 10; t < 200; t += 10) expect(w.feed(-100, t)).toBe(0);
    expect(w.feed(-100, 500)).toBe(1);
  });
  it("adds up small trackpad deltas into one step", () => {
    const w = new WheelStepper(); let steps = 0;
    for (let i = 0; i < 8; i++) steps += w.feed(-6, i * 400);       // slow, widely spaced: 48 total
    expect(steps).toBe(1);
  });
  it("a direction change starts fresh and steps at once", () => {
    const w = new WheelStepper(); w.feed(-100, 0);
    expect(w.feed(100, 300)).toBe(-1);
  });
});
