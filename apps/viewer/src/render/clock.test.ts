import { describe, it, expect } from "vitest";
import { ClockSync } from "./clock";

describe("ClockSync", () => {
  const run = (c: ClockSync, seconds: number, fps: number, latest: (t: number) => number, speed: number) => {
    const out: number[] = [];
    for (let i = 0; i < seconds * fps; i++) out.push(c.update(1 / fps, latest(i / fps), speed, false));
    return out;
  };
  it("advances every frame (no stalls) while data keeps arriving once per second", () => {
    const c = new ClockSync(0);
    const frames = run(c, 20, 60, (t) => Math.floor(t), 1);
    // first second: no data newer than tick 0 exists yet, so the clock cannot move (and must not pass the data)
    for (let i = 61; i < frames.length; i++) expect(frames[i]).toBeGreaterThan(frames[i - 1]);
  });
  it("never runs ahead of the data and stays close behind it", () => {
    const c = new ClockSync(0);
    const frames = run(c, 30, 60, (t) => Math.floor(t), 1);
    frames.forEach((f, i) => expect(f).toBeLessThanOrEqual(Math.floor(i / 60) + 1e-9));
    expect(Math.floor(30) - frames[frames.length - 1]).toBeLessThan(3);
  });
  it("speed changes are followed without going backwards", () => {
    const c = new ClockSync(0);
    const frames = run(c, 10, 60, (t) => Math.floor(t * 10), 10);
    for (let i = 1; i < frames.length; i++) expect(frames[i]).toBeGreaterThanOrEqual(frames[i - 1]);
    expect(frames[frames.length - 1]).toBeGreaterThan(70);
  });
  it("holds still while paused and snaps forward after a long gap", () => {
    const c = new ClockSync(10);
    expect(c.update(1, 20, 1, true)).toBe(10);
    expect(c.update(0.016, 5000, 1, false)).toBeGreaterThan(4000);
  });
});
