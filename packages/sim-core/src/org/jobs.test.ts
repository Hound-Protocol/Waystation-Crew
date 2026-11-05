import { describe, it, expect } from "vitest";
import { HUB } from "../station/starter";
import { createWorld, step } from "../world";
import { addCharacter } from "../ecs";
import { Department } from "./departments";
import { Rank } from "./ranks";
import { assignJobs, shiftOf, jobOf } from "./jobs";
import { CharState } from "../ai/affordances";
import { interactionPoint } from "../station/starter";

const spawn = (w: ReturnType<typeof createWorld>, dept: Department, i = 0) =>
  addCharacter(w, { name: `E${i}`, dept, rank: Rank.Trainee, x: HUB.x - 5 + (i % 10), y: HUB.y + 5 });

describe("shifts", () => {
  it("starts at day shift and cycles in 8h blocks", () => {
    expect(shiftOf(0)).toBe("day");
    expect(shiftOf(8 * 3600)).toBe("swing");
    expect(shiftOf(16 * 3600)).toBe("night");
    expect(shiftOf(24 * 3600)).toBe("day");
  });
});

describe("assignJobs", () => {
  it("never puts two characters in one post", () => {
    const w = createWorld(1);
    for (let i = 0; i < 40; i++) spawn(w, Department.Engineering, i);
    assignJobs(w);
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) { const j = w.chars.job[i]; if (j >= 0) { expect(seen.has(j)).toBe(false); seen.add(j); } }
  });
  it("overflow falls back to Service then to unassigned without error", () => {
    const w = createWorld(1);
    for (let i = 0; i < 200; i++) spawn(w, Department.Medical, i);
    expect(() => assignJobs(w)).not.toThrow();
    const depts = new Set<Department>();
    let unassigned = 0;
    for (let i = 0; i < 200; i++) { const p = jobOf(w, i); if (p) depts.add(p.dept); else unassigned++; }
    expect(depts.has(Department.Medical)).toBe(true);
    expect(depts.has(Department.Service)).toBe(true);
    expect(unassigned).toBeGreaterThan(0);
  });
  it("on shift, a fed and rested character walks to its workstation and works", () => {
    const w = createWorld(5);
    const id = spawn(w, Department.Engineering);
    assignJobs(w);
    const post = jobOf(w, id)!;
    expect(post.shift).toBe("day");
    let worked = false;
    for (let t = 0; t < 400 && !worked; t++) { step(w); worked = w.chars.state[id] === CharState.Working; }
    expect(worked).toBe(true);
    const ip = interactionPoint(w.station.map, w.station.furniture[post.workstationFurnitureId])!;
    expect([w.chars.x[id], w.chars.y[id]]).toEqual([ip.x, ip.y]);
  });
  it("off shift, the same character does not go to work", () => {
    const w = createWorld(5);
    const id = spawn(w, Department.Engineering);
    assignJobs(w);
    const night = w.posts.find((p) => p.dept === Department.Engineering && p.shift === "night")!;
    w.chars.job[id] = night.id;
    for (let t = 0; t < 600; t++) { step(w); expect(w.chars.state[id]).not.toBe(CharState.Working); }
  });
});

describe("staffing on the starter station", () => {
  it.each([1, 2, 3, 4, 5])("seed %i: at least 95 of 100 arrivals get a job", async (seed) => {
    const { seedPopulation } = await import("../population");
    const w = createWorld(seed);
    seedPopulation(w, 100);
    let assigned = 0;
    for (let i = 0; i < 100; i++) if (w.chars.job[i] >= 0) assigned++;
    expect(assigned).toBeGreaterThanOrEqual(95);
  });
});
