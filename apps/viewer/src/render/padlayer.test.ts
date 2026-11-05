import { describe, it, expect } from "vitest";
import { PAD } from "@wc/sim-core";
import { BODIES, stationFrame } from "./space/system";
import { padOrigin, padFade } from "./padlayer";

describe("landing pad placement", () => {
  const home = BODIES.find((b) => b.home)!;
  it("sits wholly on the home planet's disc, at whole-tile coordinates", () => {
    const o = padOrigin(), c = stationFrame(0).body(home);
    expect(Number.isInteger(o.x) && Number.isInteger(o.y)).toBe(true);
    for (const [dx, dy] of [[0, 0], [PAD.w, 0], [0, PAD.h], [PAD.w, PAD.h]]) expect(Math.hypot(o.x + dx - c.x, o.y + dy - c.y)).toBeLessThan(home.radius);
  });
  it("is the same at every tick (the planet's spin is synchronous with the station)", () => {
    const a = stationFrame(0).body(home), b = stationFrame(40000).body(home);
    expect(b.x).toBeCloseTo(a.x, 3); expect(b.y).toBeCloseTo(a.y, 3);
  });
  it("fades in smoothly with zoom: invisible when far, full when close, never jumping", () => {
    expect(padFade(1)).toBe(0); expect(padFade(4)).toBe(0); expect(padFade(12)).toBe(1);
    let prev = 0;
    for (let s = 4; s <= 12; s += 0.25) { const f = padFade(s); expect(f).toBeGreaterThanOrEqual(prev); expect(f - prev).toBeLessThan(0.15); prev = f; }
  });
});
