import { describe, it, expect } from "vitest";
import { createWorld, hashWorld } from "./world";
import { addCharacter } from "./ecs";
import { Department } from "./org/departments";
import { Rank } from "./org/ranks";

const mk = (w: ReturnType<typeof createWorld>, i: number) =>
  addCharacter(w, { name: `C${i}`, dept: Department.Engineering, rank: Rank.Trainee, x: i % 50, y: Math.floor(i / 50) });

describe("character store", () => {
  it("keeps ids unique and sequential across 10k adds", () => {
    const w = createWorld(1);
    for (let i = 0; i < 10_000; i++) expect(mk(w, i)).toBe(i);
    expect(w.chars.count).toBe(10_000);
  });
  it("preserves earlier data when growing", () => {
    const w = createWorld(1);
    for (let i = 0; i < 5000; i++) mk(w, i);
    expect(w.chars.name(3)).toBe("C3");
    expect(w.chars.x[149]).toBe(149 % 50);
    expect(w.chars.hunger[4999]).toBe(1);
  });
  it("includes characters in the world hash", () => {
    const a = createWorld(1), b = createWorld(1);
    const h0 = hashWorld(a);
    mk(a, 0);
    expect(hashWorld(a)).not.toBe(h0);
    mk(b, 0);
    expect(hashWorld(a)).toBe(hashWorld(b));
  });
});
