import { describe, it, expect } from "vitest";
import { createWorld, hashWorld } from "../world";
import { addCharacter } from "../ecs";
import { Department } from "../org/departments";
import { Rank } from "../org/ranks";
import { stepAI } from "./decide";
import { explain } from "./explain";

describe("explain", () => {
  const setup = () => {
    const w = createWorld(1);
    const id = addCharacter(w, { name: "Ada Silva", dept: Department.Service, rank: Rank.Trainee, x: 62, y: 70 });
    w.chars.hunger[id] = 0.1; w.chars.energy[id] = 0.2; w.chars.fun[id] = 0.3; w.chars.nextDecideTick[id] = 0;
    stepAI(w);
    return { w, id };
  };
  it("reports the current action first, then needs and scored alternatives", () => {
    const { w, id } = setup();
    const lines = explain(w, id);
    expect(lines[0]).toMatch(/^Now: Eat/);
    expect(lines.some((l) => l.startsWith("Needs:"))).toBe(true);
    expect(lines.filter((l) => l.startsWith("Option")).length).toBeGreaterThanOrEqual(2);
  });
  it("does not change the simulation", () => {
    const { w, id } = setup();
    const before = hashWorld(w);
    explain(w, id); explain(w, id);
    expect(hashWorld(w)).toBe(before);
  });
  it("handles unknown ids and idle characters", () => {
    const { w } = setup();
    expect(explain(w, 999)).toEqual(["No such character"]);
    const id2 = addCharacter(w, { name: "B", dept: Department.Service, rank: Rank.Trainee, x: 62, y: 70 });
    expect(explain(w, id2)[0]).toMatch(/^Now: Idle/);
  });
});
