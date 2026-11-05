import { describe, it, expect } from "vitest";
import { LightFade, FADE_SECONDS } from "./fade";
import type { LightSource } from "./types";

const L = (id: number): LightSource => ({ id, kind: "point", x: id, y: 0, r: 4, i: 1, c: [255, 255, 255] });
const f = (fd: LightFade, id: number) => fd.entries().find((e) => e.light.id === id)?.f;
const run = (fd: LightFade, secs: number) => { for (let t = 0; t < secs; t += 1 / 60) fd.step(1 / 60); };

describe("LightFade", () => {
  it("brings a new light in from nothing over about a second", () => {
    const fd = new LightFade(); fd.sync([L(1)]);
    expect(f(fd, 1)).toBe(0);
    run(fd, FADE_SECONDS / 2); expect(f(fd, 1)).toBeGreaterThan(0.4); expect(f(fd, 1)).toBeLessThan(0.6);
    run(fd, FADE_SECONDS); expect(f(fd, 1)).toBe(1);
  });
  it("keeps a removed light fading out, then drops it", () => {
    const fd = new LightFade(); fd.sync([L(1), L(2)], true); expect(f(fd, 2)).toBe(1);
    fd.sync([L(1)]); run(fd, FADE_SECONDS / 2); expect(f(fd, 2)).toBeGreaterThan(0.4); expect(f(fd, 2)).toBeLessThan(0.6);
    run(fd, FADE_SECONDS); expect(f(fd, 2)).toBeUndefined(); expect(f(fd, 1)).toBe(1);
  });
  it("does not fade lights that stay (same ids on a rebuild)", () => {
    const fd = new LightFade(); fd.sync([L(1)], true); run(fd, 0.1);
    fd.sync([L(1), L(2)]); expect(f(fd, 1)).toBe(1);
  });
  it("changes at a steady rate: no frame jumps more than a 60fps step", () => {
    const fd = new LightFade(); fd.sync([L(1)]); let prev = 0, worst = 0;
    for (let k = 0; k < 90; k++) { fd.step(1 / 60); const v = f(fd, 1)!; worst = Math.max(worst, v - prev); prev = v; }
    expect(worst).toBeLessThanOrEqual(1 / 60 / FADE_SECONDS + 1e-9);
  });
  it("a light that returns while fading out turns around without a jump", () => {
    const fd = new LightFade(); fd.sync([L(1)], true); fd.sync([]); run(fd, 0.3); const mid = f(fd, 1)!;
    fd.sync([L(1)]); expect(f(fd, 1)).toBe(mid); fd.step(1 / 60); expect(f(fd, 1)!).toBeGreaterThan(mid);
  });
});
