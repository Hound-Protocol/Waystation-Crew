import { describe, it, expect } from "vitest";
import { HUB } from "../station/starter";
import { createWorld } from "../world";
import { addCharacter } from "../ecs";
import { Department } from "../org/departments";
import { Rank } from "../org/ranks";
import { stepAI } from "./decide";
import { profileOf } from "./profile";

describe("profileOf", () => {
  const setup = () => {
    const w = createWorld(1);
    const id = addCharacter(w, { name: "Ada Silva", dept: Department.Service, rank: Rank.Trainee, x: HUB.x - 4, y: HUB.y + 5 });
    return { w, id };
  };
  it("gives the PDA everything: identity, doing, place, needs, job, shift, thoughts", () => {
    const { w, id } = setup();
    w.chars.hunger[id] = 0.1; w.chars.nextDecideTick[id] = 0; stepAI(w);
    const p = profileOf(w, id)!;
    expect(p.name).toBe("Ada Silva");
    expect(p.dept).toBe("Service"); expect(p.rank).toBe("Trainee");
    expect(p.activity.length).toBeGreaterThan(0);
    expect(typeof p.place).toBe("string");
    for (const k of ["hunger", "energy", "social", "fun"] as const) { expect(p.needs[k]).toBeGreaterThanOrEqual(0); expect(p.needs[k]).toBeLessThanOrEqual(1); }
    expect(p.needs.hunger).toBeCloseTo(0.1, 5);
    expect(["day", "swing", "night"]).toContain(p.shiftNow);
    expect(p.thoughts.length).toBeGreaterThan(0);
    expect(p.condition).toMatch(/hungry|starving|fine|tired|lonely|bored|exhausted/i);
  });
  it("reports the assigned job and whether the shift is on now; null for unknown ids", () => {
    const { w, id } = setup();
    expect(profileOf(w, 9999)).toBeNull();
    const p = profileOf(w, id)!;
    if (p.job) { expect(["day", "swing", "night"]).toContain(p.job.shift); expect(typeof p.job.onShift).toBe("boolean"); }
  });
  it("does not touch the world (read-only)", () => {
    const { w, id } = setup();
    const t = w.tick, r = JSON.stringify(w.chars.hunger);
    profileOf(w, id);
    expect(w.tick).toBe(t); expect(JSON.stringify(w.chars.hunger)).toBe(r);
  });
});
