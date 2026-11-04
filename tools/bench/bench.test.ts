import { describe, it, expect } from "vitest";
import { hashWorld } from "@wc/sim-core";
import { makeWorld, runTicks } from "./harness";

describe("scale edge cases", () => {
  it("zero characters ticks without error", () => { const w = makeWorld(0); expect(() => runTicks(w, 100)).not.toThrow(); });
  it("one character ticks without error and stays on the map", () => {
    const w = makeWorld(1); runTicks(w, 300);
    expect(w.chars.x[0]).toBeGreaterThanOrEqual(0); expect(w.chars.x[0]).toBeLessThan(200);
  });
  it("10,000 characters tick, never double-book furniture, and stay deterministic", () => {
    const a = makeWorld(10_000, 120, 5), b = makeWorld(10_000, 120, 5);
    runTicks(a, 20); runTicks(b, 20);
    expect(hashWorld(a)).toBe(hashWorld(b));
    const owners = new Set<number>(); for (const id of a.reservations.values()) { expect(owners.has(id)).toBe(false); owners.add(id); }
  });
});
