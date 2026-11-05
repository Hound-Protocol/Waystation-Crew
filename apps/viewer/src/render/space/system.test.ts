import { describe, it, expect } from "vitest";
import { BODIES, DAY, periodOf, helio, stationFrame } from "./system";

describe("solar system", () => {
  it("the home planet circles the sun once per sim day", () => {
    const home = BODIES.find((b) => b.home)!;
    expect(periodOf(home)).toBe(DAY);
    const a = helio(home, 0), b = helio(home, DAY);
    expect(b.x).toBeCloseTo(a.x, 6); expect(b.y).toBeCloseTo(a.y, 6);
    const q = helio(home, DAY / 4);
    expect(Math.hypot(q.x, q.y)).toBeCloseTo(home.orbit, 6);
    expect(q.x).not.toBeCloseTo(a.x, 0);
  });
  it("outer planets are slower (Kepler: T ~ a^1.5), inner faster", () => {
    const home = BODIES.find((b) => b.home)!;
    for (const b of BODIES) {
      if (b === home) continue;
      expect(periodOf(b)).toBeCloseTo(DAY * Math.pow(b.orbit / home.orbit, 1.5), 3);
    }
    const sorted = [...BODIES].sort((a, b) => a.orbit - b.orbit);
    for (let i = 1; i < sorted.length; i++) expect(periodOf(sorted[i])).toBeGreaterThan(periodOf(sorted[i - 1]));
  });
  it("the station keeps a fixed place beside its home planet while the system turns", () => {
    const home = BODIES.find((b) => b.home)!;
    const d = (t: number) => { const s = stationFrame(t), h = s.body(home); return [h.x - s.station.x, h.y - s.station.y]; };
    const [x0, y0] = d(0), [x1, y1] = d(30000);
    expect(x1).toBeCloseTo(x0, 6); expect(y1).toBeCloseTo(y0, 6);
    const sun0 = stationFrame(0).sun, sun1 = stationFrame(DAY / 2).sun;
    expect(Math.hypot(sun1.x - sun0.x, sun1.y - sun0.y)).toBeGreaterThan(1000);
  });
});
