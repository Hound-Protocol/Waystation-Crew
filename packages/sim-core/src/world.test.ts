import { describe, it, expect } from "vitest";
import { createRng } from "./rng";
import { createWorld, step, stepMany, hashWorld } from "./world";

describe("rng", () => {
  it("is reproducible for a seed", () => {
    const a = createRng(42), b = createRng(42);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });
  it("forks differ by label but are reproducible", () => {
    const fa = createRng(7).fork("a"), fb = createRng(7).fork("b"), fa2 = createRng(7).fork("a");
    expect(fa.next()).not.toBe(fb.next());
    expect(createRng(7).fork("a").next()).toBe(fa2.next());
  });
  it("int is inclusive within range", () => {
    const r = createRng(1);
    for (let i = 0; i < 500; i++) { const v = r.int(5, 30); expect(v).toBeGreaterThanOrEqual(5); expect(v).toBeLessThanOrEqual(30); }
  });
});

describe("world", () => {
  it("same seed and ticks give equal hash", () => {
    const a = createWorld(42), b = createWorld(42);
    stepMany(a, 5000); for (let i = 0; i < 5000; i++) step(b);
    expect(a.tick).toBe(5000);
    expect(hashWorld(a)).toBe(hashWorld(b));
  });
  it("different seeds differ", () => {
    const a = createWorld(1), b = createWorld(2);
    stepMany(a, 100); stepMany(b, 100);
    expect(hashWorld(a)).not.toBe(hashWorld(b));
  });
});
