import { describe, it, expect } from "vitest";
import { renderPlanet, PLANETS } from "./planet";

const lum = (d: Uint8ClampedArray, w: number, x: number, y: number) => { const i = (y * w + x) * 4; return d[i] + d[i + 1] + d[i + 2]; };

describe("renderPlanet", () => {
  for (const spec of PLANETS) {
    it(`${spec.name}: round, transparent outside, lit from the upper left`, () => {
      const p = renderPlanet(spec);
      const c = p.size / 2;
      expect(p.data[3]).toBe(0); // corner transparent
      expect(p.data[(Math.floor(c) * p.size + Math.floor(c)) * 4 + 3]).toBe(255); // centre opaque
      const r = Math.floor(spec.radius * 0.6);
      const lit = lum(p.data, p.size, Math.floor(c - r * 0.7), Math.floor(c - r * 0.7));
      const dark = lum(p.data, p.size, Math.floor(c + r * 0.7), Math.floor(c + r * 0.7));
      expect(lit).toBeGreaterThan(dark);
    });
  }
  it("is deterministic", () => {
    const a = renderPlanet(PLANETS[0]), b = renderPlanet(PLANETS[0]);
    expect(Array.from(a.data.slice(0, 4000)).join()).toBe(Array.from(b.data.slice(0, 4000)).join());
  });
  it("uses a limited quantized palette (pixel-art, few colours)", () => {
    const p = renderPlanet(PLANETS[1]);
    const set = new Set<number>();
    for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 3]) set.add((p.data[i] << 16) | (p.data[i + 1] << 8) | p.data[i + 2]);
    expect(set.size).toBeLessThanOrEqual(40);
  });
});
